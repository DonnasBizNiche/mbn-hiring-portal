# MBN Hiring Portal

AI-powered skills assessments for MBN job candidates.

**Live:** https://employment-skills-assessment.pages.dev

---

## What this is

A Cloudflare Pages app that runs AI-driven conversational assessments for candidates applying to MBN roles. Each assessment is a multi-phase interview conducted by Claude. When a candidate finishes, the portal:

1. Saves the full report to Supabase (`assessment_reports` table)
2. Creates a task in Teamwork (project 758831, tasklist 3346283 — "Completed Skills" board)
3. Gives the candidate a completion code to share with MBN
4. Lets MBN staff pull up the report at `/review` using the completion code + admin passcode

---

## Assessments

| Role | File | Duration | Questions | Phases |
|---|---|---|---|---|
| Technical SEO Specialist | `technical-seo.html` | 45–60 min | 14 | 7 |
| Senior SEO Strategist | `seo-strategist.html` | 90 min | 24 | 9 |
| Paid Media Strategist | `ppc-strategist.html` | 90 min | 24 | 9 |

**To add a new assessment:**
1. Copy an existing assessment `.html` file
2. Update the system prompt, phases, and questions inside it
3. Add its question bank entry to `questions.js`
4. Add a catalog entry to `assessments.js` — the landing page builds itself from that file

---

## File structure

```
index.html            Landing page — lists all live assessments (built from assessments.js)
assessments.js        Single source of truth for assessment catalog
questions.js          Question bank for all assessments
technical-seo.html    Technical SEO Specialist assessment
seo-strategist.html   Senior SEO Strategist assessment
ppc-strategist.html   Paid Media Strategist assessment
review.html           Reviewer dashboard — load any report by completion code
worker.js             Cloudflare Worker — API proxy + data layer
wrangler.toml         Cloudflare deployment config
```

---

## Worker API routes

| Method | Path | What it does |
|---|---|---|
| POST | `/api/chat` | Proxies messages to Claude (Anthropic API) |
| POST | `/api/submit` | Saves report to Supabase + creates Teamwork task |
| GET | `/api/report/:code` | Returns report JSON for reviewer dashboard (requires `X-Admin-Passcode` header) |

---

## Infrastructure

| Service | What for | Project/location |
|---|---|---|
| Cloudflare Pages | Hosting + Worker | Project: `employment-skills-assessment` |
| GitHub | Source of truth | `DonnasBizNiche/mbn-hiring-portal` |
| Supabase | Store assessment reports | Project `vlanjprnlcvztskngocg` (MBN Reporting Command Center), table: `assessment_reports` |
| Teamwork | Candidate task cards | Project 758831, tasklist 3346283 ("Completed Skills") |
| Anthropic | Claude powers the interviews | claude-opus-4-5 |

---

## Cloudflare environment variables (secrets)

Set in Cloudflare Pages → Settings → Environment Variables. All marked **Secret**.

| Variable | Description |
|---|---|
| `ANTHROPIC_API_KEY` | Claude API key |
| `SUPABASE_URL` | `https://vlanjprnlcvztskngocg.supabase.co` |
| `SUPABASE_SERVICE_KEY` | Supabase service role key (Settings → API in Supabase dashboard) |
| `TEAMWORK_API_KEY` | Teamwork personal access token |
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
