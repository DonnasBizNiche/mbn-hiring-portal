/**
 * MBN Hiring Portal — test submission
 * ————————————————————————————————————————————————————————————————
 * Posts a complete, realistic assessment straight to /api/submit so you can
 * check Supabase, the review page and the Teamwork board WITHOUT sitting
 * through a 90-minute interview.
 *
 * HOW TO RUN
 *   1. Open https://employment-skills-assessment.pages.dev in Chrome
 *   2. Press F12 (or Cmd+Option+I on a Mac) and click the "Console" tab
 *   3. Paste this whole file in, press Enter
 *   4. Copy the completion code it prints, then look it up at /review
 *
 * It must be run from a tab on the portal itself — that is what makes the
 * /api/submit call go to the right place.
 */
(async () => {
  const CODE = 'TEST-' + Math.random().toString(36).slice(2, 6).toUpperCase();

  const answers = [
    ['q1_background', 5, 'Six years agency side, three of them leading strategy for e-commerce and multi-location service clients. Most recently owned a $40k/month retainer across 12 locations.', 'Concrete and quantified. Names scope and ownership rather than listing tools.'],
    ['q2_defining_success', 4, 'Revenue from organic, not sessions. I agree leading indicators up front — qualified sessions to money pages, and assisted conversions — because rankings move before revenue does and the client needs something to hold onto in month two.', 'Correctly separates leading from lagging indicators and explains why that matters to the client relationship.'],
    ['q3_discovery', 4, 'Margin by product line, what they actually want to sell more of, capacity constraints, and who handles fulfilment. Then GSC, GA4, and their internal sales data so I can tie keywords to revenue rather than volume.', 'Business questions before technical ones. Asking about capacity is a strong signal.'],
    ['q4_core_diagnostic', 5, 'I would segment the traffic loss by page type and query type before touching anything. A sitewide drop and a category-only drop have completely different causes, and most people skip that step and start guessing at algorithm updates.', 'Segments before diagnosing. Explicitly rejects the jump-to-algorithm-update instinct.'],
    ['q5_seo_wrong_answer', 4, 'Adding more content. Their problem was not thin coverage, it was that the money pages were buried four clicks deep and had no internal links pointing at them. More posts would have made that worse.', 'Good example of a plausible-but-wrong intervention, with the reasoning made explicit.'],
    ['q6_keyword_mapping', 4, 'I mapped "generator" to the category page rather than a blog post because the intent is transactional. "Snow blower will not start" goes to a support article — it is a service intent, not a purchase. The duplicate spellings I consolidated onto one URL and let the engine sort the variants; splitting them would have created two weak pages instead of one strong one.', 'Handled all three cases correctly. Consolidating the spelling variants rather than building separate pages is the right call.'],
    ['q7_deprioritization', 4, 'I dropped the schema rollout. It was real work with a real payoff, but the site had a canonicalization problem that meant Google was not reliably indexing the pages the schema would sit on. Fixing the foundation first made the schema worth doing later.', 'Deprioritizes with a dependency argument rather than an effort argument.'],
    ['q8_cannibalization', 5, 'I check whether the two URLs actually compete on the same query by pulling GSC data at the query-URL level over 90 days. If they swap positions the engine is genuinely confused; if one has always outranked the other it is not cannibalization, it is just a weaker page.', 'Distinguishes real cannibalization from the false positive most people report. The swap test is the correct diagnostic.'],
    ['q9_ecom_architecture', 4, 'Faceted navigation was generating millions of crawlable combinations. I would allow indexing on the two or three facets with genuine search demand, block the rest with robots.txt, and make the allowed ones properly linked rather than parameter-only.', 'Correctly treats facets as a demand question, not just a crawl-control question.'],
    ['q10_seasonality', 4, 'Build in the off season. For a snow business that means the content and links go live in August so the pages have authority by the time demand arrives in November. Starting in November means competing from a standing start.', 'Understands the lead time problem, which is the actual point of the question.'],
    ['q11_location_pages', 5, 'I rejected the 300-city-page proposal. They had 12 real locations. The other 288 pages would have been near-duplicates with a city name swapped, which is exactly what the helpful content guidance targets. I proposed 12 genuinely differentiated pages plus a service-area page.', 'Rejected the proposal explicitly and gave a defensible alternative rather than just saying no.'],
    ['q12_service_overlap', 4, 'One page per service the customer would search for separately, not per service the business sells separately. Their internal service list had eight items that mapped to four real search intents.', 'Draws the line at search intent rather than at the client org chart.'],
    ['q13_gbp_audit', 5, 'The primary category was wrong — set to "Contractor" when it should have been "Plumber", which is the single highest-leverage field on the profile. The business name also had keywords stuffed into it, which is a suspension risk, not just a ranking one.', 'Caught both planted issues, including the suspension risk which most candidates miss.'],
    ['q14_gbp_optimization', 4, 'Categories first, then services and service areas, then photos on a regular cadence, then Q&A seeded with real questions. Posts last — they help engagement more than ranking.', 'Sensible ordering with honest weighting on Posts.'],
    ['q15_reputation', 5, 'I ruled out review gating immediately — it violates Google policy regardless of how well it works. The fix was making the ask routine at the point of service completion, when satisfaction is highest, for every customer.', 'Ruled out gating unprompted and replaced it with a workable process.'],
    ['q16_listings', 3, 'Consistent NAP across the major aggregators, then the industry-specific directories. I would use a service for the long tail rather than doing it by hand.', 'Correct but generic. No discussion of how to handle conflicting legacy listings.'],
    ['q17_gbp_revenue', 4, 'Call tracking with a dynamic number on the profile, plus UTM tags on the website link, so GBP-driven revenue shows up separately in GA4 instead of being lumped into direct.', 'Practical measurement answer that closes the attribution gap.'],
    ['q18_national', 4, 'National needs topical depth rather than geographic breadth. Different content model, different link profile, and a much longer payback period that the client has to agree to before we start.', 'Frames the strategic difference and flags the expectation-setting problem.'],
    ['q19_brand_nonbrand', 5, 'I always split them in reporting. Brand traffic tracks marketing spend elsewhere, so blending them lets an SEO program take credit for a TV campaign — or take blame when brand spend gets cut.', 'Understands why the split matters politically, not just analytically.'],
    ['q20_data_reading', 5, 'Sessions were up but revenue was flat because the growth was all blog traffic — informational queries with no purchase intent. The commercial pages were actually down slightly, which is the number that mattered and was hidden by the aggregate.', 'Identified the blog traffic as the cause and spotted that the commercial decline was masked.'],
    ['q21_forecasting', 4, 'Demand times realistic position-based CTR times conversion rate times average order value, with a stated confidence range. I present the low case first, because a forecast that only shows the upside is a liability when it misses.', 'Sound method and a mature stance on presenting ranges.'],
    ['q22_prioritization', 4, 'Impact over effort, but weighted by whether anything else depends on it. Indexation fixes go first even when low-impact on their own, because everything downstream needs them to land.', 'Dependency-aware prioritization rather than a flat ICE score.'],
    ['q23_executive_comms', 5, 'One slide: revenue from organic against target, what changed, what I am doing next, and what I need from them. The technical detail goes in an appendix nobody reads unless they ask.', 'Correct altitude for the audience and includes the ask, which most candidates leave out.'],
    ['q24_self_assessment', 4, 'Weakest on international — I have run hreflang implementations but never owned a genuinely multi-market program. Strongest on turning messy analytics into a decision a client will actually act on.', 'Specific and credible about the gap rather than a disguised humblebrag.'],
  ];

  const report = {
    assessment_type: 'seo_strategist',
    candidate_name:  'Riley Chen (TEST)',
    candidate_email: 'riley.chen.test@example.com',
    position:        'Senior SEO Strategist',
    completion_code: CODE,
    assessment_complete: true,
    referral_source: 'Test submission — console script',
    overall_score: 88,
    overall: {
      recommendation: 'hire',
      confidence: 'high',
      summary: 'A strong senior candidate who consistently reasons from revenue rather than rankings. Caught every planted trap in the assessment — the wrong GBP primary category, the keyword-stuffed business name, the 300-city-page proposal, and the blog traffic masking a commercial decline. Communicates at the right altitude for an executive audience and is honest about where their experience thins out. The one soft spot is citations and listings hygiene, which is coachable and not central to the role.',
      strengths: [
        'Segments data before diagnosing rather than jumping to an algorithm update',
        'Distinguishes real cannibalization from the false positive most candidates report',
        'Rejected the 300-city-page proposal with a defensible alternative',
        'Presents forecasts as ranges and leads with the low case',
      ],
      weaknesses: [
        'Citations and listings answer was generic — no handling of conflicting legacy data',
        'No hands-on ownership of a multi-market international program',
      ],
      interview_focus: [
        'Walk through a time a forecast missed and how they handled the client conversation',
        'Probe the international gap — how would they staff or scope a multi-market build',
        'Ask how they would handle a client who insists on the 300 city pages anyway',
      ],
    },
    scores: {
      revenue_orientation: 5,
      keyword_mapping: 4,
      channel_strategy: 4,
      measurement_forecasting: 5,
      stakeholder_influence: 5,
    },
    ai_suspicion: {
      overall_suspicion: 'low',
      flagged_steps: [],
      notes: '',
    },
    question_reviews: answers.map(([id, score, answer, assessment]) => ({ id, score, answer, assessment })),
    transcript: answers.flatMap(([id, , answer]) => ([
      { role: 'assistant', content: `(${id}) Next question — see the question bank for the full wording.` },
      { role: 'user', content: answer },
    ])),
    paste_count: 0,
  };

  console.log('%cPosting test submission…', 'font-weight:bold');
  console.log('Completion code:', CODE);

  try {
    const res  = await fetch('/api/submit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(report),
    });
    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      console.error('%cFAILED — HTTP ' + res.status, 'color:#dc2626;font-weight:bold', data);
      return;
    }

    const finalCode = data.code || CODE;
    console.log('%cSUBMITTED OK', 'color:#16a34a;font-weight:bold;font-size:14px');
    console.log('Completion code: %c' + finalCode, 'font-size:16px;font-weight:bold');
    console.log('Review it at: ' + location.origin + '/review');

    if (data.teamwork) {
      if (data.teamwork.ok) {
        console.log('Teamwork card created — task id ' + data.teamwork.task_id);
        if (data.teamwork.stage && data.teamwork.stage.ok) {
          console.log('%cFiled into the board column.', 'color:#16a34a');
        } else if (data.teamwork.stage) {
          console.warn('Card created but NOT filed into a board column:', data.teamwork.stage);
        }
      } else {
        console.warn('Teamwork card failed:', data.teamwork);
      }
    } else {
      console.warn('No teamwork status in the response — the site is still running the OLD worker. '
        + 'The card will exist in the 🟢 Low Priority list but will NOT appear on the board.');
    }

    console.log('Full response:', data);
  } catch (err) {
    console.error('%cFAILED — could not reach /api/submit', 'color:#dc2626;font-weight:bold', err);
  }
})();
