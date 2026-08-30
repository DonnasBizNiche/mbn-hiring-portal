/**
 * MBN Hiring Portal — page load check
 * ————————————————————————————————————————————————————————————————
 * Runs each assessment page's inline script the way a browser would, against a
 * minimal DOM stub, and fails if it throws. Then checks that every live
 * assessment defines the helpers the submission-failure path depends on.
 *
 *   node tools/check-pages.mjs *.html
 *
 * Run this before pushing any change to an assessment page.
 *
 * WHY IT EXISTS
 *   `node --check` only parses. It happily accepted a page that called
 *   resendUnsent() when no such function was ever defined — a broken page that
 *   shipped to production and threw a ReferenceError on every load. Executing
 *   the script catches that; parsing it does not.
 *
 *   The live-assessment list comes from assessments.js, so retiring or adding an
 *   assessment needs no edit here.
 */
import fs from 'node:fs';

const files = process.argv.slice(2);
let fail = 0;

function makeEl() {
  const el = {
    style: {}, dataset: {}, value: '', textContent: '', innerHTML: '',
    disabled: false, checked: false, scrollTop: 0, scrollHeight: 0,
    classList: { add() {}, remove() {}, contains: () => false, toggle() {} },
    addEventListener() {}, removeEventListener() {}, appendChild() {}, remove() {},
    querySelector: () => makeEl(), querySelectorAll: () => [],
    focus() {}, click() {}, setAttribute() {}, getAttribute: () => null,
  };
  return el;
}

for (const file of files) {
  const html = fs.readFileSync(file, 'utf8');
  const scripts = [...html.matchAll(/<script>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  const body = scripts[scripts.length - 1];

  const store = {};
  const sandbox = {
    document: {
      getElementById: () => makeEl(),
      createElement: () => makeEl(),
      querySelector: () => makeEl(),
      querySelectorAll: () => [],
      addEventListener() {},
      body: makeEl(),
    },
    window: {},
    localStorage: {
      getItem: k => (k in store ? store[k] : null),
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: k => { delete store[k]; },
    },
    location: { origin: 'https://example.test', pathname: '/seo-strategist' },
    fetch: async () => ({ ok: true, json: async () => ({}), body: null, status: 200 }),
    navigator: { userAgent: 'test' },
    setTimeout, clearTimeout, setInterval, clearInterval,
    console: { log() {}, warn() {}, error() {} },
    Blob: class {}, URL: { createObjectURL: () => '', revokeObjectURL() {} },
    TextDecoder, TextEncoder, Response, Request,
    alert() {}, confirm: () => false,
  };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;

  // QUESTION_BANKS is loaded from a separate <script src>; provide it
  sandbox.window.QUESTION_BANKS = {};

  const names = Object.keys(sandbox);
  try {
    // eslint-disable-next-line no-new-func
    const run = new Function(...names, `"use strict";\n${body}\n`);
    run(...names.map(n => sandbox[n]));
    console.log(`PASS  ${file} — script executes cleanly`);
  } catch (err) {
    console.log(`FAIL  ${file} — ${err.constructor.name}: ${err.message}`);
    fail++;
  }
}

// Every helper the failure path depends on must exist in every LIVE assessment.
// Which are live comes from the catalog, so retiring or adding one needs no edit here.
globalThis.window = {};
await import('file://' + process.cwd() + '/assessments.js');
const catalog = globalThis.window.ASSESSMENT_CATALOG || [];
const fileOf = a => a.url.replace(/^\//, '') + '.html';
const live    = new Set(catalog.filter(a => a.status !== 'retired').map(fileOf));
const retired = new Set(catalog.filter(a => a.status === 'retired').map(fileOf));

const required = ['postReport', 'rescueToTeamwork', 'stashUnsent', 'clearSaved', 'resendUnsent'];
for (const file of files) {
  if (!live.has(file)) {
    console.log(`SKIP  ${file} — ` + (retired.has(file)
      ? 'retired, not offered to candidates'
      : 'not an assessment page'));
    continue;
  }
  const html = fs.readFileSync(file, 'utf8');
  const missing = required.filter(fn => !new RegExp(`function ${fn}\\s*\\(`).test(html));
  if (missing.length) { console.log(`FAIL  ${file} — missing: ${missing.join(', ')}`); fail++; }
  else console.log(`PASS  ${file} — all recovery helpers defined`);
}

console.log(fail ? `\n${fail} FAILURES` : '\nall green');
process.exit(fail ? 1 : 0);
