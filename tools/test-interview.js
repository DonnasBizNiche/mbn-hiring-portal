/**
 * MBN Hiring Portal — automated interview run
 * ————————————————————————————————————————————————————————————————
 * Plays a scripted candidate through an entire assessment against the LIVE
 * /api/chat, so the closing report turn actually fires. That last turn is the
 * one that has broken twice — first truncated at max_tokens 4096, then dropped
 * in transit when it was still being requested unstreamed — and it is the only
 * part of the flow that a submission test can't reach. Nobody should have to
 * sit a 25-minute interview by hand to find out whether it works.
 *
 * This drives the page's OWN streamChat / hasReport / parseReport, so what it
 * exercises is the real code path, not a copy of it that can drift.
 *
 * HOW TO RUN
 *   1. Open https://employment-skills-assessment.pages.dev/seo-strategist
 *      (stay on the welcome screen — do not click Begin)
 *   2. Press F12 (or Cmd+Option+I on a Mac) and click the "Console" tab
 *   3. Paste this whole file in, press Enter
 *   4. Watch. It prints each turn as it completes and a verdict at the end.
 *      Expect roughly 4-8 minutes: the closing report alone takes several.
 *
 * WHAT IT COSTS
 *   One full assessment's worth of Anthropic API usage. It does NOT write to
 *   Supabase or create a Teamwork card unless you set SUBMIT to true below —
 *   /api/submit is already covered by test-submission.js.
 */
