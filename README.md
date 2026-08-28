# MBN Hiring Portal

AI-powered skills assessments for MBN job candidates.

**Live:** https://employment-skills-assessment.pages.dev

---

## What this is

A Cloudflare Pages app that runs AI-driven conversational assessments for candidates applying to MBN roles. Each assessment is a multi-phase interview conducted by Claude. When a candidate finishes, the portal:

1. Saves the full report to Supabase (`assessment_reports` table)
2. Creates a task in Teamwork and files it on the board (project 758831, tasklist 3346283,
   board column "Completed Skills Assessment")
3. Gives the candidate a completion code to share with MBN
4. Lets MBN staff pull up the report at `/review` using the completion code + admin passcode

---

## Assessments

| Role | File | Duration | Questions | Phases |
|---|---|---|---|---|
| Technical SEO Specialist | `technical-seo.html` | 45–60 min | 14 | 7 |
| Senior SEO Strategist | `seo-strategist.html` | 25–30 min | 10 | 4 |
| Paid Media Strategist | `ppc-strategist.html` | 90 min | 24 | 9 |

**To add a new assessment:**
1. Copy an existing assessment `.html` file
2. Update the system prompt, phases, and questions inside it
3. Add its question bank entry to `questions.js`
4. Add a catalog entry to `assessments.js` — the landing page builds itself from that file

---

## File structure

```
tools/                Developer utilities (not deployed as part of the app)
  test-submission.js  Paste into the browser console on the live site to file a
                      complete fake submission — checks Supabase, /review and the
                      Teamwork board without sitting through the interview
  test-interview.js   Paste into the console ON an assessment page to play a
                      scripted candidate through the whole interview against the
                      live /api/chat. The only way to exercise the closing report
                      turn, which is where this portal has broken twice and which
                      test-submission.js can't reach. Drives the page's own
                      streamChat/parseReport, so it tests the real code path
index.html            Landing page — lists all live assessments (built from assessments.js)
assessments.js        Single source of truth for assessment catalog
questions.js          Question bank for all assessments
technical-seo.html    Technical SEO Specialist assessment
seo-strategist.html   Senior SEO Strategist assessment
ppc-strategist.html   Paid Media Strategist assessment
review.html           Reviewer dashboard — load any report by completion code
_worker.js            Cloudflare Worker — API proxy + data layer (Pages requires the
                      underscore; this is the only worker file, don't add a copy)
wrangler.toml         Cloudflare deployment config
```

---

## Worker API routes

| Method | Path | What it does |
|---|---|---|
| POST | `/api/chat` | Proxies messages to Claude (Anthropic API). **Streams** — the response is a `text/event-stream` of Anthropic SSE frames, not a JSON message. |
| POST | `/api/submit` | Saves report to Supabase + creates Teamwork task |
| GET | `/api/report/:code` | Returns report JSON for reviewer dashboard (requires `X-Admin-Passcode` header) |

---

## Infrastructure

| Service | What for | Project/location |
|---|---|---|
| Cloudflare Pages | Hosting + Worker | Project: `employment-skills-assessment` |
| GitHub | Source of truth | `DonnasBizNiche/mbn-hiring-portal` |
| Supabase | Store assessment reports | Project `vlanjprnlcvztskngocg` (MBN Reporting Command Center), table: `assessment_reports` |
| Teamwork | Candidate task cards | Project 758831 ("Donna's Workspace - Internal"), tasklist 3346283, workflow 82559, stage 474512 ("Completed Skills Assessment" board column) |
| Anthropic | Claude powers the interviews | claude-opus-4-5, `max_tokens` 32000, streamed |

---

## Cloudflare environment variables (secrets)

Set in Cloudflare Pages → Settings → Environment Variables. All marked **Secret**.

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Claude API key |
| `CLAUDE_MODEL` | Optional — model the interviews run on (default `claude-opus-4-5`). Set this to move to a newer model without a deploy. |
| `SUPABASE_URL` | `https://vlanjprnlcvztskngocg.supabase.co` |
| `SUPABASE_SERVICE_KEY` | Supabase service role key (Settings → API in Supabase dashboard) |
| `TEAMWORK_API_KEY` | Teamwork personal access token |
| `TEAMWORK_TASKLIST_ID` | Optional — tasklist the card is created in (default 3346283) |
| `TEAMWORK_WORKFLOW_ID` | Optional — board the card is filed on (default 82559) |
| `TEAMWORK_STAGE_ID` | Optional — board column (default 474512, "Completed Skills Assessment") |
| `ADMIN_PASSCODE` | Password for the `/review` dashboard |

---

## Supabase table: `assessment_reports`

```sql
id               uuid PK
submitted_at     timestamptz
completion_code  text UNIQUE        -- candidate shares this with MBN
assessment_type  text               -- 'tech_seo' | 'seo_strategist' | 'ppc_strategist'
candidate_name   text
candidate_email  text
referral_source  text
score            integer
report_json      jsonb              -- full Claude-generated report
```

