/**
 * MBN Hiring Portal — worker data-layer check
 * ————————————————————————————————————————————————————————————————
 *   node tools/check-worker.mjs
 *
 * Exercises the worker's storage routes against a stand-in for the table, so
 * the behaviour the portal depends on is asserted rather than assumed. Nothing
 * here touches the real database.
 *
 * WHY IT EXISTS
 *   Every failure this portal has had came down to a candidate's 25 minutes of
 *   work existing in one place, at one moment, at the very end. The routes
 *   below are what makes that untrue — a row that exists from the first
 *   question and accumulates with every answer — so they are load-bearing and
 *   need checking like anything else.
 *
 * There is no package.json, so _worker.js is copied to a .mjs and imported.
 */
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const tmp = path.join(os.tmpdir(), `mbn-worker-${process.pid}.mjs`);
fs.writeFileSync(tmp, fs.readFileSync(new URL('../_worker.js', import.meta.url), 'utf8'));
process.on('exit', () => { try { fs.unlinkSync(tmp); } catch (_) {} });
const worker = (await import('file://' + tmp)).default;

let fail = 0;
const check = (n, c, x = '') => { console.log((c ? 'PASS  ' : 'FAIL  ') + n + (c ? '' : '  ' + x)); if (!c) fail++; };
console.error = () => {};   // the worker logs its own failures; the test asserts them
console.warn  = () => {};

const env = {
  SUPABASE_URL: 'https://s', SUPABASE_SERVICE_KEY: 'sk',
  ADMIN_PASSCODE: 'p', TEAMWORK_API_KEY: 'tw',
};
const post = (p, body) => new Request('https://x' + p, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
});

/* A stand-in for assessment_reports, so we can assert the row really does
   accumulate instead of one row per answer piling up. */
function mockSupabase() {
  const rows = new Map();
  const calls = [];
  globalThis.fetch = async (u, init) => {
    const url = String(u);
    if (url.includes('teamwork')) { calls.push({ teamwork: true }); return new Response('{"id":"1"}', { status: 200 }); }
    if (url.includes('/stages/')) return new Response('{}', { status: 200 });

    const body = JSON.parse(init.body);
    const upsert = url.includes('on_conflict=completion_code');
    calls.push({ upsert, code: body.completion_code });

    if (!upsert && rows.has(body.completion_code)) {
      return new Response('duplicate key value violates unique constraint', { status: 409 });
    }
    rows.set(body.completion_code, body);
    return new Response('', { status: 201 });
  };
  return { rows, calls };
}

/* ── a whole assessment, answer by answer ───────────────────────────────── */
console.log('\n── an assessment in progress ──');
let db = mockSupabase();

let r = await worker.fetch(post('/api/progress', {
  claim: true, completion_code: 'ABC-1234', assessment_type: 'seo_strategist',
  candidate_name: 'Jonathan', candidate_email: 'j@x.com', answered: 0, transcript: [],
}), env);
check('claim creates the row', r.status === 200 && db.rows.has('ABC-1234'));
check('claim uses a plain insert, so a taken code collides', db.calls[0].upsert === false);
check('row starts as in_progress', db.rows.get('ABC-1234').report_json.status === 'in_progress');

for (let i = 1; i <= 10; i++) {
  await worker.fetch(post('/api/progress', {
    completion_code: 'ABC-1234', assessment_type: 'seo_strategist', candidate_name: 'Jonathan',
    answered: i, transcript: Array.from({ length: i }, (_, k) => ({ role: 'user', content: `answer ${k + 1}` })),
  }), env);
}
check('ten answers update one row, not ten rows', db.rows.size === 1, `${db.rows.size} rows`);
check('the transcript accumulates on the server',
  db.rows.get('ABC-1234').report_json.transcript.length === 10,
  String(db.rows.get('ABC-1234').report_json.transcript.length));
check('progress saves upsert', db.calls.slice(1).every(c => c.upsert === true));
check('no Teamwork card for an unfinished assessment', !db.calls.some(c => c.teamwork));

