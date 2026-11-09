// findjob — צ׳אט עם שי. פונקציית שרת ב-Vercel.
// בודקת שהמשתמש מחובר, קוראת רק את הנתונים שלו (RLS), ושולחת ל-Groq עם כל ההקשר הרלוונטי.
// שי יכול להציע פעולה אחת באפליקציה (עדכון סטטוס, הערה, מכתב, הוספת משרה…) — היא מתבצעת רק אחרי שהמשתמש מאשר.
// שי לא פועל בשום חשבון חיצוני ולא שולח שום דבר בשם המשתמש.
const SB = 'https://cavfthbkwosnwqdqkmap.supabase.co';
const PK = 'sb_publishable_kTXa--U7akPkHozrbkw0Xg_w4_u5iOH';
const MODELS = ['openai/gpt-oss-120b', 'qwen/qwen3.8-27b', 'openai/gpt-oss-20b', 'llama-3.1-8b-instant'];
const STATUS = { saved: 'שמור', applied: 'הוגש', screening: 'סינון', interview: 'ראיון', offer: 'הצעה', rejected: 'נדחה', ghosted: 'אין מענה', withdrew: 'ויתרתי' };
const PRIO = { interview: 0, screening: 1, offer: 2, saved: 3, applied: 4 };

const SHARED_DAILY = 40;   // הודעות צ׳אט ביום לכל משתמש על המפתח המשותף, כדי שמשתמש אחד לא יגמור אותו לכולם. מפתח אישי: בלי הגבלה

const clean = v => String(v || '').trim().replace(/^GROQ_API_KEY=/, '').replace(/^["']|["']$/g, '').trim();
const cut = (s, n) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n) + '…' : s; };

async function sb(path, token) {
  const r = await fetch(SB + path, { headers: { apikey: PK, Authorization: 'Bearer ' + token } });
  return r.ok ? r.json() : null;
}

function detail(j, a) {
  const c = j.card, out = [`### ${c.title} @ ${c.co} [job_id: ${c.id}]`,
    `מיקום: ${c.loc || '-'} · התאמה ${c.fit}/5 · מקור: ${c.src || '-'}${c.salary ? ' · שכר: ' + c.salary : ''}${c.closed_at ? ' · המשרה נסגרה למועמדים' : ''}`];
  if (a) out.push(`סטטוס: ${STATUS[a.status] || a.status}${a.iv ? ' · מועד: ' + a.iv : ''}${a.note ? ' · הערות שלו: ' + cut(a.note, 300) : ''}`);
  if ((c.reasons || []).length) out.push('למה מתאים: ' + c.reasons.join('; '));
  if ((c.gaps || []).length) out.push('מה חסר: ' + c.gaps.join('; '));
  out.push('המודעה: ' + cut(c.ad || c.desc, 1400));
  if (j.letter && j.letter.text) out.push('מכתב הפנייה שהוכן: ' + cut((a && a.letter) || j.letter.text, 900));
  if (j.brief && j.brief.found) out.push('על החברה (ממקורות): ' + cut([j.brief.what, ...(j.brief.facts || []).map(f => f.text)].join(' · '), 500));
  if (j.prep && (j.prep.questions || []).length) out.push('שאלות הכנה של מאיה: ' + j.prep.questions.map(q => q.q).join(' | '));
  if (j.prep && (j.prep.tasks || []).length) out.push('מטלות בית לדוגמה: ' + j.prep.tasks.slice(0, 4).map(t => t.title).join(' | '));
  return out.join('\n');
}

