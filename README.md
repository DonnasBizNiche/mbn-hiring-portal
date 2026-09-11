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

## The rule this portal is built on

**A candidate's answers must never exist in only one place.**

Every failure this portal has had is the same failure wearing different clothes. A
25-minute assessment lived entirely in the candidate's browser until a single request at
the very end, and anything that disturbed that request destroyed the work:

| What went wrong | What it cost |
|---|---|
| Closing report truncated at `max_tokens` | No row, no card, a code matching nothing |
| Closing report requested unstreamed, dropped in transit | `Error 500` after the whole interview |
| Completion code shown *before* the save finished | Candidate copied it and closed the tab, cancelling the save, its retries and the rescue card |
| Tab closed while the save was still in flight | Nothing stashed locally either — the stash only ran after all retries failed |

Four causes, one outcome, two real candidates lost. Each was fixed in turn and a new one
appeared, because every fix protected that final moment instead of removing it.

There is now no such moment. `/api/progress` writes the transcript to the server after
every answer, so the closing report is an *enrichment of a record that already exists*.
If everything at the end fails — model, network, browser, tab — the answers are still in
`assessment_reports`, flagged `in_progress`, readable in `/review`, and the report can be
regenerated from them.

**If you add anything to this portal, do not reintroduce a single point where the work
only exists once.** `tools/check-worker.mjs` and `tools/check-progress.mjs` exist to make
that regression loud.

---

## Assessments

| Role | File | Duration | Questions | Phases | Notes |
|---|---|---|---|---|---|
| Technical SEO Specialist | `technical-seo.html` | 45–60 min | 14 | 7 |
| Senior SEO Strategist | `seo-strategist.html` | 25–30 min | 10 | 4 |
| ~~Paid Media Strategist~~ | `ppc-strategist.html` | — | — | — | **Retired** Aug 2026 — hidden from the landing page (`status: 'retired'` in `assessments.js`). Files intact; set back to `'live'` to restore. Still reachable at `/ppc-strategist` by direct link. |

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
  check-codes.mjs     node tools/check-codes.mjs — asserts the PAGE generates the
                      completion code and that 100k of them collide ~never.
                      Claude used to invent the code and anchored on the example
                      in the prompt, producing near-identical codes until two
                      real candidates were issued the same one
  check-completion.mjs node tools/check-completion.mjs — holds the save open and
                      asserts the completion screen still says "Filing…". A real
                      candidate was lost because the code appeared before the
                      save was attempted, so they copied it and closed the tab,
                      cancelling the save, its retries and the rescue card
  check-pages.mjs     node tools/check-pages.mjs *.html — executes each page's
                      script against a DOM stub and fails if it throws, then
                      checks every live assessment defines the submission-failure
                      helpers. Run before pushing any assessment page change:
                      `node --check` only parses, and a page calling a function
                      that was never defined has shipped that way before
  check-progress.mjs  node tools/check-progress.mjs — asserts the page claims a
                      code on the server before the first question and saves
                      every answer as it is given, and that neither can stall
                      the interview if the server hangs or fails
  check-worker.mjs    node tools/check-worker.mjs — runs the worker's storage
                      routes against a stand-in table: the row accumulates
                      instead of multiplying, an abandoned assessment is still
                      readable, and nothing Postgres rejects reaches jsonb
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
| POST | `/api/progress` | The candidate's answers as they are given. `claim:true` reserves the completion code with a plain insert (409 if taken); every call after that upserts onto the same row. Rows are `status:'in_progress'` and file no Teamwork card. **This is what makes the end of the assessment stop mattering** — see below. |
| POST | `/api/submit` | Saves report to Supabase + creates Teamwork task. Upserts onto the row `/api/progress` has been building and marks it `complete`. |
| POST | `/api/rescue` | Last-resort path when `/api/submit` fails: files the candidate's full transcript onto the Teamwork board, with the server error, so a failed save is never a silent loss |
| GET | `/api/reports` | Lists recent submissions, newest first, so a report can be found without an exact code (requires `X-Admin-Passcode`). Never returns `report_json`. |
| GET | `/api/report/:code` | Returns report JSON for reviewer dashboard (requires `X-Admin-Passcode` header). Column values are merged over the stored JSON, which is the only reason an unfinished record has a name on it. |

---

## Infrastructure

| Service | What for | Project/location |
|---|---|---|
| Cloudflare Pages | Hosting + Worker | Project: `employment-skills-assessment` |
| GitHub | Source of truth | `DonnasBizNiche/mbn-hiring-portal` |
| Supabase | Store assessment reports | Table `assessment_reports`. **Which project is not documented here — read `SUPABASE_URL` in Cloudflare.** It is NOT `vlanjprnlcvztskngocg`; see the warning below. |
| Teamwork | Candidate task cards | Project 758831 ("Donna's Workspace - Internal"), tasklist 3346283, workflow 82559, stage 474512 ("Completed Skills Assessment" board column) |
| Anthropic | Claude powers the interviews | claude-opus-4-5, `max_tokens` 32000, streamed |

---

## Cloudflare environment variables (secrets)

Set in Cloudflare Pages → Settings → Environment Variables. All marked **Secret**.

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Claude API key |
| `CLAUDE_MODEL` | Optional — model the interviews run on (default `claude-opus-4-5`). Set this to move to a newer model without a deploy. |
| `SUPABASE_URL` | The Supabase project reports are written to. Whatever is set in Cloudflare is the truth — do not assume the value from any note in this repo. |
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

