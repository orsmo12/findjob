// findjob — צ׳אט עם שי. פונקציית שרת ב-Vercel.
// בודקת שהמשתמש מחובר (טוקן של Supabase), קוראת רק את הנתונים שלו (RLS), ושולחת ל-Groq.
// השיחה לא נשמרת בשרת. שי לא מבצע פעולות בשום חשבון — רק עונה.
const SB = 'https://cavfthbkwosnwqdqkmap.supabase.co';
const PK = 'sb_publishable_kTXa--U7akPkHozrbkw0Xg_w4_u5iOH';   // מפתח ציבורי, מוגן ב-RLS
const MODELS = ['openai/gpt-oss-120b', 'qwen/qwen3.8-27b', 'openai/gpt-oss-20b', 'llama-3.1-8b-instant'];

const clean = v => String(v || '').trim().replace(/^GROQ_API_KEY=/, '').replace(/^["']|["']$/g, '').trim();

async function sb(path, token) {
  const r = await fetch(SB + path, { headers: { apikey: PK, Authorization: 'Bearer ' + token } });
  return r.ok ? r.json() : null;
}

function context(p, jobs) {
  const a = (p && p.answers) || {}, st = (p && p.state) || {};
  const apps = (st.apps || []).map(x => {
    const j = jobs.find(r => r.card.id === x.jobId);
    return j ? `- ${j.card.title} @ ${j.card.co}: ${x.status}` : null;
  }).filter(Boolean);
  const fresh = jobs.filter(r => !r.decision).slice(0, 8).map(r => `- ${r.card.title} @ ${r.card.co} (${r.card.loc}) התאמה ${r.card.fit}: ${(r.card.reasons || []).join('; ')}`);
  return `שם: ${(p && p.first) || ''}
תשובות השאלון: ${JSON.stringify(a)}
קורות חיים:
${((p && p.cv_text) || '').slice(0, 3500)}

משרות חדשות שעוד לא החליט עליהן:
${fresh.join('\n') || '(אין)'}

ההגשות שלו:
${apps.join('\n') || '(אין עדיין)'}`;
}

const SYSTEM = `אתה שי, העוזר האישי באפליקציית findjob, שעוזרת לסטודנטים וג׳וניורים בישראל למצוא עבודה.
עונים בעברית, קצר וענייני (עד 6 שורות אלא אם ביקשו יותר). שמות טכנולוגיות באנגלית.
משתמשים רק בנתונים שלמטה ובידע כללי על חיפוש עבודה. אסור להמציא ניסיון, מספרים או פרטים על חברות.
אם אין לך מידע, אומרים את זה. אתה לא שולח, לא מגיש ולא פועל בשום חשבון: אתה מציע, והמשתמש עושה.
כשמתרגלים ראיון: שואלים שאלה אחת בכל פעם, ונותנים משוב קצר וכן על התשובה.`;

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  const { messages = [], token = '' } = req.body || {};
  const key = clean(process.env.GROQ_API_KEY);
  if (!key) return res.status(500).json({ error: 'no_key' });
  const user = await sb('/auth/v1/user', token);
  if (!user || !user.id) return res.status(401).json({ error: 'auth' });
  const [prof] = (await sb(`/rest/v1/profiles?select=first,cv_text,answers,state&user_id=eq.${user.id}`, token)) || [];
  const jobs = (await sb(`/rest/v1/jobs?select=card,decision&user_id=eq.${user.id}&order=created_at.desc&limit=60`, token)) || [];
  const msgs = [{ role: 'system', content: SYSTEM + '\n\nהנתונים של המשתמש:\n' + context(prof, jobs) },
    ...messages.slice(-12).map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: String(m.content || '').slice(0, 2000) }))];
  for (const model of MODELS) {
    try {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST', headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, messages: msgs, temperature: 0.4, max_tokens: 700 }) });
      if (!r.ok) continue;
      const d = await r.json();
      let t = (d.choices && d.choices[0] && d.choices[0].message.content) || '';
      if (t.includes('</think>')) t = t.split('</think>').pop();
      if (t.trim()) return res.status(200).json({ reply: t.trim() });
    } catch (e) { /* מנסים את המודל הבא */ }
  }
  return res.status(503).json({ error: 'busy' });
};
