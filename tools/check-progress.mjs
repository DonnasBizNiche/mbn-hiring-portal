/**
 * MBN Hiring Portal — incremental save check
 * ————————————————————————————————————————————————————————————————
 *   node tools/check-progress.mjs
 *
 * Asserts the candidate's answers reach the server DURING the assessment,
 * not only at the end.
 *
 * WHY IT EXISTS
 *   A 25-minute assessment used to exist only in the candidate's browser until
 *   a single request at the very end. Four separate bugs destroyed real work
 *   through that one moment — a report truncated at max_tokens, a report
 *   request dropped unstreamed, a completion code shown before the save
 *   finished, and a tab closed while the save was still in flight. Each was
 *   fixed and the next appeared, because the fixes protected the moment
 *   instead of removing it.
 *
 *   This checks the moment is gone: answers are on the server as they are
 *   given, and nothing in that path can stall the interview.
 */
import fs from 'node:fs';

let fail = 0;
const check = (n, c, x = '') => { console.log((c ? 'PASS  ' : 'FAIL  ') + n + (c ? '' : '  ' + x)); if (!c) fail++; };

function loadPage(file) {
  const html = fs.readFileSync(file, 'utf8');
  const body = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]).pop();

  const els = new Map();
  const makeEl = id => ({
    id, style: {}, value: '', textContent: '', innerHTML: '', disabled: false,
    scrollTop: 0, scrollHeight: 0,
    classList: { _s: new Set(), add(c){this._s.add(c);}, remove(c){this._s.delete(c);},
                 contains(c){return this._s.has(c);}, toggle(){} },
    addEventListener(){}, removeEventListener(){}, appendChild(){}, remove(){},
    querySelector: () => makeEl('q'), querySelectorAll: () => [],
    focus(){}, click(){}, setAttribute(){}, getAttribute: () => null,
  });
  const getEl = id => { if (!els.has(id)) els.set(id, makeEl(id)); return els.get(id); };

  const store = {};
  const calls = [];
  const holder = {
    impl: async (u, init) => {
      calls.push({ url: String(u), body: init && init.body ? JSON.parse(init.body) : null,
                   signal: init && init.signal });
      return { ok: true, status: 200, json: async () => ({ ok: true }), body: null };
    },
  };
  const sandbox = {
    document: { getElementById: getEl, createElement: () => makeEl('new'),
                querySelector: () => makeEl('q'), querySelectorAll: () => [],
                addEventListener(){}, body: makeEl('body') },
    localStorage: { getItem: k => (k in store ? store[k] : null),
                    setItem: (k,v) => { store[k] = String(v); },
                    removeItem: k => { delete store[k]; } },
    location: { origin: 'https://t.test', pathname: '/x' },
    fetch: (...a) => holder.impl(...a),
    navigator: { userAgent: 't' },
    AbortController, setTimeout, clearTimeout, setInterval, clearInterval,
    console: { log(){}, warn(){}, error(){} },
    Blob: class {}, URL: { createObjectURL: () => '', revokeObjectURL(){} },
    TextDecoder, TextEncoder, Response, Request,
    alert(){}, confirm: () => false,
  };
  sandbox.window = { addEventListener(){}, removeEventListener(){}, QUESTION_BANKS: {} };
  Object.assign(sandbox.window, sandbox);
  sandbox.globalThis = sandbox;

  const names = Object.keys(sandbox);
  const run = new Function(...names,
    `"use strict";\n${body}\n; return { S, start, send, claimCode, saveProgressToServer, genCode,
       ASSESSMENT_TYPE: (typeof ASSESSMENT_TYPE === "undefined" ? null : ASSESSMENT_TYPE) };`);
  return { ...run(...names.map(n => sandbox[n])), getEl, calls, holder, store };
}

const progressCalls = p => p.calls.filter(c => c.url.includes('/api/progress'));