`report_json` also carries `transcript` — the full candidate conversation — on every
submission, plus `report_incomplete: true` (no AI summary could be parsed) or
`report_truncated: true` (only part of it parsed). The review page shows the transcript
whenever the per-question report is missing, so a submission is never unrecoverable.

> The `assessments` table in the same Supabase project is for the **staff SEO skills test**
> (separate tool at `mbn-assessment/` on Desktop / `skills_assessment` GitHub repo) — not this portal.

---

## Deploy

Deploys automatically on push to `main` via the GitHub → Cloudflare Pages integration.

Manual deploy (if needed):
```bash
cd "C:\Users\Donna Donahue\Desktop\mbn-hiring-portal"
wrangler pages deploy . --project-name employment-skills-assessment --branch main
```

> Warning: omitting `--branch main` sends the deploy to a **Preview URL**, not production.

---

## History

- Portal was originally built entirely in Claude (no local source files existed)
- Source recovered August 2026 from Cloudflare production deployment `d1b7ad8e`
- `worker.js` reconstructed from the API contracts visible in the assessment HTML files
- GitHub repo created August 2026 — all future changes should be made here and pushed
- August 2026: candidates were losing completed assessments. The closing report is a
  large JSON blob (24 verbatim answers + 24 written assessments) and `max_tokens` was
  4096, so it was cut off mid-JSON. The page only recognised a report that had both its
  `<<<REPORT_START>>>` and `<<<REPORT_END>>>` markers, so a cut-off report was printed
  into the chat as raw code and `complete()` never ran — no Supabase row, no Teamwork
  card, and a completion code that matched nothing. Fixed by raising `max_tokens`,
  detecting the opening marker alone, salvaging whatever JSON parsed, and always
  submitting with the full transcript attached.
- August 2026: the fix above stopped the truncation but broke the last turn a
  different way. The closing report takes minutes to generate, and it was being
  requested unstreamed — so that request sat with no bytes on the wire until it
  was dropped in transit, the worker's `fetch` threw, and the candidate got
  `Connection error: Error 500` after finishing the whole interview. `/api/chat`
  now streams: the worker passes Anthropic's SSE straight through and the
  assessment pages reassemble it, so the reply is rendered as it arrives and a
  long turn can't time out. Two things to know if you touch this:
    - `/api/chat` returns an event stream, not JSON. Anything new that calls it
      has to read `response.body`, not `response.json()`.
    - The page holds back any trailing text that could be the start of
      `<<<REPORT_START>>>`, so a half-arrived marker never flashes on screen.
  Claude API errors are now unwrapped into `{ error: { message } }` as well —
  "Error 500" told nobody anything, including us.
- August 2026: the Senior SEO Strategist assessment was cut from 24 questions to
  10 and from 90 minutes to about 25. The old version examined specialist
  execution — faceted-nav indexation across 4,500 SKUs, dead-SKU handling,
  listings management at scale, a 12-month revenue forecast with attribution
  methodology, plus a keyword-mapping table and a data-reading exercise. That is
  a senior audit, not a first-round screen, and it wasn't measuring the thing we
  hire for. The assessment is now one arc — take over the account, diagnose it,
  plan the first 90 days, run the client relationship — and the interviewer is
  explicitly told not to ask for forecasts, keyword tables, or audits.
  The reference material (keyword table, GBP profile, analytics tables) is gone;
  only the client brief remains. Competency rollups changed to match:
  `keyword_mapping`, `channel_strategy` and `measurement_forecasting` were
  replaced by `account_takeover`, `prioritization` and `practical_judgment`.
  `revenue_orientation` and `stakeholder_influence` were deliberately left
  alone — `review.html` identifies an SEO strategist report by the presence of
  `revenue_orientation`, so renaming it would orphan every earlier report.
  For the same reason the retired `q1_`–`q24_` question ids are still in
  `questions.js` under the new `s1_`–`s10_` set: `/review` looks question text
  up by id, so deleting them would blank out every assessment taken before the
  rewrite. Don't use them for anything new.
- The duplicate `worker.js` was deleted at the same time — Pages only ever ran
  `_worker.js`, so edits to the copy silently did nothing.
- Also August 2026: candidate cards never showed on the Teamwork board. Creating a
  task via the API leaves it with no workflow stage — attached to the board but in
  no column, so the board view doesn't render it. The submit route now moves the new
  task into the "Completed Skills Assessment" column after creating it, and records
  the outcome of both calls in `report_json.teamwork` so a silent failure can't
  happen again. Note "Completed Skills" is a **board column**, not a tasklist —
  earlier notes here described it as a tasklist, which sent people looking in the
  wrong place.
