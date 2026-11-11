// findjob — בדיקה שמפתח AI שהמשתמש הדביק עובד (Groq, Google Gemini, Claude או OpenAI). רק רשימת המודלים, בלי לשמור כלום.
const SB = 'https://cavfthbkwosnwqdqkmap.supabase.co';
const PK = 'sb_publishable_kTXa--U7akPkHozrbkw0Xg_w4_u5iOH';
const LLM = require('./_llm');
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  const { key = '', token = '' } = req.body || {};
  const u = await fetch(SB + '/auth/v1/user', { headers: { apikey: PK, Authorization: 'Bearer ' + token } });
  if (!u.ok) return res.status(401).json({ error: 'auth' });
  try { return res.json(await LLM.checkKey(key)); } catch (e) { return res.json({ ok: false, why: 'net' }); }
};