for (const file of ['seo-strategist.html', 'technical-seo.html']) {
  console.log(`\n── ${file} ──`);

  // ── the code is claimed before the first question ─────────────────────
  let page = loadPage(file);
  page.getEl('inName').value = 'Real Candidate';
  page.getEl('inEmail').value = 'r@x.com';
  // stop start() at the interview itself; we only care about the claim
  page.holder.impl = async (u, init) => {
    page.calls.push({ url: String(u), body: init && init.body ? JSON.parse(init.body) : null });
    if (String(u).includes('/api/chat')) throw new Error('stop');
    return { ok: true, status: 200, json: async () => ({ ok: true }) };
  };
  await page.start().catch(() => {});

  const claim = progressCalls(page)[0];
  check('a code is claimed on the server before the interview starts', !!claim);
  check('the claim is marked as one', claim && claim.body.claim === true);
  check('the claim carries the candidate', claim && claim.body.candidate_name === 'Real Candidate',
    claim && claim.body.candidate_name);
  check('the claim names the assessment', claim && !!claim.body.assessment_type, claim && claim.body.assessment_type);
  check('the page keeps the code it claimed', page.S.code === claim.body.completion_code,
    `${page.S.code} vs ${claim && claim.body.completion_code}`);

  // ── every answer is saved as it is given ──────────────────────────────
  page = loadPage(file);
  page.S.code = 'MBN-TEST';
  page.S.candidate = { name: 'Real Candidate', email: 'r@x.com', source: '' };
  page.S.messages = [{ role: 'system', content: 's' }];
  page.holder.impl = async (u, init) => {
    page.calls.push({ url: String(u), body: init && init.body ? JSON.parse(init.body) : null });
    if (String(u).includes('/api/chat')) throw new Error('stop');
    return { ok: true, status: 200, json: async () => ({ ok: true }) };
  };
  for (let i = 1; i <= 3; i++) {
    page.getEl('uInp').value = `answer ${i}`;
    await page.send().catch(() => {});
  }
  const saves = progressCalls(page);
  check('each answer is saved to the server', saves.length === 3, `${saves.length} saves for 3 answers`);
  check('saves go against the claimed code', saves.every(c => c.body.completion_code === 'MBN-TEST'));
  check('the transcript grows with each save',
    saves[saves.length - 1] && saves[saves.length - 1].body.transcript.length >= 3,
    saves.length ? JSON.stringify(saves[saves.length - 1].body.transcript.length) : 'none');
  check('progress saves never claim', saves.every(c => c.body.claim !== true));

  // ── the interview must not depend on any of this ──────────────────────
  // A server that accepts the connection and never answers is the worst case:
  // it is indistinguishable from a slow one, and an unbounded wait would leave
  // the candidate looking at an empty screen.
  page = loadPage(file);
  page.getEl('inName').value = 'Real Candidate';
  page.getEl('inEmail').value = 'r@x.com';
  let reachedInterview = false;
  page.holder.impl = (u, init) => {
    if (String(u).includes('/api/chat')) { reachedInterview = true; throw new Error('stop'); }
    return new Promise((_, rej) => {
      if (init && init.signal) init.signal.addEventListener('abort', () => rej(new Error('aborted')));
    });
  };
  const started = page.start().catch(() => {});
  await Promise.race([started, new Promise(r => setTimeout(r, 30000))]);
  check('a hung progress server still lets the interview begin', reachedInterview);
  check('and the candidate still gets a usable code', /^[A-Z0-9]{3}-[A-Z0-9]{4}$/.test(page.S.code || ''), page.S.code);

  // A failing server must not surface to the candidate at all.
  page = loadPage(file);
  page.S.code = 'MBN-TEST';
  page.S.candidate = { name: 'Real Candidate', email: '', source: '' };
  page.S.messages = [{ role: 'system', content: 's' }];
  page.holder.impl = async u => {
    if (String(u).includes('/api/chat')) throw new Error('stop');
    throw new Error('network down');
  };
  let threw = null;
  try { await page.saveProgressToServer(); } catch (e) { threw = e; }
  check('a failed progress save is swallowed, not thrown at the candidate', threw === null, threw && threw.message);
}

console.log(fail ? `\n${fail} FAILURES` : '\nall green');
process.exit(fail ? 1 : 0);
