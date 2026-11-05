// findjob — בדיקה שמפתח Groq שהמשתמש הדביק עובד. רק קריאה לרשימת המודלים, בלי לשמור כלום.
const SB = 'https://cavfthbkwosnwqdqkmap.supabase.co';
const PK = 'sb_publishable_kTXa--U7akPkHozrbkw0Xg_w4_u5iOH';
module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  const { key = '', token = '' } = req.body || {};
  const u = await fetch(SB + '/auth/v1/user', { headers: { apikey: PK, Authorization: 'Bearer ' + token } });
  if (!u.ok) return res.status(401).json({ error: 'auth' });
  const k = String(key).trim().replace(/^["']|["']$/g, '');
  if (!/^gsk_\w{20,}$/.test(k)) return res.json({ ok: false, why: 'format' });
  const r = await fetch('https://api.groq.com/openai/v1/models', { headers: { Authorization: 'Bearer ' + k } });
  return res.json({ ok: r.ok, why: r.ok ? '' : (r.status === 401 ? 'invalid' : 'groq_' + r.status) });
};
