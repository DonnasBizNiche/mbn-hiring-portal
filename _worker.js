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
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_KEY   (service role key — needed to bypass RLS for reads)
 *   TEAMWORK_API_KEY
 *   TEAMWORK_TASKLIST_ID   (optional — defaults to DEFAULT_TASKLIST_ID below)
 *   TEAMWORK_WORKFLOW_ID   (optional — board the candidate card is filed on)
 *   TEAMWORK_STAGE_ID      (optional — board column the card lands in)
 *   ADMIN_PASSCODE         (shown on review page login)
 */

const MODEL = 'claude-opus-4-5';

/**
 * The closing turn of an assessment is a full JSON report that echoes back every
 * answer verbatim plus a written assessment of each one. On the 24-question
 * assessments that runs well past 4k tokens — and a report cut off mid-JSON is a
 * lost submission, because the page can't parse it and nothing reaches Supabase.
 * Keep this generous: it is a ceiling, not a target, so ordinary turns cost the same.
 */
const MAX_TOKENS = 16000;

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

async function saveReport(env, row) {
  return fetch(`${env.SUPABASE_URL}/rest/v1/assessment_reports`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: env.SUPABASE_SERVICE_KEY,
      Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      Prefer: 'return=minimal',
    },
    body: JSON.stringify(row),
  });
}

/* Teamwork Projects API v1. Returns an outcome rather than throwing — a failed
   card is worth knowing about, but never worth losing a candidate's report over. */
async function createTeamworkTask(env, { code, candidateName, assessmentType, score, report }) {
  const tasklistId = env.TEAMWORK_TASKLIST_ID || DEFAULT_TASKLIST_ID;

  if (!env.TEAMWORK_API_KEY) return { ok: false, error: 'TEAMWORK_API_KEY is not set' };

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

    let taskId = null;
    try { taskId = JSON.parse(body).id || null; } catch (_) {}
    if (!taskId) return { ok: true, tasklist_id: tasklistId, task_id: null, stage: { ok: false, error: 'No task id returned' } };

    const stage = await moveTaskToStage(env, taskId);
    return { ok: true, tasklist_id: tasklistId, task_id: taskId, stage };
  } catch (err) {
    return { ok: false, tasklist_id: tasklistId, error: String(err && err.message || err) };
  }
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

  // POST /api/chat — proxy to Claude
  if (url.pathname === '/api/chat' && request.method === 'POST') {
    const { messages } = await request.json();

    // Anthropic requires system prompt as a top-level field, not a messages role
    const systemMsg = messages.find(m => m.role === 'system');
    const filteredMessages = messages.filter(m => m.role !== 'system');

    const body = {
      model: MODEL,
      max_tokens: MAX_TOKENS,
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

    const data = await res.json();
    if (!res.ok) return json({ error: data }, res.status);
    return json(data);   // includes stop_reason — the page checks it
  }

  // POST /api/submit — save report to Supabase + create Teamwork task
  if (url.pathname === '/api/submit' && request.method === 'POST') {
    const report = await request.json();
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
      report_json: { ...report, completion_code: code, teamwork },
      submitted_at: new Date().toISOString(),
    });

    // Teamwork first, so whether it worked is recorded on the report itself.
    // A Teamwork failure must never cost us the report, so it can only ever warn.
    const teamwork = await createTeamworkTask(env, { code, candidateName, assessmentType, score, report });
    if (!teamwork.ok) console.warn('Teamwork task failed:', teamwork.error);
    else if (teamwork.stage && !teamwork.stage.ok) console.warn('Teamwork stage move failed:', teamwork.stage.error);

    // Save to Supabase
    let supaRes = await saveReport(env, row());

    // completion_code is UNIQUE. Claude picks the code, so a repeat is possible —
    // suffix it and retry rather than throwing the whole submission away.
    if (supaRes.status === 409) {
      const err = await supaRes.text();
      console.warn('Duplicate completion code, retrying with suffix:', code, err);
      const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
      let suffix = '';
      for (let i = 0; i < 2; i++) suffix += alphabet[Math.floor(Math.random() * alphabet.length)];
      code = `${code}${suffix}`;
      supaRes = await saveReport(env, row());
    }

    if (!supaRes.ok) {
      const err = await supaRes.text();
      console.error('Supabase save failed:', supaRes.status, err);
      return json({ error: `Failed to save report (${supaRes.status})`, detail: err.slice(0, 300) }, 500);
    }

    // Return the code actually stored — it may have been suffixed above
    return json({ ok: true, code, teamwork });
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

    // Column values win over anything stale inside the stored JSON blob
    const row = rows[0];
    return json({
      ...(row.report_json || {}),
      completion_code: row.completion_code,
      submitted_at: row.submitted_at,
    });
  }

  // Static assets
  return env.ASSETS.fetch(request);
}