/* THE POINT: the closing report lands on the row that already exists. */
r = await worker.fetch(post('/api/submit', {
  completion_code: 'ABC-1234', candidate_name: 'Jonathan', assessment_type: 'seo_strategist',
  overall_score: 82, transcript: Array.from({ length: 10 }, (_, k) => ({ role: 'user', content: `answer ${k + 1}` })),
  question_reviews: [{ id: 's1_background', answer: 'x' }],
}), env);
const final = db.rows.get('ABC-1234');
check('submit succeeds', r.status === 200, r.status);
check('still exactly one row for this candidate', db.rows.size === 1, `${db.rows.size} rows`);
check('the row is now marked complete', final.report_json.status === 'complete', final.report_json.status);
check('score recorded on completion', final.score === 82, final.score);
check('question reviews present after completion', Array.isArray(final.report_json.question_reviews));

/* ── the failure that started all this ──────────────────────────────────── */
console.log('\n── a candidate who never submits ──');
db = mockSupabase();
await worker.fetch(post('/api/progress', {
  claim: true, completion_code: 'XYZ-9999', candidate_name: 'Lost Candidate',
  assessment_type: 'seo_strategist', answered: 0, transcript: [],
}), env);
for (let i = 1; i <= 10; i++) {
  await worker.fetch(post('/api/progress', {
    completion_code: 'XYZ-9999', candidate_name: 'Lost Candidate', answered: i,
    transcript: Array.from({ length: i }, (_, k) => ({ role: 'user', content: `real answer ${k + 1}` })),
  }), env);
}
const stranded = db.rows.get('XYZ-9999');
check('tab closed before submitting → the answers are still on the server',
  stranded.report_json.transcript.length === 10, String(stranded.report_json.transcript.length));
check('and they are identifiable by name', stranded.candidate_name === 'Lost Candidate');
check('and flagged unfinished rather than passing as complete',
  stranded.report_json.status === 'in_progress');

r = await worker.fetch(post('/api/progress', {
  claim: true, completion_code: 'XYZ-9999', candidate_name: 'Someone Else', answered: 0, transcript: [],
}), env);
check('a claim on a taken code returns 409 so the page picks another', r.status === 409, r.status);
check('and does not overwrite the candidate already using it',
  db.rows.get('XYZ-9999').candidate_name === 'Lost Candidate', db.rows.get('XYZ-9999').candidate_name);

r = await worker.fetch(post('/api/progress', { transcript: [] }), env);
check('a progress save with no code is refused', r.status === 400);

globalThis.fetch = async () => new Response('permission denied', { status: 403 });
r = await worker.fetch(post('/api/progress', { completion_code: 'A', transcript: [] }), env);
check('a storage failure surfaces the reason rather than a bare 500',
  r.status === 500 && /permission denied/.test((await r.json()).detail || ''));

/* ── the reviewer's directory ───────────────────────────────────────────── */
console.log('\n── the reviewer directory ──');
const listReq = () => new Request('https://x/api/reports', { headers: { 'X-Admin-Passcode': 'p' } });

let urls = [];
globalThis.fetch = async u => { urls.push(String(u)); return new Response('[{"completion_code":"A","status":"complete"}]', { status: 200 }); };
r = await worker.fetch(listReq(), env);
let b = await r.json();
check('the list asks for status so unfinished ones can be marked',
  /status%3Areport_json|status:report_json/.test(urls[0]), urls[0]);
check('one request when that works', urls.length === 1, urls.length);
check('rows come back', b.reports[0].status === 'complete');

/* If this PostgREST build won't alias a JSON key, a directory without the
   in-progress flag still beats no directory — no directory is what left a real
   candidate unreachable. */
urls = [];
globalThis.fetch = async u => {
  urls.push(String(u));
  if (/report_json/.test(decodeURIComponent(String(u)))) return new Response('{"message":"unknown"}', { status: 400 });
  return new Response('[{"completion_code":"A"}]', { status: 200 });
};
r = await worker.fetch(listReq(), env);
b = await r.json();
check('a rejected alias falls back instead of breaking the list', urls.length === 2, urls.length);
check('the fallback drops the alias', !/report_json/.test(decodeURIComponent(urls[1])), urls[1]);
check('the reviewer still gets their list', r.status === 200 && b.reports.length === 1, r.status);

globalThis.fetch = async () => new Response('permission denied', { status: 403 });
r = await worker.fetch(listReq(), env);
check('a genuinely broken lookup still reports the failure', r.status === 500, r.status);
check('with the reason attached', /permission denied/.test((await r.json()).detail || ''));

