// findjob — מפעיל את הסריקה בזמן. GitHub מאחר לפעמים בשעות בהפעלת ריצות מתוזמנות, אז Vercel Cron
// מפעיל אותה פעמיים ביום (vercel.json). הלו"ז של GitHub נשאר כגיבוי, והסריקה מדלגת אם כבר רצה בשעות האחרונות.
// דורש ב-Vercel: GH_DISPATCH_TOKEN (Actions בלבד) ו-CRON_SECRET (Vercel שולח אותו בעצמו לקריאות ה-cron).
const REPO = 'orsmo12/findjob';

module.exports = async (req, res) => {
  const secret = String(process.env.CRON_SECRET || '');
  if (!secret || req.headers.authorization !== `Bearer ${secret}`) return res.status(401).json({ error: 'auth' });
  const gh = String(process.env.GH_DISPATCH_TOKEN || '').trim();
  if (!gh) return res.status(500).json({ error: 'no_token' });
  const r = await fetch(`https://api.github.com/repos/${REPO}/actions/workflows/nightly.yml/dispatches`, {
    method: 'POST', headers: { Authorization: 'Bearer ' + gh, Accept: 'application/vnd.github+json', 'Content-Type': 'application/json', 'User-Agent': 'findjob' },
    body: JSON.stringify({ ref: 'main', inputs: { meeting: '', user: '' } }) });
  return res.status(r.status === 204 ? 200 : 502).json({ ok: r.status === 204, status: r.status });
};
