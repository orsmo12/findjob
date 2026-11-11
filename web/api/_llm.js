// findjob — עזר משותף ל-API: קריאה למודל AI לפי המפתח של המשתמש (Groq, Google Gemini, Claude או OpenAI),
// ונפילה למפתח המשותף של Groq אם המפתח האישי לא עובד. קובץ שמתחיל ב-_ הוא לא נקודת קצה ב-Vercel.
// מראה של agent_core/llm_router.py (PROVIDERS).
const GROQ_MODELS = ['openai/gpt-oss-120b', 'qwen/qwen3.8-27b', 'openai/gpt-oss-20b', 'llama-3.1-8b-instant'];
const P = {
  groq: { base: 'https://api.groq.com/openai/v1', name: 'Groq', temp: true },
  gemini: { base: 'https://generativelanguage.googleapis.com/v1beta/openai', name: 'Google Gemini', temp: true, extra: { reasoning_effort: 'low' },
    pick: [/flash(?!-lite)/, /flash/], fallback: ['gemini-2.5-flash'] },
  anthropic: { base: 'https://api.anthropic.com/v1', name: 'Claude', temp: false, pick: [/sonnet/, /haiku/], fallback: ['claude-sonnet-4-5'] },
  openai: { base: 'https://api.openai.com/v1', name: 'OpenAI', temp: false, extra: { reasoning_effort: 'low' }, maxParam: 'max_completion_tokens',
    pick: [/^gpt-[\d.]+-mini$/, /^gpt-4o$/], fallback: ['gpt-5-mini'] },
};
const NOT_CHAT = /image|tts|audio|live|embed|vision|realtime|search|transcribe|codex|computer|dall|whisper|moderation/;

const clean = v => String(v || '').trim().replace(/^[A-Z_]+=/, '').replace(/^["']|["']$/g, '').trim();
function providerOf(k) {
  k = clean(k);
  if (k.startsWith('gsk_')) return 'groq';
  if (k.startsWith('AIza')) return 'gemini';
  if (k.startsWith('sk-ant-')) return 'anthropic';
  if (k.startsWith('sk-')) return 'openai';
  return '';
}
const validKey = k => (providerOf(k) && clean(k).length > 30 ? clean(k) : '');
const headers = (prov, key) => prov === 'anthropic'
  ? { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'Content-Type': 'application/json' }
  : { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' };

/* בדיקת מפתח: רשימת המודלים של הספק. מחזיר {ok, provider, why} */
async function checkKey(key) {
  const k = clean(key), prov = providerOf(k);
  if (!prov || k.length < 30) return { ok: false, provider: '', why: 'format' };
  const r = await fetch(P[prov].base + '/models', { headers: headers(prov, k) });
  return { ok: r.ok, provider: prov, name: P[prov].name, why: r.ok ? '' : ([400, 401, 403].includes(r.status) ? 'invalid' : prov + '_' + r.status) };   // Google מחזיר 400 למפתח לא תקין
}

async function models(prov, key) {
  if (prov === 'groq') return GROQ_MODELS;
  const c = P[prov];
  try {
    const r = await fetch(c.base + '/models', { headers: headers(prov, key) });
    const d = await r.json();
    const live = (d.data || d.models || []).map(m => String(m.id || m.name || '').replace('models/', '')).filter(m => m && !NOT_CHAT.test(m));
    const ver = m => ((m.match(/\d+/g) || []).map(Number).concat([0, 0, 0])).slice(0, 3);
    const out = [];
    for (const re of c.pick) {
      const hits = live.filter(m => re.test(m) && !out.includes(m))
        .sort((a, b) => (/preview|exp/.test(a) - /preview|exp/.test(b)) || ver(b).reduce((s, v, i) => s || v - ver(a)[i], 0));
      out.push(...hits.slice(0, 2));
    }
    return (out.length ? out : c.fallback).slice(0, 3);
  } catch (e) { return c.fallback; }
}

/* שיחה עם המודל. own = המפתח האישי (אם יש), shared = המפתח המשותף של Groq. מחזיר טקסט או '' */
async function complete(own, shared, messages, { temperature = 0.3, max_tokens = 1400 } = {}) {
  const tries = [];
  const k = validKey(own);
  if (k) tries.push([providerOf(k), k]);
  if (shared && (!k || providerOf(k) !== 'groq' || k !== shared)) tries.push(['groq', shared]);
  for (const [prov, key] of tries) {
    const c = P[prov];
    for (const model of await models(prov, key)) {
      try {
        const body = { model, messages, [c.maxParam || 'max_tokens']: max_tokens, ...(c.extra || {}) };
        if (c.temp) body.temperature = temperature;
        if (prov === 'groq' && model.includes('gpt-oss')) body.reasoning_effort = 'low';
        let r = await fetch(c.base + '/chat/completions', { method: 'POST', headers: headers(prov, key), body: JSON.stringify(body) });
        if (r.status === 400 && c.extra) {   // ספק שלא מכיר reasoning_effort: שוב בלי
          for (const x of Object.keys(c.extra)) delete body[x];
          r = await fetch(c.base + '/chat/completions', { method: 'POST', headers: headers(prov, key), body: JSON.stringify(body) });
        }
        if (!r.ok) { if ([401, 402, 403].includes(r.status)) break; continue; }   // מפתח לא תקין או בלי קרדיט: לספק הבא
        const d = await r.json();
        const t = ((d.choices && d.choices[0] && d.choices[0].message && d.choices[0].message.content) || '').split('</think>').pop().trim();
        if (t) return t;
      } catch (e) { /* המודל הבא */ }
    }
  }
  return '';
}

module.exports = { providerOf, validKey, checkKey, complete, clean, PROVIDERS: P };