function context(p, jobs, lastUser, focus) {
  const st = (p && p.state) || {}, apps = st.apps || [], byId = Object.fromEntries(jobs.map(j => [j.card.id, j]));
  const text = String(lastUser || '').toLowerCase();
  const mentioned = jobs.filter(j => text.includes(String(j.card.co).toLowerCase().split(' ')[0]) || text.includes(String(j.card.title).toLowerCase().slice(0, 18)));
  const focusIds = [focus, ...mentioned.map(j => j.card.id)].filter(Boolean);
  const ranked = apps.filter(a => byId[a.jobId]).sort((x, y) => (PRIO[x.status] ?? 9) - (PRIO[y.status] ?? 9)).map(a => a.jobId);
  const deep = [...new Set([...focusIds, ...ranked])].slice(0, focusIds.length ? 2 : 2);
  const fresh = jobs.filter(j => !j.decision).slice(0, 8);
  const li = (p && p.li) || {}, fixes = ((p && p.li_fixes) || {}).fixes || [];
  return `## המשתמש
שם: ${(p && p.first) || ''}
תשובות לשאלון: ${JSON.stringify(Object.fromEntries(Object.entries((p && p.answers) || {}).filter(([k]) => k !== 'kit')))}
פרטים לטפסים: ${(() => { const k = ((p && p.answers) || {}).kit || {}; return [k.city && 'עיר: ' + k.city, k.edu && 'השכלה: ' + k.edu, k.auth && 'אישור עבודה: ' + k.auth].filter(Boolean).join(' · ') || '(לא מולאו)'; })()}
קורות חיים:
${cut(p && p.cv_text, 2800)}

## משרות בפירוט
${deep.map(id => detail(byId[id], apps.find(a => a.jobId === id))).join('\n\n') || '(אין)'}

## כל ההגשות (${apps.length})
${apps.map(a => byId[a.jobId] ? `- ${byId[a.jobId].card.title} @ ${byId[a.jobId].card.co} [job_id: ${a.jobId}] · ${STATUS[a.status] || a.status}${a.iv ? ' · ' + a.iv : ''}` : null).filter(Boolean).join('\n') || '(אין)'}

## משרות חדשות שעוד לא החליט עליהן (${fresh.length})
${fresh.map(j => `- ${j.card.title} @ ${j.card.co} [job_id: ${j.card.id}] · התאמה ${j.card.fit} · ${(j.card.reasons || [])[0] || ''}`).join('\n') || '(אין)'}

## היסטוריה
${(st.history || []).slice(0, 8).map(h => `- ${h.title} @ ${h.co}: ${h.reason === 'closed' ? 'נסגרה' : 'הוסרה'}`).join('\n') || '(אין)'}

## LinkedIn
${(li.posts || []).length} פוסטים שהוכנו להם תגובות · ${fixes.length} שיפורי פרופיל: ${fixes.map(f => f.t).join('; ') || '-'}
משימות שלו: ${(st.todos || []).filter(t => !t.done).map(t => t.text).join('; ') || '-'}
סיפורי STAR: ${(st.stories || []).map(s => s.t).join('; ') || '-'}`;
}

