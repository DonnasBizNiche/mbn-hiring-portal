/**
 * MBN Hiring Portal — Cloudflare Pages Worker
 *
 * Routes:
 *   POST /api/chat          → proxy to Claude (Anthropic API)
 *   POST /api/submit        → save report to Supabase + create Teamwork task
 *   GET  /api/report/:code  → retrieve report from Supabase (admin only)
 *   *                       → static assets
 *
 * Secrets (set via: wrangler secret put <NAME>):
 *   ANTHROPIC_API_KEY
 *   SUPABASE_URL
 *   SUPABASE_SERVICE_KEY   (service role key — needed to bypass RLS for reads)
 *   TEAMWORK_API_KEY
 *   ADMIN_PASSCODE         (shown on review page login)
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, X-Admin-Passcode',
};

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }

    // POST /api/chat — proxy to Claude
    if (url.pathname === '/api/chat' && request.method === 'POST') {
      const { messages } = await request.json();

      // Anthropic requires system prompt as a top-level field, not a messages role
      const systemMsg = messages.find(m => m.role === 'system');
      const filteredMessages = messages.filter(m => m.role !== 'system');

      const body = {
        model: 'claude-opus-4-5',
        max_tokens: 4096,
        messages: filteredMessages,
      };
      if (systemMsg) body.system = systemMsg.content;

      const res = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok) return json({ error: data }, res.status);
      return json(data);
    }

    // POST /api/submit — save report to Supabase + create Teamwork task
    if (url.pathname === '/api/submit' && request.method === 'POST') {
      const report = await request.json();
      const code = report.completion_code;
      const candidateName = report.candidate_name || 'Unknown';
      const assessmentType = report.assessment_type || 'assessment';
      const score = report.overall_score ?? report.score ?? null;

      // Save to Supabase
      const supaRes = await fetch(`${env.SUPABASE_URL}/rest/v1/assessment_reports`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: env.SUPABASE_SERVICE_KEY,
          Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({
          completion_code: code,
          assessment_type: assessmentType,
          candidate_name: candidateName,
          candidate_email: report.candidate_email || null,
          referral_source: report.referral_source || null,
          score: score,
          report_json: report,
          submitted_at: new Date().toISOString(),
        }),
      });

      if (!supaRes.ok) {
        const err = await supaRes.text();
        console.error('Supabase save failed:', err);
        return json({
          error: 'Failed to save report',
          detail: err,
          status: supaRes.status,
          url: `${env.SUPABASE_URL}/rest/v1/assessment_reports`,
          keyPrefix: env.SUPABASE_SERVICE_KEY ? env.SUPABASE_SERVICE_KEY.slice(0, 20) + '...' : 'MISSING',
        }, 500);
      }

      // Create Teamwork task
      const taskName = `${assessmentType.toUpperCase()} — ${candidateName}${score != null ? ` (${score}%)` : ''} — Code: ${code}`;
      const description = [
        `Candidate: ${candidateName}`,
        `Email: ${report.candidate_email || 'Not provided'}`,
        `Assessment: ${assessmentType}`,
        score != null ? `Score: ${score}%` : '',
        `Completion Code: ${code}`,
        `Referral: ${report.referral_source || 'Not provided'}`,
        `Date: ${new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })}`,
      ].filter(Boolean).join('\n');

      const twRes = await fetch(
        'https://mybizniche.teamwork.com/projects/api/v3/tasklists/3346283/tasks.json',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Basic ${btoa(env.TEAMWORK_API_KEY + ':xxx')}`,
          },
          body: JSON.stringify({
            data: {
              type: 'tasks',
              attributes: { name: taskName, description },
            },
          }),
        }
      );
      const twText = await twRes.text();
      const twOk = twRes.ok;

      return json({ ok: true, code, teamwork: twOk ? 'created' : `failed ${twRes.status}: ${twText}` });
    }

    // GET /api/report/:code — retrieve report for reviewer dashboard
    if (url.pathname.startsWith('/api/report/') && request.method === 'GET') {
      const passcode = request.headers.get('X-Admin-Passcode');
      if (passcode !== env.ADMIN_PASSCODE) {
        return json({ error: 'Unauthorized' }, 401);
      }

      const code = decodeURIComponent(url.pathname.replace('/api/report/', ''));

      const res = await fetch(
        `${env.SUPABASE_URL}/rest/v1/assessment_reports?completion_code=eq.${encodeURIComponent(code)}&select=*&limit=1`,
        {
          headers: {
            apikey: env.SUPABASE_SERVICE_KEY,
            Authorization: `Bearer ${env.SUPABASE_SERVICE_KEY}`,
          },
        }
      );

      const rows = await res.json();
      if (!rows.length) return json({ error: 'Not found' }, 404);
      return json(rows[0].report_json);
    }

    // Static assets
    return env.ASSETS.fetch(request);
  },
};
