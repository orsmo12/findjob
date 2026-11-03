// findjob — יואב בונה "ערכת תחום" למשתמש שלא בפיתוח תוכנה או בהנדסת מכונות.
// מקורות החיים בלבד: אילו תפקידים מתאימים, איך הם נקראים במודעות (אנגלית ועברית), ואילו כלים חשובים בתחום.
const SB = 'https://cavfthbkwosnwqdqkmap.supabase.co';
const PK = 'sb_publishable_kTXa--U7akPkHozrbkw0Xg_w4_u5iOH';
const MODELS = ['openai/gpt-oss-120b', 'qwen/qwen3.8-27b', 'openai/gpt-oss-20b', 'llama-3.1-8b-instant'];
const clean = v => String(v || '').trim().replace(/^GROQ_API_KEY=/, '').replace(/^["']|["']$/g, '').trim();

const PROMPT = cv => `You build a job-search kit for a candidate in Israel, based ONLY on their CV.
CV:
${cv.slice(0, 6000)}

Return JSON only:
{"label": "the professional field in Hebrew, 2-4 words (e.g. 'הנדסה כימית', 'שיווק דיגיטלי')",
 "field": ["4-6 Hebrew answers to 'what is your professional background' in this field, last one 'אחר'"],
 "roles": [5-8 items: {"label": "role family in Hebrew, short", "titles": ["1-3 English job titles exactly as Israeli job ads write them"]}],
 "he_queries": ["2-3 Hebrew search phrases as written in Israeli job ads, e.g. 'מהנדס כימיה'"],
 "tools": ["up to 10 tools/skills typical for this field that employers list"]}
Roles must be realistic entry-level paths for this CV. No seniority words in titles.`;

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  const { cv = '', token = '' } = req.body || {};
  const key = clean(process.env.GROQ_API_KEY);
  if (!key) return res.status(500).json({ error: 'no_key' });
  const u = await fetch(SB + '/auth/v1/user', { headers: { apikey: PK, Authorization: 'Bearer ' + token } });
  if (!u.ok) return res.status(401).json({ error: 'auth' });
  if (cv.trim().length < 80) return res.status(400).json({ error: 'no_cv' });
  for (const model of MODELS) {
    try {
      const body = { model, messages: [{ role: 'user', content: PROMPT(cv) }], temperature: 0.2, max_tokens: 1800 };
      if (model.includes('gpt-oss')) body.reasoning_effort = 'low';
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', { method: 'POST', headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!r.ok) continue;
      const d = await r.json();
      const t = ((d.choices && d.choices[0] && d.choices[0].message.content) || '').split('</think>').pop();
      const m = t.match(/\{[\s\S]*\}/);
      if (!m) continue;
      const p = JSON.parse(m[0]);
      const roles = (p.roles || []).filter(x => x && x.label && (x.titles || []).length).slice(0, 8)
        .map(x => ({ label: String(x.label).slice(0, 40), titles: x.titles.map(String).filter(t => /^[A-Za-z][A-Za-z0-9 &/+.-]{2,50}$/.test(t)).slice(0, 3) }))
        .filter(x => x.titles.length);
      if (roles.length < 3) continue;
      return res.json({ label: String(p.label || 'תחום אחר').slice(0, 40), field: (p.field || []).map(String).slice(0, 6),
        roles, he_queries: (p.he_queries || []).map(String).filter(q => /[א-ת]/.test(q)).slice(0, 3), tools: (p.tools || []).map(String).slice(0, 10) });
    } catch (e) { /* המודל הבא */ }
  }
  return res.status(502).json({ error: 'model' });
};