const SYSTEM = `אתה שי, העוזר האישי באפליקציית findjob, שעוזרת לסטודנטים וג׳וניורים בישראל למצוא עבודה.
עונים בעברית, ענייני וחם, קצר כברירת מחדל (עד 8 שורות), ויותר כשמבקשים (למשל מכתב או תרגול). שמות טכנולוגיות באנגלית.
אפשר להשתמש ב-**הדגשה** וברשימות עם "- ".
משתמשים רק בנתונים שלמטה ובידע כללי על חיפוש עבודה. אסור להמציא ניסיון, מספרים, אנשים או פרטים על חברות.
כשכותבים מכתב או הודעה בשמו — רק עובדות מקורות החיים שלו.
אתה לא שולח, לא מגיש ולא פועל בשום חשבון חיצוני. אתה מציע, והוא עושה.
כשמתרגלים ראיון: שאלה אחת בכל פעם, ואחרי התשובה שלו משוב קצר וכן ואז השאלה הבאה.

## פעולות באפליקציה
אם המשתמש מבקש במפורש לשנות משהו באפליקציה, הצע פעולה אחת בסוף התשובה, בשורה נפרדת בדיוק בפורמט:
<<ACTION {"type": "...", ...}>>
הפעולה מתבצעת רק אחרי שהוא מאשר, אז בטקסט תגיד מה תעשה ("אעדכן…, אשר למטה"). סוגים:
- {"type":"set_status","job_id":"...","status":"saved|applied|screening|interview|offer|rejected|ghosted|withdrew","iv":"מועד אם נמסר"}
- {"type":"add_note","job_id":"...","text":"..."}
- {"type":"set_letter","job_id":"...","text":"המכתב המלא החדש"}
- {"type":"add_job","url":"https://..."}
- {"type":"save_job","job_id":"..."}   (משרה חדשה → להגשות)
- {"type":"skip_job","job_id":"..."}
- {"type":"remove_app","job_id":"..."}
- {"type":"add_todo","text":"..."}
- {"type":"add_story","title":"...","body":"מצב: ...\\nמשימה: ...\\nפעולה: ...\\nתוצאה: ..."}
- {"type":"feedback","text":"..."}   (בקשה לשינוי במערכת עצמה, נשלחת למפתח)
השתמש רק ב-job_id שמופיע בנתונים. בלי בקשה מפורשת — בלי פעולה.

## עזרה בטופס הגשה
כשהמשתמש ממלא טופס ושואל על שאלה בו (שכר, אישור עבודה, עבודה מהמשרד, זמינות, "למה אנחנו", "ספר על עצמך", הפניה, שאלות כן/לא):
- נותנים תשובה מוכנה להעתקה, קצרה, בשפת הטופס (אנגלית אם הטופס באנגלית), מבוססת רק על קורות החיים, התשובות לשאלון והמודעה.
- שכר: משתמשים בציפיות שהמשתמש כתב בשאלון, או בשכר שפורסם במודעה. **אסור להמציא מספרי שוק או "טבלאות שכר".** אם אין נתון, מציעים לתת טווח לפי הציפיות שלו ולהוסיף "גמיש, בהתאם לחבילה".
- אישור עבודה וזמינות: רק לפי "פרטים לטפסים" והשאלון. אם חסר, אומרים שאפשר להשלים בפרופיל › פרטים לטפסי הגשה.
- "למה אנחנו": משפט על החברה רק ממה שכתוב בסקירה או במודעה, ומשפט שמחבר לפרויקט אמיתי מקורות החיים.
- לא ממלאים את הטופס ולא שולחים אותו. המשתמש מעתיק ושולח בעצמו.

## מה אתה לא יכול לעשות
אתה לא משנה את המערכת, את הקוד או את דרך החיפוש של הסוכנים, ואין לך פעולה כזו. אל תגיד "הוספתי בקשה" או "עדכנתי את המערכת".
כשמבקשים יכולת חדשה (למשל לחפש בקבוצות טלגרם או באתר מסוים), תגיד בכנות שזה עוד לא קיים, ותציע להעביר את הבקשה למפתח עם פעולת feedback.
אל תשתמש ב-add_note כדי לרשום בקשה לשינוי במערכת.`;

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method' });
  const { messages = [], token = '', focus = '' } = req.body || {};
  let key = clean(process.env.GROQ_API_KEY);
  const user = await sb('/auth/v1/user', token);
  if (!user || !user.id) return res.status(401).json({ error: 'auth' });
  const [prof] = (await sb(`/rest/v1/profiles?select=first,cv_text,answers,state,li,li_fixes&user_id=eq.${user.id}`, token)) || [];
  const own = String(((prof && prof.state) || {}).ai_key || '').trim();
  const shared = !/^gsk_\w{20,}/.test(own);
  if (!shared) key = own;   // מפתח אישי של המשתמש, אם הכניס
  const today = new Date().toISOString().slice(0, 10);
  let used = null;   // null = אין עמודת chat_use (לא הורץ ה-SQL), ואז לא מגבילים
  if (shared) {
    const [u] = (await sb(`/rest/v1/profiles?select=chat_use&user_id=eq.${user.id}`, token)) || [];
    if (u) used = (u.chat_use && u.chat_use.day === today) ? (u.chat_use.n || 0) : 0;
    if (used !== null && used >= SHARED_DAILY) return res.status(429).json({ error: 'limit', limit: SHARED_DAILY });
  }
  if (!key) return res.status(500).json({ error: 'no_key' });
  const jobs = (await sb(`/rest/v1/jobs?select=card,decision,letter,brief,prep&user_id=eq.${user.id}&order=created_at.desc&limit=80`, token)) || [];
  const lastUser = [...messages].reverse().find(m => m.role === 'user');
  const msgs = [{ role: 'system', content: SYSTEM + '\n\n# הנתונים של המשתמש\n' + context(prof, jobs, lastUser && lastUser.content, focus) },
    ...messages.slice(-14).map(m => ({ role: m.role === 'user' ? 'user' : 'assistant', content: String(m.content || '').slice(0, 2500) }))];
  for (const model of MODELS) {
    try {
      const body = { model, messages: msgs, temperature: 0.4, max_tokens: 1400 };
      if (model.includes('gpt-oss')) body.reasoning_effort = 'low';
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST', headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      if (!r.ok) continue;
      const d = await r.json();
      let t = ((d.choices && d.choices[0] && d.choices[0].message.content) || '').split('</think>').pop().trim();
      if (!t) continue;
      let action = null;
      const m = t.match(/<<ACTION\s*(\{[\s\S]*?\})\s*>>/);
      if (m) {
        t = t.replace(m[0], '').trim();
        try {
          action = JSON.parse(m[1]);
          const ids = new Set(jobs.map(j => j.card.id));
          if (action.job_id && !ids.has(action.job_id)) action = null;   // רק משרות שקיימות אצלו
        } catch (e) { action = null; }
      }
      if (used !== null) {   // סופרים רק תשובה שהצליחה
        await fetch(SB + `/rest/v1/profiles?user_id=eq.${user.id}`, { method: 'PATCH',
          headers: { apikey: PK, Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
          body: JSON.stringify({ chat_use: { day: today, n: used + 1 } }) }).catch(() => {});
      }
      return res.status(200).json({ reply: t, action, left: used !== null ? SHARED_DAILY - used - 1 : null });
    } catch (e) { /* המודל הבא */ }
  }
  return res.status(503).json({ error: 'busy' });
};