r = await worker.fetch(new Request('https://x/api/reports'), env);
check('the directory needs the passcode', r.status === 401, r.status);

/* ── opening one record ─────────────────────────────────────────────────── */
console.log('\n── opening a record ──');
const get = code => worker.fetch(
  new Request('https://x/api/report/' + code, { headers: { 'X-Admin-Passcode': 'p' } }), env);

globalThis.fetch = async () => new Response(JSON.stringify([{
  completion_code: 'XYZ-9999', candidate_name: 'Lost Candidate', candidate_email: 'l@x.com',
  assessment_type: 'seo_strategist', score: null, submitted_at: '2026-09-11T00:00:00Z',
  report_json: { status: 'in_progress', answered: 7, transcript: [{ role: 'user', content: 'their real answer' }] },
}]), { status: 200 });
r = await get('XYZ-9999'); b = await r.json();
check('an unfinished record opens', r.status === 200);
/* An unfinished candidate has no report to spread, so their name exists only
   as a column — without it the reviewer opens a nameless row. */
check('the reviewer can see who it is', b.candidate_name === 'Lost Candidate', b.candidate_name);
check('and how to reach them', b.candidate_email === 'l@x.com', b.candidate_email);
check('it is flagged unfinished', b.status === 'in_progress', b.status);
check('their answers are there to read', b.transcript.length === 1);
check('no score is invented for it', b.score == null, b.score);

globalThis.fetch = async () => new Response(JSON.stringify([{
  completion_code: 'ABC-1234', candidate_name: 'Saba', candidate_email: 's@x.com',
  assessment_type: 'seo_strategist', score: 82, submitted_at: '2026-09-11T06:44:00Z',
  report_json: { status: 'complete', candidate_name: 'Saba', overall_score: 82,
                 question_reviews: [{ id: 's1_background', answer: 'x' }] },
}]), { status: 200 });
r = await get('ABC-1234'); b = await r.json();
check('a completed record still renders in full', b.question_reviews.length === 1);
check('marked complete', b.status === 'complete', b.status);
check('with its score', b.score === 82, b.score);

globalThis.fetch = async () => new Response('[]', { status: 200 });
check('a code that truly is not there still 404s', (await get('NOPE')).status === 404);

/* ── jsonb safety ───────────────────────────────────────────────────────── */
console.log('\n── what Postgres will not store ──');
// Built from char codes so no literal control characters appear in this file.
const NUL = String.fromCharCode(0);
const HI = String.fromCharCode(0xD800);   // lone high surrogate
const LO = String.fromCharCode(0xDC00);   // lone low surrogate

let sent;
globalThis.fetch = async (u, init) => {
  if (String(u).includes('teamwork')) return new Response('{"id":"1"}', { status: 200 });
  if (String(u).includes('stages')) return new Response('{}', { status: 200 });
  sent = JSON.parse(init.body);
  return new Response('', { status: 201 });
};
await worker.fetch(post('/api/submit', {
  completion_code: 'MBN-8K2R',
  candidate_name: 'Real' + NUL + ' Candidate',
  transcript: [{ role: 'user', content: 'pasted from Word' + NUL + ' with a lone ' + HI + ' surrogate' }],
  question_reviews: [{ id: 's1_background', answer: 'trailing ' + LO + ' surrogate' }],
}), env);
const blob = JSON.stringify(sent);
check('NUL stripped everywhere', !blob.includes(NUL));
check('lone high surrogate stripped', !/[\uD800-\uDBFF](?![\uDC00-\uDFFF])/.test(blob));
check('lone low surrogate stripped', !/(^|[^\uD800-\uDBFF])[\uDC00-\uDFFF]/.test(blob));
check('the name is otherwise intact', sent.candidate_name === 'Real Candidate', sent.candidate_name);
check('nested question_reviews scrubbed', !/[\uD800-\uDFFF]/.test(sent.report_json.question_reviews[0].answer));

// A real emoji is a VALID surrogate pair and must survive untouched.
await worker.fetch(post('/api/submit', { completion_code: 'X', candidate_name: 'Emoji \u{1F3AF} test' }), env);
check('valid surrogate pairs survive', sent.candidate_name === 'Emoji \u{1F3AF} test', sent.candidate_name);

console.log(fail ? `\n${fail} FAILURES` : '\nall green');
process.exit(fail ? 1 : 0);
