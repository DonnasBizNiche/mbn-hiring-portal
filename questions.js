﻿/**
 * Shared question bank.
 * The AI report returns only { id, answer, score, assessment } — the full
 * question text lives here so reports stay small and question wording is
 * guaranteed verbatim rather than paraphrased back by the model.
 *
 * Loaded by: strategist.html, index.html (optional), review.html
 */
window.QUESTION_BANKS = {

  /* ——————————— SENIOR SEO STRATEGIST — 24 questions, 9 phases ——————————— */
  seo_strategist: {
    q1_background: {
      label: '1. Background & Experience',
      phase: 'Orientation & Philosophy',
      question: "Tell me about your strategy experience — how many years, what mix of e-commerce, local, and national work, and what size accounts you've owned end to end.",
    },
    q2_defining_success: {
      label: '2. Defining Success',
      phase: 'Orientation & Philosophy',
      question: 'Before I show you any client data: when you take over an SEO account, how do you define success? What do you report on, and what do you refuse to report on?',
    },
    q3_discovery: {
      label: '3. Discovery Questions',
      phase: 'Discovery & Revenue Framing',
      question: 'Before you touch keyword research, what else do you need to know about this business? What questions would you ask on the kickoff call, and why does each one matter to the strategy?',
    },
    q4_core_diagnostic: {
      label: '4. The Core Diagnostic',
      phase: 'Discovery & Revenue Framing',
      question: 'Organic sessions are up 61% year over year, and organic revenue is flat at +2%. Diagnose that. What has most likely happened, how would you confirm it, and what does it tell you about the strategy that has been running?',
    },
    q5_seo_wrong_answer: {
      label: '5. When SEO Is the Wrong Answer',
      phase: 'Discovery & Revenue Framing',
      question: "Is there any part of Northline's business where you'd tell them SEO is the wrong investment right now, and they should spend that money elsewhere? Be specific about which part and why.",
    },
    q6_keyword_mapping: {
      label: '6. Keyword Mapping Exercise',
      phase: 'Keyword → Intent → Page Mapping',
      question: 'For each keyword in the table, give me: the target page type, the funnel stage, and a priority of High, Medium, Low, or Don\'t Target. You must justify anything you decline to target.',
    },
    q7_deprioritization: {
      label: '7. Deprioritization Defense',
      phase: 'Keyword → Intent → Page Mapping',
      question: "Pick the two highest-volume keywords in that table that you would NOT prioritize. Defend that decision the way you'd defend it to a client who is staring at the search volume and asking why you're ignoring it.",
    },
    q8_cannibalization: {
      label: '8. Cannibalization',
      phase: 'Keyword → Intent → Page Mapping',
      question: "Northline currently has three separate pages targeting snow blower buyers: a category page at /snow-blowers/, a blog post titled 'Best Snow Blowers of 2026', and a buying guide at /guides/choosing-a-snow-blower/. All three rank between positions 8 and 20 for overlapping terms. Walk me through how you diagnose this and exactly what you'd do about it.",
    },
    q9_ecom_architecture: {
      label: '9. E-commerce Architecture',
      phase: 'E-commerce Strategy',
      question: "Northline has 4,500 SKUs. Talk me through how you'd structure category and product pages for organic, including how you'd handle faceted navigation — filters for brand, engine size, clearing width, and price. What gets indexed, what doesn't, and how do you decide?",
    },
    q10_seasonality: {
      label: '10. Seasonality & Dead SKUs',
      phase: 'E-commerce Strategy',
      question: 'Snow equipment sells September through February, mowers March through August. Every year roughly 600 SKUs are discontinued or go permanently out of stock. How do you handle both problems — the seasonal swing and the dead SKUs — from an SEO and revenue standpoint?',
    },
    q11_location_pages: {
      label: '11. Location Page Strategy',
      phase: 'Local SEO (8 Markets)',
      question: 'Northline has eight physical locations but no location pages — just a store locator with an embedded map. A previous agency proposed building 300 city pages targeting every town within driving distance of a dealer. What\'s your approach, and what do you think of that proposal?',
    },
    q12_service_overlap: {
      label: '12. Service Area Overlap',
      phase: 'Local SEO (8 Markets)',
      question: "Grand Rapids and Lansing are 65 miles apart, and both dealers service the same towns in between. Green Bay and Madison have similar overlap. How do you stop Northline's own locations from competing against each other in search, and how do you decide which location owns which geography?",
    },
    q13_gbp_audit: {
      label: '13. GBP Audit (Work Sample)',
      phase: 'GBP, Listings & Reputation',
      question: 'Here is the Google Business Profile for the Grand Rapids location. Identify every issue you see, then rank your fixes by revenue impact — not by how serious they sound. Tell me what you\'d fix first and why.',
    },
    q14_gbp_optimization: {
      label: '14. GBP Optimization Depth',
      phase: 'GBP, Listings & Reputation',
      question: 'Of the levers available — categories, services, products, photos, posts, Q&A, attributes, and messaging — which ones actually move local ranking, which ones mainly move conversion once you\'re already visible, and which are close to cosmetic? Be specific about how you\'d use products and posts for a business like Northline.',
    },
    q15_reputation: {
      label: '15. Reviews & Reputation',
      phase: 'GBP, Listings & Reputation',
      question: 'The Duluth location has dropped to 1.9 stars after a bad winter. Eleven one-star reviews in six weeks, and reading them, most describe real service failures — machines held for three weeks, missed callbacks. Two look like they may be from a competitor. What\'s your 90-day plan, and what do you tell the owner about review gating and about responding?',
    },
    q16_listings: {
      label: '16. Listings Management',
      phase: 'GBP, Listings & Reputation',
      question: 'Across all eight locations Northline has inconsistent NAP data, listings on aggregators nobody has touched in years, and duplicate profiles. How do you approach listings management at this scale — what\'s your process, what tooling, what do you do about duplicates specifically, and how do you keep it from drifting again?',
    },
    q17_gbp_revenue: {
      label: '17. Measuring GBP Revenue',
      phase: 'GBP, Listings & Reputation',
      question: "The owner asks you to prove that Google Business Profile is worth the time you're spending on it. Profile views and 'searches' aren't going to satisfy him. How do you set up measurement so you can attribute actual revenue to GBP, and what would you put in the monthly report?",
    },
    q18_national: {
      label: '18. Competing Nationally',
      phase: 'National & Competitive',
      question: "On the national e-commerce side, Northline is up against Home Depot, Lowe's, Amazon, and the manufacturers' own sites. Where can they realistically win, where should they not bother, and what does that mean for how you'd allocate a national content and SEO budget?",
    },
    q19_brand_nonbrand: {
      label: '19. Brand vs Non-Brand',
      phase: 'National & Competitive',
      question: 'How do you segment and report branded versus non-branded organic performance, and why does that distinction matter for a business like this one? What would make you worried if you saw branded traffic growing?',
    },
    q20_data_reading: {
      label: '20. Reading the Data',
      phase: 'Data & Forecasting',
      question: 'Here is 90 days of organic landing page data plus Search Console figures. What is this data telling you? What are your top three actions, and what would you stop doing?',
    },
    q21_forecasting: {
      label: '21. Forecasting & Attribution',
      phase: 'Data & Forecasting',
      question: 'Build me a 12-month organic revenue forecast for Northline based on what you\'ve seen. Explain your method and your assumptions. Then tell me how you would prove, twelve months from now, that the revenue growth came from SEO.',
    },
    q22_prioritization: {
      label: '22. Prioritization & Pushback',
      phase: 'Prioritization & Communication',
      question: "Two things. First, give me your prioritized roadmap for the first 90 days — what you do, in what order. Second: the CMO tells you he wants Northline ranking page one for 'generator' within six months because a board member asked about it. How do you handle that conversation?",
    },
    q23_executive_comms: {
      label: '23. Executive Communication',
      phase: 'Prioritization & Communication',
      question: 'Write the opening section of your first quarterly business review for Northline\'s owner. He is not technical, he is skeptical of SEO because the last agency showed him traffic charts while revenue stayed flat, and he has 10 minutes. Four to six sentences.',
    },
    q24_self_assessment: {
      label: '24. Self-Assessment',
      phase: 'Prioritization & Communication',
      question: "What's your weakest area as a strategist, and how do you handle accounts where that gap matters?",
    },
  },

  /* ——————————— PAID MEDIA STRATEGIST — 24 questions, 9 phases ——————————— */
  ppc_strategist: {
    p1_background: {
      label: '1. Background & Experience',
      phase: 'Orientation & Profitability',
      question: 'Tell me about your paid media experience — how many years, what monthly spend you have personally managed, and what mix of e-commerce versus lead generation.',
    },
    p2_defining_success: {
      label: '2. Defining Success',
      phase: 'Orientation & Profitability',
      question: 'Before I show you any account data: how do you judge whether a paid search program is working? What do you report to a client, and what metrics do you refuse to lead with?',
    },
    p3_discovery: {
      label: '3. Discovery Questions',
      phase: 'Profitability Math',
      question: 'Before you open the account, what do you need to know about this business? What do you ask on the kickoff call, and why does each answer change what you would do?',
    },
    p4_breakeven_math: {
      label: '4. Breakeven ROAS Calculation',
      phase: 'Profitability Math',
      question: 'Using the margin table, what is the breakeven ROAS for each of Northline\'s three revenue lines — equipment, parts, and service? Show your working, then tell me what those numbers mean for how you would read a ROAS figure in this account.',
    },
    p5_roas_reaction: {
      label: '5. Applying the Math',
      phase: 'Profitability Math',
      question: "The previous agency's last report led with this: 'Shopping campaigns delivered a 5.2x return on ad spend this quarter, up from 4.6x.' They presented it as the headline win. What's your reaction?",
    },
    p6_account_review: {
      label: '6. Account Performance Review',
      phase: 'Account Structure & Diagnostics',
      question: "Walk me through this account. What's actually happening here, which campaigns would you cut, which would you scale, and what's the single biggest problem?",
    },
    p7_cpa_diagnostic: {
      label: '7. The CPA Diagnostic',
      phase: 'Account Structure & Diagnostics',
      question: 'Last month blended CPA rose 60% with no change in budget, no new campaigns, and no bid strategy changes. Nobody touched anything. Walk me through your diagnostic process — what do you check, and in what order?',
    },
    p8_account_structure: {
      label: '8. Account Structure',
      phase: 'Account Structure & Diagnostics',
      question: 'How do you think about account structure in 2026? Single keyword ad groups, tightly themed ad groups, or heavy consolidation with broad match and smart bidding — where do you land, and what would actually determine your choice for this account specifically?',
    },
    p9_search_terms: {
      label: '9. Search Terms Review',
      phase: 'Search Terms & Match Types',
      question: "Which of these search terms would you add as negatives, which would you add as keywords, and which need more investigation before you decide? Explain the ones you're leaving alone.",
    },
    p10_match_types: {
      label: '10. Match Types & Guardrails',
      phase: 'Search Terms & Match Types',
      question: 'How do you use match types alongside smart bidding, and how do you keep broad match from drifting? Be specific about what guardrails you actually put in place.',
    },
    p11_tracking_audit: {
      label: '11. Conversion Tracking Audit (Work Sample)',
      phase: 'Conversion Tracking',
      question: "Audit this conversion tracking configuration. Identify every problem, tell me which one is doing the most damage, and explain what it's doing to the account's reported performance.",
    },
    p12_lead_to_revenue: {
      label: '12. Lead-to-Revenue',
      phase: 'Conversion Tracking',
      question: 'Service bookings happen on the website but the actual revenue is only known after the machine is repaired, sometimes weeks later, and the ticket value varies from $80 to $600. How do you get that real revenue back into Google Ads so bidding optimises toward it?',
    },
    p13_ga4_discrepancy: {
      label: '13. GA4 Discrepancy',
      phase: 'Conversion Tracking',
      question: 'A client points out that Google Ads reports 41% more purchases than GA4 for the same period and asks which one is lying. How do you explain it, and how do you decide which number to report going forward?',
    },
    p14_shopping_feed: {
      label: '14. Shopping Feed',
      phase: 'Shopping & Performance Max',
      question: "Northline's product feed uses the manufacturer's default titles, like 'Deluxe 28 SE'. Talk me through how you'd approach feed optimisation for this catalogue — titles, attributes, and how you'd use custom labels given what you now know about their margins.",
    },
    p15_pmax_setup: {
      label: '15. Performance Max Setup',
      phase: 'Shopping & Performance Max',
      question: "How do you set up and control a Performance Max campaign for this account? Cover asset groups, listing groups, search themes, audience signals, and brand exclusions — and tell me what you do about the parts of PMax you can't see.",
    },
    p16_pmax_cannibal: {
      label: '16. PMax Cannibalization',
      phase: 'Shopping & Performance Max',
      question: 'Shopping revenue dropped 31% in the 60 days since PMax launched, while PMax reported strong returns. How do you determine whether PMax actually generated incremental revenue or simply absorbed conversions Shopping was already winning? What test would you run?',
    },
    p17_smart_bidding: {
      label: '17. Smart Bidding on Thin Data',
      phase: 'Bidding & Budget',
      question: 'The service campaigns generate about 15 conversions a month. Would you use Target ROAS there? Walk me through your bidding approach for a campaign with thin conversion data, and how you handle the transition when you do change strategies.',
    },
    p18_storm_seasonality: {
      label: '18. Storm-Event Seasonality',
      phase: 'Bidding & Budget',
      question: 'Generator demand spikes hard and unpredictably — a major storm forecast can drive a 10x increase in search volume within 48 hours, and it collapses just as fast. How do you build the account and the budget process to capture that without blowing the monthly budget or wrecking your bid strategies?',
    },
    p19_budget_realloc: {
      label: '19. Budget Reallocation',
      phase: 'Bidding & Budget',
      question: 'You have the same total monthly budget, not a dollar more. Based on everything you have seen in this account, how would you redistribute it, and what would you expect to happen to reported ROAS versus actual profit in the first 60 days?',
    },
    p20_local_services: {
      label: '20. Local Services Ads',
      phase: 'Local & Incrementality',
      question: 'Northline has eight locations with service departments. How would you use Local Services Ads and local campaigns across those markets, how do you handle call tracking and lead disputes, and how do you stop the eight locations bidding against each other?',
    },
    p21_brand_bidding: {
      label: '21. Brand Bidding Incrementality',
      phase: 'Local & Incrementality',
      question: 'The brand campaign shows a 24x return. The owner wants to cut it, arguing those customers would have found Northline anyway. Make the strongest case for keeping it, then make the strongest case for cutting it, and tell me how you would settle the argument with data.',
    },
    p22_measuring_local: {
      label: '22. Measuring In-Store Revenue',
      phase: 'Local & Incrementality',
      question: 'Most of the service revenue is transacted in the store, not online. How do you measure whether paid media is actually driving that in-store service revenue, and what would you put in the monthly report?',
    },
    p23_client_comms: {
      label: '23. Client Communication',
      phase: 'Communication & Self-Assessment',
      question: "Write the opening of the conversation where you tell Northline's owner that the 5.2x ROAS he has been proudly reporting to his board means the account has been losing money. He is not technical, he signed off on that strategy, and he is going to be defensive. Five to eight sentences.",
    },
    p24_self_assessment: {
      label: '24. Self-Assessment',
      phase: 'Communication & Self-Assessment',
      question: "What's your weakest area in paid media, and how do you handle accounts where that gap matters?",
    },
  },
};