`report_json.status` is `'in_progress'` from the moment the assessment starts and becomes
`'complete'` when `/api/submit` lands. An `in_progress` row is a real candidate mid-flight
or one who never finished — it holds their answers so far and nothing else, and `/review`
labels it as such. **Rows are keyed on `completion_code`, which is `UNIQUE`, and every
write after the initial claim is an upsert** — so an assessment is one row that grows, not
a row per answer. Don't add a write path here that inserts without `on_conflict`.

> **Don't trust a project id written down here — check `SUPABASE_URL` in Cloudflare.**
> This README used to name `vlanjprnlcvztskngocg` ("MBN Reporting Command Center") as the
> store. In August 2026 that was checked directly and it is wrong twice over: that project
> is actually called "SEO Command Center", and its `assessment_reports` table has never
> received a single row — `pg_stat_user_tables.n_tup_ins` is 0. Meanwhile a live submission
> returned success, which the worker only does after Supabase accepts the insert. So the
> portal writes to a project that is not that one and is not in the same Supabase account.
> Half a debugging session went into an empty table because of that line. If you need to
> query the reports directly, get the real project from the Cloudflare environment variable
> first.
>
> A separate `assessments` table exists in `vlanjprnlcvztskngocg` for the **staff SEO skills
> test** (different tool: `mbn-assessment/` on Desktop, `skills_assessment` GitHub repo).
> It has nothing to do with this portal — another easy way to end up in the wrong place.

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

## Checking whether a submission actually worked

In order, cheapest first:

1. **The Teamwork board.** A finished assessment becomes a card in the "Completed Skills
   Assessment" column. If it's there, everything worked.
2. **`/review` with the completion code.** Reads back through the worker, so it proves the
   Supabase write landed without needing to know which project that is.
3. **`report_json.teamwork` on the row.** Records the HTTP status and error body of *both*
   Teamwork calls — creating the task and filing it into the column — so a card that exists
   but never made it onto the board is distinguishable from one that was never created.

To generate a submission without sitting an interview, run `tools/test-submission.js`.
To test the interview itself, run `tools/test-interview.js` — but note it defaults to
`SUBMIT = false`, so a completely successful run leaves Supabase and the Teamwork board
empty. That is not a broken integration; it is the script doing what it was told.

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
- September 2026: two more losses, same root cause as everything above. First, the
  completion code appeared the instant the interview ended — before the save was even
  attempted. Candidates copied it and closed the tab, which cancelled the save, its
  retries and the rescue card with it; the code they were holding matched nothing. The
  completion screen now shows "Filing…" and only reveals the code once the server has
  confirmed, guards the tab against being closed while that is in flight, and writes the
  report to `localStorage` *before* the first attempt rather than after the last one
  fails. `tools/check-completion.mjs` holds a save open and asserts all of that.
- September 2026: completion codes were being generated by Claude, and a model asked for
  something random produces what looks plausible rather than what is unlikely. Anchored
  on the `MBN-7K4P` example in the prompt, it produced `MBN-8K2R`, `NLP-8K2R`, `NLP-8K2M`,
  `MBN-9K2R`, `MBN-9T3K`, `MBN-9K3R` — three sharing "8K2", four within one character of
  another. Two real candidates were issued the identical code, making their assessments
  indistinguishable, and several earlier "lost report" hunts turned out to be a
  near-identical code typed in by mistake. The page now generates the code itself from a
  32-character alphabet with `I`, `O`, `0` and `1` removed; `tools/check-codes.mjs` draws
  100,000 of them and asserts ~no collisions and a uniform distribution.
- September 2026: **the moment was removed.** See "The rule this portal is built on"
  above. `/api/progress` saves the transcript after every answer against a completion code
  claimed on the server before the first question is asked, so an assessment exists in the
  database from the moment it starts. Notes for anyone touching this:
    - The claim is a plain insert, so a taken code returns 409 and the page picks another.
      Every write after that upserts on `completion_code`. `/api/submit` upserts onto that
      same row and flips `status` to `complete`.
    - In-progress rows deliberately file **no** Teamwork card. An unfinished assessment is
      not a candidate to review, but it is worth not losing.
    - Both progress calls are bounded with an `AbortController`, and failures are silent
      by design. `start()` waits on the claim before the first question appears, so an
      unanswered socket would otherwise leave a candidate looking at an empty screen. A
      progress save that doesn't land is not the candidate's problem: the next answer
      tries again, and the local stash and final submit are still behind it.
    - The upserts need a unique index on `completion_code`. It is supposed to be there —
      but this README once named the wrong Supabase project entirely, and the end of a
      25-minute assessment is not where a schema assumption should be discovered. If
      Postgres returns 42P10 ("no unique or exclusion constraint matching the ON CONFLICT
      specification"), `/api/submit` falls back to the plain insert it used before, and to
      a suffixed code if the row genuinely exists. Submitting can never be worse than it
      was before incremental saving existed.
    - `/review` lists unfinished assessments with an **IN PROGRESS** tag and opens them to
      the raw transcript with a banner saying there is no report because it was never
      completed. `/api/report/:code` merges the column values over the stored JSON — that
      is the only reason an unfinished record has a name on it, since a candidate who
      hasn't submitted has no report blob to read one from.
