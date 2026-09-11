/**
 * MBN Hiring Portal — Cloudflare Pages Worker
 *
 * Routes:
 *   POST /api/chat          → proxy to Claude (Anthropic API)
 *   POST /api/submit        → save report to Supabase + create Teamwork task
 *   GET  /api/report/:code  → retrieve report from Supabase (admin only)
 *   *                       → static assets
 *
 * Secrets (set via: wrangler secret put <NAME>):
 *   ANTHROPIC_API_KEY
 *   CLAUDE_MODEL           (optional — overrides DEFAULT_MODEL below)
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_KEY   (service role key — needed to bypass RLS for reads)
 *   TEAMWORK_API_KEY
 *   TEAMWORK_TASKLIST_ID   (optional — defaults to DEFAULT_TASKLIST_ID below)
 *   TEAMWORK_WORKFLOW_ID   (optional — board the candidate card is filed on)
 *   TEAMWORK_STAGE_ID      (optional — board column the card lands in)
 *   ADMIN_PASSCODE         (shown on review page login)
 */

/* Overridable without a deploy: set CLAUDE_MODEL in Cloudflare to move the
   interviews onto a newer model when this one is retired. */
const DEFAULT_MODEL = 'claude-opus-4-5';

/**
 * The closing turn of an assessment is a full JSON report that echoes back every
 * answer verbatim plus a written assessment of each one. On the 24-question
 * assessments that runs well past 4k tokens — and a report cut off mid-JSON is a
 * lost submission, because the page can't parse it and nothing reaches Supabase.
 * Keep this generous: it is a ceiling, not a target, so ordinary turns cost the same.
 *
 * Raising the ceiling alone was not enough. A reply this long takes minutes to
 * generate, and an unstreamed request spends every one of those minutes with no
 * bytes on the wire, so it gets dropped in transit before it ever returns — the
 * fetch below throws and the candidate sees "Connection error: Error 500" on the
 * very last turn. Every /api/chat call is streamed for that reason; see below.
 */
const MAX_TOKENS = 32000;

const TEAMWORK_SITE = 'https://mybizniche.teamwork.com';

/* Where candidate cards go, all overridable by environment variable so the board
   can be rearranged without a code change.

   Creating the task is only half the job: a task with no workflow stage is
   attached to the board but sits in no column, so it never appears on the board
   view at all. That is why finished assessments were nowhere to be seen even
   when the Teamwork call succeeded. After creating the task we move it into the
   "Completed Skills Assessment" column explicitly. */
const DEFAULT_TASKLIST_ID = '3346283';   // 🟢 Low Priority, Donna's Workspace - Internal
const DEFAULT_WORKFLOW_ID = '82559';     // the project's board
const DEFAULT_STAGE_ID    = '474512';    // "Completed Skills Assessment" column

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Passcode',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

/* Assessment type is what the review dashboard and the Teamwork card key off,
   so fall back to the position title rather than storing a generic 'assessment'. */
function inferAssessmentType(report) {
  if (report.assessment_type) return report.assessment_type;
  const position = String(report.position || '').toLowerCase();
  if (position.includes('technical seo')) return 'tech_seo';
  if (position.includes('seo')) return 'seo_strategist';
  if (position.includes('paid') || position.includes('ppc')) return 'ppc_strategist';
  return 'assessment';
}

/* Postgres jsonb cannot store a NUL character, and a lone surrogate is not
   valid UTF-8. Either one makes the insert fail with a 400 that no retry will
   ever get past — and since the report only exists in the candidate's browser,
   that is a finished assessment lost. Candidates paste answers out of Word and
   PDFs, so this is not a hypothetical input. Strip them on the way in.

   Defensive, not a diagnosed fix: no submission has been observed failing this
   way. It costs nothing on clean input and removes the possibility. */
function scrubForJsonb(value) {
  if (typeof value === 'string') {
    return value
      .replace(/\u0000/g, '')
      .replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/g, '')
      .replace(/(^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]/g, '$1');
  }
  if (Array.isArray(value)) return value.map(scrubForJsonb);
  if (value && typeof value === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(value)) out[scrubForJsonb(k)] = scrubForJsonb(v);
    return out;
  }
  return value;
}

