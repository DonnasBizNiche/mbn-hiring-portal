/**
 * MBN Hiring Portal — completion sequencing check
 * ————————————————————————————————————————————————————————————————
 *   node tools/check-completion.mjs
 *
 * Verifies the completion screen never tells a candidate they are finished
 * before the server has their report.
 *
 * WHY IT EXISTS
 *   A real candidate was lost to exactly this. The completion code appeared the
 *   instant the interview ended — before the save had been attempted. They
 *   copied it and closed the tab, which cancelled the save, its retries and the
 *   rescue card all at once. No database row, no Teamwork card, no warning, and
 *   a candidate holding a code that matched nothing.
 *
 *   Every other test passed throughout, because a script sits and waits for the
 *   save. A person reads "Assessment Complete", takes the code and leaves. This
 *   test holds the save open and asserts the screen still says "Filing…".
 *
 *   Run it against the pre-fix commit and the first four checks fail.
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

  const listeners = [];
  const store = {};
  const holder = { impl: async () => ({ ok: true, json: async () => ({}), body: null, status: 200 }) };
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
    setTimeout, clearTimeout, setInterval, clearInterval,
    console: { log(){}, warn(){}, error(){} },
    Blob: class {}, URL: { createObjectURL: () => '', revokeObjectURL(){} },
    TextDecoder, TextEncoder, Response, Request,
    alert(){}, confirm: () => false,
  };
  sandbox.window = {
    addEventListener: (t, fn) => listeners.push({ t, fn }),
    removeEventListener: (t, fn) => { const i = listeners.findIndex(l => l.t === t && l.fn === fn); if (i >= 0) listeners.splice(i, 1); },
    QUESTION_BANKS: {},
  };
  Object.assign(sandbox.window, sandbox);
  sandbox.globalThis = sandbox;

  const names = Object.keys(sandbox);
  const run = new Function(...names, `"use strict";\n${body}\n; return { complete, S, DONE_TEXT: (typeof DONE_TEXT === "undefined" ? null : DONE_TEXT) };`);
  const api = run(...names.map(n => sandbox[n]));
  return { ...api, getEl, listeners, sandbox, store, holder };
}

for (const file of (process.argv.slice(2).length ? process.argv.slice(2) : ['seo-strategist.html', 'technical-seo.html'])) {
  console.log(`\n── ${file} ──`);
  const page = loadPage(file);
  page.S.code = 'MBN-TEST';
  page.S.messages = [];
  page.S.candidate = { name: 'Real Candidate', email: 'r@x.com', source: '' };

  // a save that we control the timing of
  let release;
  const inFlight = new Promise(res => { release = res; });
  page.holder.impl = async () => { await inFlight; return { ok: true, status: 200, json: async () => ({ ok: true, code: 'MBN-TEST' }) }; };

  const done = page.complete();
  await new Promise(r => setImmediate(r));   // let complete() reach the await

  // THE POINT OF THIS TEST
  check('code is NOT shown while the save is in flight',
    page.getEl('cpCode').textContent !== 'MBN-TEST', page.getEl('cpCode').textContent);
  check('screen says filing, not finished',
    /filing|Filing/.test(page.getEl('cpCode').textContent), page.getEl('cpCode').textContent);
  check('sub-text asks them to keep the tab open',
    /keep this tab open/i.test(page.getEl('cpSub').textContent), page.getEl('cpSub').textContent);
  check('tab-close guard is armed while in flight',
    page.listeners.some(l => l.t === 'beforeunload'), JSON.stringify(page.listeners.map(l => l.t)));

  release();
  await done;

  check('code IS shown once the server confirms',
    page.getEl('cpCode').textContent === 'MBN-TEST', page.getEl('cpCode').textContent);
  check('success copy restored', page.getEl('cpSub').textContent === page.DONE_TEXT);
  check('tab-close guard released after', !page.listeners.some(l => l.t === 'beforeunload'));

  // failure path: code shown, but clearly not registered, and guard released
  const p2 = loadPage(file);
  p2.S.code = 'MBN-FAIL';
  p2.S.messages = [];
  p2.S.candidate = { name: 'Real Candidate', email: 'r@x.com', source: '' };
  p2.holder.impl = async () => ({ ok: false, status: 500, json: async () => ({ error: 'Failed to save report (500)' }) });

  await p2.complete();
  check('on failure the code is still shown for matching',
    p2.getEl('cpCode').textContent === 'MBN-FAIL', p2.getEl('cpCode').textContent);
  check('on failure the hint says it is not registered',
    /not yet registered/i.test(p2.getEl('cpHint').textContent), p2.getEl('cpHint').textContent);
  check('on failure the guard is released too',
    !p2.listeners.some(l => l.t === 'beforeunload'));
  check('on failure the report is stashed for recovery',
    Object.keys(p2.store).some(k => /unsent/.test(k)), JSON.stringify(Object.keys(p2.store)));
}

console.log(fail ? `\n${fail} FAILURES` : '\nall green');
process.exit(fail ? 1 : 0);
