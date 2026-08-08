/**
 * MBN ASSESSMENT CATALOG
 * ââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââââ
 * This is the single source of truth for every assessment in the portal.
 * The landing page builds itself from this list â add an entry here and
 * the card appears automatically. No other file needs to change.
 *
 * TO ADD A NEW ASSESSMENT:
 *   1. Copy an existing assessment .html file as your starting point
 *   2. Save it with a new slug, e.g. paid-media-specialist.html
 *   3. Add its question bank to questions.js (keyed by the same id)
 *   4. Add an entry below
 *
 * FIELDS
 *   id           Must match the assessment_type in the report JSON and the
 *                key used in questions.js
 *   title        Role name shown on the card
 *   department   Cards are grouped under this heading, in DEPARTMENT_ORDER
 *   url          Path to the assessment page (no .html â Pages serves clean URLs)
 *   duration     Human-readable, shown on the card
 *   questions    Integer, shown on the card
 *   phases       Integer, shown on the card
 *   blurb        1-2 sentences. Written for the candidate, not for us.
 *   status       'live'        â clickable
 *                'coming_soon' â visible but disabled
 *                'retired'     â hidden from the landing page entirely
 *   accent       Card accent colour (hex)
 */

window.ASSESSMENT_CATALOG = [

  {
    id:         'tech_seo',
    title:      'Technical SEO Specialist',
    department: 'SEO',
    url:        '/technical-seo',
    duration:   '45â60 minutes',
    questions:  14,
    phases:     7,
    blurb:      'Scenario-based diagnostics across crawl budget, Core Web Vitals, JavaScript rendering, canonicalization, and international SEO. Includes two configuration work samples.',
    status:     'live',
    accent:     '#3b82f6',
  },

  {
    id:         'seo_strategist',
    title:      'Senior SEO Strategist',
    department: 'SEO',
    url:        '/seo-strategist',
    duration:   '90 minutes',
    questions:  24,
    phases:     9,
    blurb:      'A single client engagement worked end to end â e-commerce, local, and national strategy, Google Business Profile and reputation management, forecasting, and executive communication. Your progress saves automatically.',
    status:     'live',
    accent:     '#8b5cf6',
  },

  {
    id:         'ppc_strategist',
    title:      'Paid Media Strategist',
    department: 'Paid Media',
    url:        '/ppc-strategist',
    duration:   '90 minutes',
    questions:  24,
    phases:     9,
    blurb:      'A single Google Ads account worked end to end â profitability math, campaign diagnostics, search terms, conversion tracking, Shopping and Performance Max, bidding, and Local Services Ads. A calculator is useful. Your progress saves automatically.',
    status:     'live',
    accent:     '#f59e0b',
  },

  /* ââ Example of a future entry â uncomment and edit when ready ââ
  {
    id:         'content_strategist',
    title:      'Content Strategist',
    department: 'Content & Creative',
    url:        '/content-strategist',
    duration:   '60 minutes',
    questions:  16,
    phases:     7,
    blurb:      'Editorial planning, brief writing, and measuring content against pipeline rather than pageviews.',
    status:     'coming_soon',
    accent:     '#ec4899',
  },
  ââ */

];

/* Departments render in this order. Anything not listed goes last, alphabetically. */
window.DEPARTMENT_ORDER = [
  'SEO',
  'Paid Media',
  'Content & Creative',
  'Web Development',
  'Account Management',
  'Operations',
];

