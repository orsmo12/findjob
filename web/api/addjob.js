// findjob — הוספת משרה מקישור. המשתמש מדביק קישור (או את תיאור המשרה), והמשרה נכנסת לתהליך:
// דירוג מול קורות החיים עכשיו, ומכתב, סקירה והכנה בריצה הבאה של הסוכנים.
// רק קריאה של דף משרה ציבורי. שום התחברות לשום אתר.
const crypto = require('crypto');
const SB = 'https://cavfthbkwosnwqdqkmap.supabase.co';
const PK = 'sb_publishable_kTXa--U7akPkHozrbkw0Xg_w4_u5iOH';
const MODELS = ['openai/gpt-oss-120b', 'qwen/qwen3.8-27b', 'openai/gpt-oss-20b', 'llama-3.1-8b-instant'];
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124 Safari/537.36';

const clean = v => String(v || '').trim().replace(/^GROQ_API_KEY=/, '').replace(/^["']|["']$/g, '').trim();
const unesc = s => s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&nbsp;/g, ' ');
const htmlText = h => unesc(String(h || '')
  .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, ' ')
  .replace(/<(br|\/p|\/li|\/div|\/h\d)[^>]*>/gi, '\n').replace(/<li[^>]*>/gi, '• ')
  .replace(/<[^>]+>/g, ' ')).replace(/[ \t]+/g, ' ').replace(/\n\s*\n+/g, '\n').trim();
const pick = (h, re) => { const m = h.match(re); return m ? htmlText(m[1]).trim() : ''; };
const norm = s => (s || '').toLowerCase().replace(/[^a-z0-9א-ת]+/g, ' ').trim();

