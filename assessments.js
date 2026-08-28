﻿/**
 * MBN ASSESSMENT CATALOG
 * ——————————————————————————————————————————————————————————————
 * This is the single source of truth for every assessment in the portal.
 * The landing page builds itself from this list — add an entry here and
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
 *   url          Path to the assessment page (no .html — Pages serves clean URLs)
 *   duration     Human-readable, shown on the card
 *   questions    Integer, shown on the card
 *   phases       Integer, shown on the card
 *   blurb        1-2 sentences. Written for the candidate, not for us.
 *   status       'live'        — clickable
 *                'coming_soon' — visible but disabled
 *                'retired'     — hidden from the landing page entirely
 *   accent       Card accent colour (hex)
 */

window.ASSESSMENT_CATALOG = [

  {
    id:         'tech_seo',
    title:      'Technical SEO Specialist',
    department: 'SEO',
    url:        '/technical-seo',
    duration:   '45–60 minutes',
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
    duration:   '25–30 minutes',
    questions:  10,
    phases:     4,
    blurb:      'A conversation about how you would take over a live client account and run strategy on it — what you do first, where you would focus the effort, and how you handle the client. Not a technical exam. Your progress saves automatically.',
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
    blurb:      'A single Google Ads account worked end to end — profitability math, campaign diagnostics, search terms, conversion tracking, Shopping and Performance Max, bidding, and Local Services Ads. A calculator is useful. Your progress saves automatically.',
    status:     'live',
    accent:     '#f59e0b',
  },

  /* —— Example of a future entry — uncomment and edit when ready ——
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
  —— */

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