/* Writes a report row.

   `claim` does a plain insert, so a completion code that is somehow already
   taken comes back as 409 and the page can pick another. Every write after that
   upserts on completion_code: the candidate owns that code for the rest of the
   session, and each answer they give overwrites their own in-progress row
   rather than creating a new one. The final report lands the same way, updating
   the row the progress saves have been building. */
async function saveReport(env, row, { claim = false } = {}) {
  const url = claim
    ? `${env.SUPABASE_URL}/rest/v1/assessment_reports`
    : `${env.SUPABASE_URL}/rest/v1/assessment_reports?on_conflict=completion_code`;
  return fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      Prefer: claim ? 'return=minimal' : 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(row),
  });
}

/* Teamwork Projects API v1. Returns an outcome rather than throwing — a failed
   card is worth knowing about, but never worth losing a candidate's report over. */
/* Creates a task and files it into the board column. Shared by the normal
   submission path and by the rescue path below. */
async function fileTeamworkCard(env, taskName, description) {
  const tasklistId = env.TEAMWORK_TASKLIST_ID || DEFAULT_TASKLIST_ID;

  if (!env.TEAMWORK_API_KEY) return { ok: false, error: 'TEAMWORK_API_KEY is not set' };

  try {
    const res = await fetch(`${TEAMWORK_SITE}/tasklists/${tasklistId}/tasks.json`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Basic ${btoa(env.TEAMWORK_API_KEY + ':xxx')}`,
      },
      body: JSON.stringify({ 'todo-item': { content: taskName, description } }),
    });

    const body = await res.text();
    if (!res.ok) return { ok: false, tasklist_id: tasklistId, status: res.status, error: body.slice(0, 300) };

    /* v1 has returned the new id under both `id` and `taskId` depending on the
       version. Missing it isn't cosmetic: with no id the stage move below never
       runs, so the card exists but sits in no board column — invisible on the
       board, which reads as "the assessment never arrived". Accept either, and
       keep the raw body when neither is there so the next person can see why. */
    let taskId = null;
    try {
      const parsed = JSON.parse(body);
      taskId = parsed.id || parsed.taskId || parsed.taskID || null;
    } catch (_) {}
    if (!taskId) {
      return {
        ok: true, tasklist_id: tasklistId, task_id: null,
        stage: { ok: false, error: 'No task id returned', body: body.slice(0, 300) },
      };
    }

    const stage = await moveTaskToStage(env, taskId);
    return { ok: true, tasklist_id: tasklistId, task_id: taskId, stage };
  } catch (err) {
    return { ok: false, tasklist_id: tasklistId, error: String(err && err.message || err) };
  }
}

async function createTeamworkTask(env, { code, candidateName, assessmentType, score, report }) {

  const taskName = `${assessmentType.toUpperCase()} — ${candidateName}${score != null ? ` (${score}%)` : ''} — Code: ${code}`;
  const description = [
    `Candidate: ${candidateName}`,
    `Email: ${report.candidate_email || 'Not provided'}`,
    `Assessment: ${assessmentType}`,
    score != null ? `Score: ${score}%` : '',
    `Completion Code: ${code}`,
    `Referral: ${report.referral_source || 'Not provided'}`,
    report.report_incomplete ? 'NOTE: AI summary incomplete — full transcript is on the review page.' : '',
    `Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`,
  ].filter(Boolean).join('\n');

  return fileTeamworkCard(env, taskName, description);
}

/* Files a task into a board column. Without this the card exists but renders in
   no column, which reads as "it didn't save" to anyone looking at the board. */
async function moveTaskToStage(env, taskId) {
  const workflowId = env.TEAMWORK_WORKFLOW_ID || DEFAULT_WORKFLOW_ID;
  const stageId    = env.TEAMWORK_STAGE_ID    || DEFAULT_STAGE_ID;

  try {
    const res = await fetch(
      `${TEAMWORK_SITE}/projects/api/v3/workflows/${workflowId}/stages/${stageId}/tasks.json`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${btoa(env.TEAMWORK_API_KEY + ':xxx')}`,
        },
        body: JSON.stringify({ taskIds: [Number(taskId)] }),
      }
    );
    if (!res.ok) {
      const err = await res.text();
      return { ok: false, stage_id: stageId, status: res.status, error: err.slice(0, 300) };
    }
    return { ok: true, stage_id: stageId };
  } catch (err) {
    return { ok: false, stage_id: stageId, error: String(err && err.message || err) };
  }
}