async function sb(path, token, opts = {}) {
  const r = await fetch(SB + path, { ...opts, headers: { apikey: PK, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', ...(opts.headers || {}) } });
  return { ok: r.ok, status: r.status, data: await r.json().catch(() => null) };
}

async function readJob(url) {
  const li = url.match(/linkedin\.com\/jobs\/view\/(?:[^/?#]*-)?(\d+)/) || url.match(/[?&]currentJobId=(\d+)/);
  if (li) {
    const r = await fetch(`https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/${li[1]}`, { headers: { 'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9,he;q=0.8' } });
    if (!r.ok) return { text: '' };
    const h = await r.text();
    return { title: pick(h, /top-card-layout__title[^>]*>([\s\S]*?)<\/h\d>/), company: pick(h, /topcard__org-name-link[^>]*>([\s\S]*?)<\/a>/),
      location: pick(h, /topcard__flavor--bullet[^>]*>([\s\S]*?)<\/span>/), text: pick(h, /show-more-less-html__markup[^>]*>([\s\S]*?)<\/div>/), src: 'LinkedIn',
      url: `https://www.linkedin.com/jobs/view/${li[1]}` };
  }
  const r = await fetch(url, { headers: { 'User-Agent': UA, 'Accept-Language': 'he,en;q=0.9' }, redirect: 'follow' });
  if (!r.ok) return { text: '' };
  const h = await r.text();
  const host = new URL(url).hostname.replace(/^www\./, '');
  return { title: pick(h, /<title[^>]*>([\s\S]*?)<\/title>/i), text: htmlText(h).slice(0, 9000), src: /greenhouse|lever|ashby|comeet|workday|smartrecruiters/.test(host) ? 'אתר החברה' : host, url };
}

const PROMPT = (cv, prefs, page) => `A candidate pasted a job they want to apply to. Extract the job and rate the fit.
Use ONLY what is written in the PAGE and the CV. Never invent requirements, salary or experience.

CANDIDATE CV:
${cv.slice(0, 5000)}

CANDIDATE PREFERENCES: ${prefs}

PAGE (title hint: ${page.title || '-'}; company hint: ${page.company || '-'}; location hint: ${page.location || '-'}):
${page.text.slice(0, 6000)}

Return JSON only:
{"is_job": true/false,
 "title": "job title as written", "company": "company name as written", "location": "location as written or \\"\\"",
 "salary": "salary ONLY if explicitly written, else \\"\\"",
 "fit": 1.0-5.0, "reasons": [up to 3 short Hebrew reasons, each a concrete CV fact matching the ad],
 "gaps": [up to 2 short Hebrew items: requirements in the ad the CV does not show],
 "seniority_ok": true/false}`;

const LATIN = /[A-Za-z][A-Za-z0-9+#.\-]{2,}/g;
const grounded = (t, src) => (String(t).match(LATIN) || []).every(w => src.toLowerCase().includes(w.toLowerCase().replace(/[.\-,]+$/, '')));

async function groq(key, prompt) {
  for (const model of MODELS) {
    try {
      const body = { model, messages: [{ role: 'user', content: prompt }], temperature: 0.2, max_tokens: 1600 };
      if (model.includes('gpt-oss')) body.reasoning_effort = 'low';
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', { method: 'POST', headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!r.ok) continue;
      const d = await r.json();
      const t = ((d.choices && d.choices[0] && d.choices[0].message.content) || '').split('</think>').pop();
      const m = t.match(/\{[\s\S]*\}/);
      if (m) return JSON.parse(m[0]);
    } catch (e) { /* המודל הבא */ }
  }
  return null;
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  const { url = '', text = '', token = '' } = req.body || {};
  const key = clean(process.env.GROQ_API_KEY);
  if (!key) return res.status(500).json({ error: 'no_key' });
  const u = await sb('/auth/v1/user', token);
  if (!u.ok || !u.data || !u.data.id) return res.status(401).json({ error: 'auth' });
  const uid = u.data.id;
  if (!/^https?:\/\//.test(url) && text.trim().length < 200) return res.status(400).json({ error: 'bad_url' });

  let page = { text: '' };
  if (text.trim().length >= 200) page = { text: text.trim().slice(0, 9000), src: 'הוספת בעצמך', url };
  else { try { page = await readJob(url); } catch (e) { page = { text: '' }; } }
  if (!page.text || page.text.length < 200) return res.status(200).json({ need_text: true });

  const prof = ((await sb(`/rest/v1/profiles?select=cv_text,answers&user_id=eq.${uid}`, token)).data || [])[0] || {};
  const cv = prof.cv_text || '';
  const d = await groq(key, PROMPT(cv, JSON.stringify(prof.answers || {}), page));
  if (!d) return res.status(503).json({ error: 'busy' });
  if (d.is_job === false) return res.status(200).json({ not_job: true });

  const title = String(d.title || page.title || '').slice(0, 140), co = String(d.company || page.company || '').slice(0, 80);
  if (!title || !co) return res.status(200).json({ need_text: true });
  const ad = page.text;
  const card = {
    id: 'j-' + crypto.createHash('sha1').update(`${norm(co)}|${norm(title)}`).digest('hex').slice(0, 10),
    co, title, loc: String(d.location || page.location || '').slice(0, 80),
    fit: Math.round(Math.max(1, Math.min(5, Number(d.fit) || 3)) * 10) / 10,
    reasons: (d.reasons || []).filter(r => grounded(r, cv)).slice(0, 3).map(String),
    gaps: (d.gaps || []).filter(g => grounded(g, ad)).slice(0, 2).map(String),
    partial: false, tags: [], src: page.src || 'הוספת בעצמך', posted_days: 0,
    salary: d.salary && ad.includes(String(d.salary).replace(/[^\d]/g, '').slice(0, 3)) ? String(d.salary).slice(0, 40) : '',
    desc: ad.slice(0, 600), ad: ad.slice(0, 4000), url: page.url || url, added: true, seniority_ok: d.seniority_ok !== false,
  };
  const ins = await sb('/rest/v1/jobs', token, { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates' },
    body: JSON.stringify([{ user_id: uid, id: card.id, card, fit: card.fit, decision: 'save' }]) });
  if (!ins.ok) return res.status(500).json({ error: 'save' });
  return res.status(200).json({ card });
};
