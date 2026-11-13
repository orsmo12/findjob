// findjob — "הדבקת מייל מהחברה": שי מסווג מייל שהמשתמש הדביק (דחייה / הזמנה / מטלה / הצעה / לא ברור),
// מוציא תאריך ואיש קשר רק אם הם כתובים במייל, ומציע עדכון. שום דבר לא נשמר כאן — המשתמש מאשר באפליקציה.
const SB = 'https://cavfthbkwosnwqdqkmap.supabase.co';
const PK = 'sb_publishable_kTXa--U7akPkHozrbkw0Xg_w4_u5iOH';
const LLM = require('./_llm');
const clean = v => String(v || '').trim().replace(/^GROQ_API_KEY=/, '').replace(/^["']|["']$/g, '').trim();

const PROMPT = (co, title, today, mail) => `Classify this email the candidate received about a job application.
Job: ${title} at ${co}. Today is ${today}.
Return JSON only: {"kind": "rejection|screening|task|interview|offer|unclear",
 "when": "ISO date-time ONLY if a specific date/time is written in the email, else empty",
 "contact": "name of the person who wrote, only if written, else empty",
 "summary": "one short Hebrew sentence of what the email says"}
"screening" = a short intro call (often HR/recruiter). "task" = home assignment / online test / questionnaire.
"interview" = a professional, manager or HR interview. If you are not sure, kind = "unclear". Never invent a date.

EMAIL:
${mail}`;

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  const { text = '', co = '', title = '', token = '' } = req.body || {};
  const key = clean(process.env.GROQ_API_KEY);
  if (!key) return res.status(500).json({ error: 'no_key' });
  if (String(text).trim().length < 40) return res.status(400).json({ error: 'short' });
  const u = await fetch(SB + '/auth/v1/user', { headers: { apikey: PK, Authorization: 'Bearer ' + token } });
  const ud = await u.json().catch(() => null);
  if (!u.ok || !ud || !ud.id) return res.status(401).json({ error: 'auth' });
  const pr = await fetch(`${SB}/rest/v1/profiles?select=state&user_id=eq.${ud.id}`, { headers: { apikey: PK, Authorization: 'Bearer ' + token } });
  const own = String((((await pr.json().catch(() => []))[0] || {}).state || {}).ai_key || '').trim();
  const today = new Date().toISOString().slice(0, 10);
  let d = {};
  try {
    const raw = await LLM.complete(own, key, [{ role: 'user', content: PROMPT(String(co).slice(0, 80), String(title).slice(0, 120), today, String(text).slice(0, 6000)) }], { temperature: 0.1, max_tokens: 300 });
    d = JSON.parse((String(raw).match(/\{[\s\S]*\}/) || ['{}'])[0]);
  } catch (e) { return res.status(200).json({ kind: 'unclear', summary: '' }); }
  const kinds = ['rejection', 'screening', 'task', 'interview', 'offer', 'unclear'];
  const kind = kinds.includes(d.kind) ? d.kind : 'unclear';
  let when = String(d.when || '');
  if (when && (isNaN(Date.parse(when)) || !String(text).match(/\d/))) when = '';   // תאריך שלא כתוב במייל לא מוצע
  return res.status(200).json({ kind, when, contact: String(d.contact || '').slice(0, 60), summary: String(d.summary || '').slice(0, 200) });
};