(async () => {

  /* Set to true to also file the finished report, exactly as a real candidate
     would. Creates a real Supabase row and a real Teamwork card — both prefixed
     so you can find and delete them afterwards. */
  const SUBMIT = false;

  const CANDIDATE = {
    name:  'ZZ Test Candidate',
    email: 'assessment-test@mybizniche.com',
  };

  /* Scripted answers, in step order. Deliberately three-plus sentences each so
     the interviewer's "could you expand on that" rule doesn't fire — we're
     testing the transport, not the follow-up logic. Quality is beside the
     point; these just have to be substantial enough to keep the interview
     moving to the turn we actually care about. */
  const ANSWERS = [
    "Six years agency side, three of them leading strategy. Mix of e-commerce and multi-location service clients, mostly regional rather than enterprise. Largest account I owned end to end was about $40k a month across twelve locations.",
    "Revenue from organic, not sessions. I agree leading indicators up front — qualified sessions to money pages and assisted conversions — because rankings move before revenue does. I refuse to report on keyword rankings in isolation, because they let an agency look busy while the business gets nothing.",
    "Before I touch anything I want to understand where the money actually comes from and what the last agency did. I'd pull GA4, Search Console and their sales data, and I'd map current organic revenue by page and by line of business. I'd also read the previous agency's reporting to see what they were optimising for, because that usually explains the current state.",
    "I need margin by line of business, which of those lines they actually want to grow, and what their service capacity looks like. I'd ask what happens operationally if we double service enquiries in Grand Rapids, because there's no point driving demand they can't fulfil. I'd also ask why they cancelled the last agency, since that tells me what they'll be sensitive about.",
    "Almost certainly the blog. Twelve posts a month for eighteen months will produce a lot of informational traffic that has no purchase intent, and that would inflate sessions while doing nothing to revenue. I'd confirm it by segmenting landing pages by template and comparing revenue per session for blog versus commercial pages.",
    "The margins make this straightforward. Equipment is 12% and competes with Home Depot and Amazon on price, while parts are 58% and service is 55% with no national competitor. I'd put the first six months into the eight local markets and the parts business, and I'd tell them not to spend on head-term equipment keywords nationally.",
    "First thirty days is diagnosis and the Google Business Profiles, because those are the fastest revenue with the least dependency on anyone else. Days thirty to sixty, location pages for the eight markets and fixing the internal linking into parts. Days sixty to ninety, the content programme gets pointed at service and parts intent instead of general interest, and we stop publishing what isn't earning.",
    "I'd start by taking it seriously rather than dismissing it, because someone he trusts told him it matters. Then I'd show him what 'generator' actually costs to compete for and what the 12% margin means at that volume, next to what the same effort returns on service. I'd offer the storm-event and installation terms instead, which he can actually win and which pay better.",
    "Monthly call plus a written summary, and the summary leads with revenue by line of business, not traffic. Quarterly we do a longer session on what's next. Opening for the QBR: 'Last quarter organic revenue was up 34%, and I want to show you where it came from before anything else. Three things drove it — the service pages in Grand Rapids and Lansing, the parts category, and the profiles we cleaned up in month one. Traffic is up too, but I'm not going to spend your ten minutes on that, because the last agency showed you traffic while your revenue sat flat. What I'd like to agree today is where the next quarter's effort goes.'",
    "Technical SEO at the deep end — I can diagnose and brief it, but on a complex migration I'd want a specialist alongside me rather than pretending I can own it. On accounts where that's central I bring one in early and I'm upfront with the client about it. What I don't do is let it sit unowned because I'm embarrassed to say I need help.",
  ];

  /* ── preflight ─────────────────────────────────────────────── */
  const missing = ['sysPrompt', 'streamChat', 'hasReport', 'parseReport']
    .filter(fn => typeof window[fn] !== 'function' && eval(`typeof ${fn}`) !== 'function');
  if (missing.length) {
    console.error(
      `%cWrong page.%c This has to run from an assessment page — open /seo-strategist and paste it there.\nMissing: ${missing.join(', ')}`,
      'color:#dc2626;font-weight:bold', 'color:inherit');
    return;
  }

  const t0 = Date.now();
  const secs = ms => (ms / 1000).toFixed(1) + 's';
  const log  = (msg, style = '') => console.log('%c' + msg, style || 'color:#64748b');

  log(`Starting scripted interview as ${CANDIDATE.name}`, 'color:#8b5cf6;font-weight:bold');
  log(`Submit at the end: ${SUBMIT ? 'YES — will write to Supabase and Teamwork' : 'no'}`);

  const messages = [
    { role: 'system', content: sysPrompt(CANDIDATE.name, CANDIDATE.email) },
    { role: 'user',   content: 'Please begin the assessment.' },
  ];

  let next = 0;            // index into ANSWERS
  let turn = 0;
  let raw = '';
  const timings = [];
  const MAX_TURNS = ANSWERS.length + 6;   // headroom for follow-up prompts

  while (turn < MAX_TURNS) {
    turn++;
    const started = Date.now();
    try {
      raw = await streamChat(messages, () => {});
    } catch (err) {
      console.error(`%cTurn ${turn} FAILED after ${secs(Date.now() - started)}: ${err.message}`,
        'color:#dc2626;font-weight:bold');
      console.error('This is the failure the streaming fix was meant to remove. ' +
        'If the turn number is the last one, the closing report is still breaking.');
      return;
    }
    const took = Date.now() - started;
    timings.push({ turn, ms: took, chars: raw.length });

    if (hasReport(raw)) {
      log(`Turn ${turn}: CLOSING REPORT — ${secs(took)}, ${raw.length.toLocaleString()} chars`,
        'color:#16a34a;font-weight:bold');
      break;
    }

    // A follow-up prompt doesn't consume a scripted answer
    const followUp = /expand on that|specific example/i.test(raw);
    let reply;
    if (followUp) {
      reply = 'To give you a concrete example: on a multi-location client last year I found the service pages were outperforming the product pages on revenue per session by roughly four to one, so we moved the internal linking and the content budget behind service. Revenue from those pages roughly doubled over two quarters.';
      log(`Turn ${turn}: follow-up asked (${secs(took)}) — answering without advancing`);
    } else {
      if (next >= ANSWERS.length) {
        console.warn(`%cRan out of scripted answers at turn ${turn} without a report. ` +
          `The interviewer may have added steps.`, 'color:#d97706');
        console.log(raw.slice(0, 400));
        return;
      }
      reply = ANSWERS[next++];
      log(`Turn ${turn}: Q${next} answered (${secs(took)})`);
    }

    messages.push({ role: 'assistant', content: raw });
    messages.push({ role: 'user', content: reply });
  }

  /* ── verdict ───────────────────────────────────────────────── */
  if (!hasReport(raw)) {
    console.error(`%cHit the ${MAX_TURNS}-turn cap without ever reaching the closing report.`,
      'color:#dc2626;font-weight:bold');
    console.log('Last reply was:\n' + raw.slice(0, 500));
    return;
  }

  const report = parseReport(raw);
  const bank   = (window.QUESTION_BANKS || {}).seo_strategist || {};
  const ids    = Array.isArray(report && report.question_reviews)
    ? report.question_reviews.map(q => q.id) : [];
  const unknown = ids.filter(id => !bank[id]);
  const slowest = timings.reduce((a, b) => (b.ms > a.ms ? b : a), timings[0]);

  console.log('%c\n──────── RESULT ────────', 'color:#8b5cf6;font-weight:bold');
  const line = (label, ok, detail) =>
    console.log(`%c${ok ? 'PASS' : 'FAIL'}%c  ${label}${detail ? '  — ' + detail : ''}`,
      `color:${ok ? '#16a34a' : '#dc2626'};font-weight:bold`, 'color:inherit');

  line('closing report turn completed', true, `${secs(slowest.ms)} on the longest turn`);
  line('report parsed as JSON', !!report,
    report ? (report.report_truncated ? 'SALVAGED from a truncated report' : 'clean') : 'parseReport returned null');
  line('report has question reviews', ids.length > 0, `${ids.length} of ${ANSWERS.length}`);
  line('every question id resolves in the bank', unknown.length === 0,
    unknown.length ? unknown.join(', ') : 'review page will show question text');
  line('completion code present', !!(report && report.completion_code), report && report.completion_code);

  console.log(`\nTotal: ${secs(Date.now() - t0)} across ${turn} turns.`);
  console.table(timings.map(t => ({ turn: t.turn, seconds: +(t.ms / 1000).toFixed(1), chars: t.chars })));

  if (report && report.report_truncated) {
    console.warn('%cThe report was salvaged rather than parsed cleanly — max_tokens may still be too low.',
      'color:#d97706;font-weight:bold');
  }

  if (!SUBMIT) {
    console.log('%cNot submitted. Set SUBMIT = true at the top of this script to file it end to end.',
      'color:#64748b');
    window.__testReport = report;
    console.log('Report object left on window.__testReport if you want to inspect it.');
    return;
  }

  /* ── optional: file it, exactly as the page would ───────────── */
  const payload = report || {};
  payload.assessment_type = 'seo_strategist';
  payload.position        = 'Senior SEO Strategist';
  payload.candidate_name  = '[TEST] ' + CANDIDATE.name;
  payload.candidate_email = CANDIDATE.email;
  payload.referral_source = 'automated test-interview.js';
  payload.transcript      = messages.slice(1)
    .filter(m => m.content !== 'Please begin the assessment.')
    .map(m => ({ role: m.role, content: m.content.split('<<<REPORT_START>>>')[0].trim() }));
  if (!report) payload.report_incomplete = true;

  const res = await fetch('/api/submit', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const out = await res.json().catch(() => ({}));
  line('submitted to Supabase + Teamwork', res.ok, JSON.stringify(out).slice(0, 200));
  if (res.ok) {
    console.log(`%cCompletion code: ${out.code}`, 'color:#8b5cf6;font-weight:bold;font-size:14px');
    console.log('Look it up at /review, then delete the row and the Teamwork card — both are prefixed [TEST].');
  }
})();
