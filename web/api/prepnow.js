// findjob — "להכין עכשיו": מפעיל ריצה של הסוכנים רק למשתמש הזה, בלי לחכות לריצה הקבועה.
// בודק שהמשתמש מחובר, מגביל לפעם אחת ב-10 דקות, ומפעיל את letters.yml ב-GitHub עם input user.
// יואב יוצר את המשימות בתחילת הריצה (מה שחסר במשרות השמורות), ובסוף נבדק שהמשרות עדיין פתוחות.
// דורש ב-Vercel: GH_DISPATCH_TOKEN (טוקן GitHub עם הרשאת Actions בלבד לריפו findjob).
const SB = 'https://cavfthbkwosnwqdqkmap.supabase.co';
const PK = 'sb_publishable_kTXa--U7akPkHozrbkw0Xg_w4_u5iOH';
const REPO = 'orsmo12/findjob';
const GAP_MIN = 10;

async function sb(path, token, opts = {}) {
  const r = await fetch(SB + path, { ...opts, headers: { apikey: PK, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', ...(opts.headers || {}) } });
  return { ok: r.ok, data: await r.json().catch(() => null) };
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  const { token = '' } = req.body || {};
  const u = await sb('/auth/v1/user', token);
  if (!u.ok || !u.data || !u.data.id) return res.status(401).json({ error: 'auth' });
  const uid = u.data.id;
  const gh = String(process.env.GH_DISPATCH_TOKEN || '').trim();
  if (!gh) return res.status(500).json({ error: 'no_token' });
  const p = await sb(`/rest/v1/profiles?select=chat_use&user_id=eq.${uid}`, token);
  const use = (p.ok && p.data && p.data[0] && p.data[0].chat_use) || {};
  const last = use.prep_at ? Date.parse(use.prep_at) : 0;
  const wait = Math.ceil((last + GAP_MIN * 60e3 - Date.now()) / 60e3);
  if (wait > 0) return res.status(429).json({ error: 'wait', minutes: wait, since: use.prep_at });
  const r = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/letters.yml/dispatches`, {
    method: 'POST', headers: { Authorization: 'Bearer ' + gh, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json', 'User-Agent': 'findjob' },
    body: JSON.stringify({ ref: 'main', inputs: { user: uid } }) });
  if (r.status !== 204) return res.status(502).json({ error: 'dispatch', status: r.status });
  const now = new Date().toISOString();
  if (p.ok && p.data && p.data[0]) {   // נשמר באותה עמודה של מונה הצ׳אט (בלי לדרוס אותו)
    await sb(`/rest/v1/profiles?user_id=eq.${uid}`, token, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ chat_use: { ...use, prep_at: now } }) });
  }
  return res.status(200).json({ ok: true, at: now });
};
