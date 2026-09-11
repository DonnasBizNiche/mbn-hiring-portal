/**
 * MBN Hiring Portal — completion code check
 * ————————————————————————————————————————————————————————————————
 *   node tools/check-codes.mjs
 *
 * Asserts the page generates completion codes itself, and that they are
 * actually spread across the keyspace.
 *
 * WHY IT EXISTS
 *   Claude used to invent the code. Asked for something random, it produced
 *   what looked plausible instead of what was unlikely, anchoring on the
 *   MBN-7K4P example in the prompt. Six real codes came out as:
 *
 *     MBN-8K2R   NLP-8K2R   NLP-8K2M   MBN-9K2R   MBN-9T3K   MBN-9K3R
 *
 *   Three share "8K2". Four differ from another by one character. Two real
 *   candidates were eventually issued the identical code, which made their
 *   assessments indistinguishable, and several earlier "lost" reports were
 *   really just the wrong near-identical code being typed in.
 */
import fs from 'node:fs';

let fail = 0;
const check = (n, c, x = '') => { console.log((c ? 'PASS  ' : 'FAIL  ') + n + (c ? '' : '  ' + x)); if (!c) fail++; };

const PAGES = ['seo-strategist.html', 'technical-seo.html'];

for (const file of PAGES) {
  console.log(`\n── ${file} ──`);
  const html = fs.readFileSync(file, 'utf8');

  // The page must not fall back to whatever the model put in the report.
  check('code comes from genCode(), not the model',
    /S\.code\s*=\s*genCode\(\);/.test(html) &&
    !/S\.code\s*=\s*\(S\.report && S\.report\.completion_code\)/.test(html));

  const m = html.match(/function genCode\(\)\{[\s\S]*?\n\}/);
  if (!m) { check('genCode() found', false); continue; }
  const genCode = new Function(`${m[0]}; return genCode;`)();

  check('format is XXX-XXXX', /^[A-Z0-9]{3}-[A-Z0-9]{4}$/.test(genCode()), genCode());

  // No ambiguous characters — these get read aloud and typed back in.
  const codes = Array.from({ length: 100000 }, () => genCode());
  const chars = new Set(codes.join('').replace(/-/g, ''));
  check('no easily-confused characters (I, O, 0, 1)',
    !['I', 'O', '0', '1'].some(c => chars.has(c)), [...chars].sort().join(''));

  // The whole point: 100k draws should collide roughly never.
  // 32^7 ≈ 3.4e10, so the expected number of collisions here is about 0.15.
  const dupes = codes.length - new Set(codes).size;
  check('100,000 codes produce ~no duplicates', dupes <= 2, `${dupes} duplicates`);

  // Uniformity — a generator that clusters would show up as a skewed histogram.
  const freq = {};
  for (const c of codes.join('').replace(/-/g, '')) freq[c] = (freq[c] || 0) + 1;
  const counts = Object.values(freq);
  const expected = (codes.length * 7) / chars.size;
  const worst = Math.max(...counts.map(c => Math.abs(c - expected) / expected));
  check('character distribution is uniform (within 10%)', worst < 0.1,
    `worst deviation ${(worst * 100).toFixed(1)}%`);

  // For contrast: what the model actually produced.
  const modelCodes = ['MBN-8K2R', 'NLP-8K2R', 'NLP-8K2M', 'MBN-9K2R', 'MBN-9T3K', 'MBN-9K3R'];
  const near = modelCodes.filter((a, i) =>
    modelCodes.some((b, j) => i !== j &&
      [...a].filter((ch, k) => ch !== b[k]).length <= 1));
  check('(context) the model\'s own codes were near-identical', near.length >= 4,
    `${near.length} of ${modelCodes.length} differ from another by ≤1 character`);

  const sample = Array.from({ length: 5 }, () => genCode());
  console.log('      sample:', sample.join('  '));
}

console.log(fail ? `\n${fail} FAILURES` : '\nall green');
process.exit(fail ? 1 : 0);