export default {
  async fetch(request, env) {
    try {
      return await handle(request, env);
    } catch (err) {
      console.error('Unhandled worker error:', err && err.stack || err);
      return json({ error: `Server error: ${err && err.message || 'unknown'}` }, 500);
    }
  },
};

async function handle(request, env) {
  const url = new URL(request.url);

  if (request.method === 'OPTIONS') {
    return new Response(null, { headers: CORS });
  }

  // POST /api/chat — proxy to Claude, streamed
  if (url.pathname === '/api/chat' && request.method === 'POST') {
    const { messages } = await request.json();

    // Anthropic requires system prompt as a top-level field, not a messages role
    const systemMsg = messages.find(m => m.role === 'system');
    const filteredMessages = messages.filter(m => m.role !== 'system');

    const body = {
      model: env.CLAUDE_MODEL || DEFAULT_MODEL,
      max_tokens: MAX_TOKENS,
      stream: true,
      messages: filteredMessages,
    };
    if (systemMsg) body.system = systemMsg.content;

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    });

    /* Errors still arrive as one JSON body. Unwrap Claude's own message rather
       than handing the page an object it can only render as "Error <status>" —
       the reason a request failed is the whole point of showing an error. */
    if (!res.ok || !res.body) {
      const detail = await res.text();
      let message = detail.slice(0, 500);
      try { message = JSON.parse(detail).error?.message || message; } catch (_) {}
      return json({ error: { message: `Claude API ${res.status}: ${message}` } }, res.status);
    }

    /* Pass the SSE stream straight through. Bytes start flowing immediately, so
       neither the browser nor Cloudflare gives up on a turn that takes minutes. */
    return new Response(res.body, {
      headers: {
        'Content-Type': 'text/event-stream; charset=utf-8',
        'Cache-Control': 'no-cache, no-transform',
        'X-Accel-Buffering': 'no',
        ...CORS,
      },
    });
  }

  /* POST /api/progress — the candidate's answers, saved as they are given.

     Everything that has gone wrong with this portal has the same shape: a
     25-minute assessment existed only in the candidate's browser until a single
     moment at the end, and anything that disturbed that moment destroyed the
     work. Truncated report, timed-out report, rejected save, tab closed while
     saving — four different causes, one outcome, and two real candidates lost.

     Each of those was fixed in turn and a new one appeared, because the fixes
     kept protecting the moment instead of removing it. There is now no moment:
     the transcript reaches the server after every answer, so the closing report
     is an enrichment of a record that already exists. If everything at the end
     fails, the answers are still here and the report can be regenerated.

     Rows written here carry status 'in_progress' until /api/submit completes
     them. No Teamwork card is filed for one — an unfinished assessment is not a
     candidate to review, but it is worth not losing. */
  if (url.pathname === '/api/progress' && request.method === 'POST') {
    const body = scrubForJsonb(await request.json());
    const code = body.completion_code;
    if (!code) return json({ error: 'Missing completion code' }, 400);

    const claim = body.claim === true;
    const row = {
      completion_code: code,
      assessment_type: body.assessment_type || 'assessment',
      candidate_name:  body.candidate_name || 'Unknown',
      candidate_email: body.candidate_email || null,
      referral_source: body.referral_source || null,
      report_json: {
        status: 'in_progress',
        answered: body.answered || 0,
        transcript: Array.isArray(body.transcript) ? body.transcript : [],
        started_at: body.started_at || null,
        last_seen_at: new Date().toISOString(),
      },
      submitted_at: new Date().toISOString(),
    };

    const res = await saveReport(env, row, { claim });

    /* Only a claim can collide, and only then does the page need to act. */
    if (claim && res.status === 409) return json({ error: 'Code already taken', taken: true }, 409);

    if (!res.ok) {
      const err = await res.text();
      console.error('Progress save failed:', res.status, err);
      return json({ error: `Progress save failed (${res.status})`, detail: err.slice(0, 300) }, 500);
    }
    return json({ ok: true, code });
  }

  // POST /api/submit — save report to Supabase + create Teamwork task
  if (url.pathname === '/api/submit' && request.method === 'POST') {
    const report = scrubForJsonb(await request.json());
    let code = report.completion_code;
    const candidateName = report.candidate_name || 'Unknown';
    const assessmentType = inferAssessmentType(report);
    const score = report.overall_score ?? report.score ?? null;

    if (!code) return json({ error: 'Missing completion code' }, 400);

    const row = () => ({
      completion_code: code,
      assessment_type: assessmentType,
      candidate_name: candidateName,
      candidate_email: report.candidate_email || null,
      referral_source: report.referral_source || null,
      score: score,
      report_json: { ...report, completion_code: code, teamwork, status: 'complete' },
      submitted_at: new Date().toISOString(),
    });

    // Teamwork first, so whether it worked is recorded on the report itself.
    // A Teamwork failure must never cost us the report, so it can only ever warn.
    const teamwork = await createTeamworkTask(env, { code, candidateName, assessmentType, score, report });
    if (!teamwork.ok) console.warn('Teamwork task failed:', teamwork.error);
    else if (teamwork.stage && !teamwork.stage.ok) console.warn('Teamwork stage move failed:', teamwork.stage.error);

    /* Save to Supabase.

       No 409 retry here any more: this is an upsert on completion_code, meant
       to land on the row the candidate's progress saves have been building. The
       code comes from the page's own 34-billion keyspace and is claimed on the
       server at the start of the session, so a collision is caught there. */
    let supaRes = await saveReport(env, row());

    /* The upsert needs a unique index on completion_code. It is supposed to be
       there — but this README once named the wrong Supabase project entirely,
       and a report that reaches the end of a 25-minute assessment is not the
       place to find out a schema assumption was wrong. Postgres 42P10 is
       exactly that case ("no unique or exclusion constraint matching the ON
       CONFLICT specification"), so fall back to the plain insert this route
       used before, and to a suffixed code if the row is genuinely already
       there. Submitting can then never be worse than it was. */
    if (!supaRes.ok) {
      const first = await supaRes.text();
      if (/42P10|ON CONFLICT|no unique or exclusion constraint/i.test(first)) {
        console.error('Supabase upsert unsupported, falling back to insert:', first);
        supaRes = await saveReport(env, row(), { claim: true });
        if (supaRes.status === 409) {
          code = `${code}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
          console.warn('Code already stored; saving under', code);
          supaRes = await saveReport(env, row(), { claim: true });
        }
      } else {
        supaRes = new Response(first, { status: supaRes.status });
      }
    }

    if (!supaRes.ok) {
      const err = await supaRes.text();
      console.error('Supabase save failed:', supaRes.status, err);
      return json({ error: `Failed to save report (${supaRes.status})`, detail: err.slice(0, 300) }, 500);
    }

    // Return the code actually stored — it may have been suffixed above
    return json({ ok: true, code, teamwork });
  }

  /* POST /api/rescue — the last line of defence.

     Every failure this portal has had ends the same way: a candidate finishes a
     25-minute assessment whose only copy is in their browser, one HTTP call at
     the very end fails, and the work is gone with nobody the wiser. Retrying and
     stashing locally (see the assessment pages) covers the candidate who comes
     back. This covers the one who doesn't.

     Teamwork and Supabase fail independently, so when Supabase will not take the
     report we put the candidate's answers — in full — on the board that MBN
     actually watches, along with the error Supabase returned. That turns a
     silent loss into a visible card someone can act on, and it finally carries
     the error message out of the Cloudflare log where nobody could read it. */
  if (url.pathname === '/api/rescue' && request.method === 'POST') {
    const body = scrubForJsonb(await request.json());
    const report = body.report || {};
    const code = report.completion_code || 'no code';
    const name = report.candidate_name || 'Unknown candidate';

    const transcript = Array.isArray(report.transcript) ? report.transcript : [];
    const answers = transcript
      .map(m => `${m.role === 'assistant' ? 'INTERVIEWER' : 'CANDIDATE'}:\n${m.content}`)
      .join('\n\n');

    const description = [
      'THIS ASSESSMENT COULD NOT BE SAVED TO THE DATABASE.',
      'The candidate completed it. Their answers are reproduced below in full,',
      'because this card may be the only remaining copy. Do not delete it until',
      'the report has been recovered.',
      '',
      `Candidate: ${name}`,
      `Email: ${report.candidate_email || 'Not provided'}`,
      `Assessment: ${report.assessment_type || 'unknown'}`,
      `Completion code shown to them: ${code}`,
      `Failed at: ${new Date().toISOString()}`,
      '',
      `Error reported by the server: ${String(body.error || 'not recorded')}`,
      '',
      '──────── FULL TRANSCRIPT ────────',
      answers || '(no transcript captured)',
    ].join('\n').slice(0, 60000);   // keep the request comfortably inside limits

    const card = await fileTeamworkCard(env, `⚠️ SUBMISSION FAILED — ${name} — ${code}`, description);
    if (!card.ok) console.error('Rescue card failed too:', card.error);
    return json({ ok: card.ok, teamwork: card });
  }

  /* GET /api/reports — list recent submissions, newest first.

     Until now the only way into a report was an exact completion code, so one
     mistyped character was indistinguishable from the assessment never having
     saved. That has twice sent people hunting for a bug that wasn't there, and
     once left a real candidate unreachable because the code they quoted didn't
     match the code that was stored. Codes come from the model and cluster
     tightly around the example in the prompt (MBN-8K2R, MBN-9K2R, MBN-9T3K),
     which makes the confusion easy.

     Deliberately does not return report_json: this is a directory, not a bulk
     export, and the per-code route already serves the full record. */
  if (url.pathname === '/api/reports' && request.method === 'GET') {
    if (request.headers.get('X-Admin-Passcode') !== env.ADMIN_PASSCODE) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const limit = Math.min(Number(url.searchParams.get('limit')) || 50, 200);
    const BASE = 'completion_code,candidate_name,candidate_email,assessment_type,score,submitted_at';
    const headers = {
      apikey: env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
    };
    const list = select => fetch(
      `${env.SUPABASE_URL}/rest/v1/assessment_reports` +
      `?select=${encodeURIComponent(select)}&order=submitted_at.desc&limit=${limit}`,
      { headers }
    );

    /* Pulls status out of report_json so the list can mark an assessment as
       still in progress. If this PostgREST build won't alias a JSON key, fall
       back to the plain columns rather than losing the whole list: a directory
       without the in-progress flag is still far better than no directory, and
       no directory is what left a real candidate unreachable. */
    let res = await list(`${BASE},status:report_json->>status`);
    if (!res.ok) {
      console.warn('Supabase list: status alias rejected, retrying without it');
      res = await list(BASE);
    }

    if (!res.ok) {
      const err = await res.text();
      console.error('Supabase list failed:', res.status, err);
      return json({ error: `Lookup failed (${res.status})`, detail: err.slice(0, 300) }, 500);
    }

    const rows = await res.json();
    return json({ ok: true, count: Array.isArray(rows) ? rows.length : 0, reports: rows });
  }

  // GET /api/report/:code — retrieve report for reviewer dashboard
  if (url.pathname.startsWith('/api/report/') && request.method === 'GET') {
    const passcode = request.headers.get('X-Admin-Passcode');
    if (passcode !== env.ADMIN_PASSCODE) {
      return json({ error: 'Unauthorized' }, 401);
    }

    const code = decodeURIComponent(url.pathname.replace('/api/report/', ''));

    const res = await fetch(
      `${env.SUPABASE_URL}/rest/v1/assessment_reports?completion_code=eq.${encodeURIComponent(code)}&select=*&limit=1`,
      {
        headers: {
          apikey: env.SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
        },
      }
    );

    if (!res.ok) {
      const err = await res.text();
      console.error('Supabase read failed:', res.status, err);
      return json({ error: `Lookup failed (${res.status})` }, 500);
    }

    const rows = await res.json();
    if (!Array.isArray(rows) || !rows.length) return json({ error: 'Not found' }, 404);

    /* Column values win over anything stale inside the stored JSON blob.
       They also carry an in-progress record on their own: a candidate who has
       not submitted yet has no report to spread, so their name and email exist
       only as columns and the reviewer would otherwise open a nameless row. */
    const row = rows[0];
    const col = {
      completion_code: row.completion_code,
      submitted_at: row.submitted_at,
      candidate_name: row.candidate_name,
      candidate_email: row.candidate_email,
      referral_source: row.referral_source,
      assessment_type: row.assessment_type,
      score: row.score,
    };
    for (const k of Object.keys(col)) if (col[k] === null || col[k] === undefined) delete col[k];
    return json({ ...(row.report_json || {}), ...col });
  }

  // Static assets
  return env.ASSETS.fetch(request);
}
