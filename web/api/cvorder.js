// findjob — סידור קורות חיים שנקראו מעורבבים (שתי עמודות). ה-AI מחזיר רק סדר של מספרי שורות;
// האפליקציה בונה את הטקסט מהשורות שלה ובודקת שהסדר שלם, כך שאי אפשר להוסיף או לשנות מילה. שום דבר לא נשמר כאן.
const SB = 'https://cavfthbkwosnwqdqkmap.supabase.co';
const PK = 'sb_publishable_kTXa--U7akPkHozrbkw0Xg_w4_u5iOH';
const LLM = require('./_llm');
const clean = v => String(v || '').trim().replace(/^GROQ_API_KEY=/, '').replace(/^["']|["']$/g, '').trim();

const PROMPT = numbered => `These are the lines of a CV, extracted from a PDF with two or more columns, so the reading order is mixed.
Put them in the natural reading order: each section (e.g. Summary, Experience, Education, Skills, Projects, Languages) together, with its heading first, and the lines of each job or degree together.
Return JSON only: {"order": [line numbers, every number exactly once]}. Do not drop, merge or repeat lines.

${numbered}`;

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  const { lines = [], token = '' } = req.body || {};
  const key = clean(process.env.GROQ_API_KEY);
  if (!key) return res.status(500).json({ error: 'no_key' });
  if (!Array.isArray(lines) || lines.length < 3 || lines.length > 220) return res.status(400).json({ error: 'lines' });
  const u = await fetch(SB + '/auth/v1/user', { headers: { apikey: PK, Authorization: 'Bearer ' + token } });
  const ud = await u.json().catch(() => null);
  if (!u.ok || !ud || !ud.id) return res.status(401).json({ error: 'auth' });
  const pr = await fetch(`${SB}/rest/v1/profiles?select=state&user_id=eq.${ud.id}`, { headers: { apikey: PK, Authorization: 'Bearer ' + token } });
  const own = String((((await pr.json().catch(() => []))[0] || {}).state || {}).ai_key || '').trim();
  const numbered = lines.map((l, i) => `${i}: ${String(l).slice(0, 200)}`).join('\n');
  try {
    const raw = await LLM.complete(own, key, [{ role: 'user', content: PROMPT(numbered) }], { temperature: 0, max_tokens: 1500 });
    const d = JSON.parse((String(raw).match(/\{[\s\S]*\}/) || ['{}'])[0]);
    return res.status(200).json({ order: Array.isArray(d.order) ? d.order.map(Number) : [] });
  } catch (e) { return res.status(200).json({ order: [] }); }
};
