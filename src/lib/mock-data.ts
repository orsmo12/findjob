import type { BoardItem, MemoryEvent, BoardStats, DomainPriority, LifeGoal } from '@/types'
import type { Lang } from './i18n'
import { DOMAIN_REGISTRY } from './domains'

// Starter-active domains for the demo/mock account — narrowed to the focused
// MVP audience (students, junior/professional developers, AI builders, and
// people working on career growth or project ideas). All 5 domains here map
// to one of the 4 real MVP agents (see domains.ts `mvpAgent`), so a brand-new
// account immediately gets real, source-driven cards from every active agent
// instead of a scattershot mix of unrelated life domains. Every other domain
// in the registry is still fully present and selectable (sidebar/board/
// onboarding show all of them) — they just start inactive at their
// registry-defined default priority until the user turns them on. This is
// what keeps "unlimited future domains" true while the active product stays
// narrow: turning on investing/real_estate/sports/etc. still works today via
// the generic agent path, with no architecture change needed later to deepen
// them into their own real agents.
const STARTER_ACTIVE: Record<string, number> = {
  career: 9, ai_tech: 9, programming: 8, startups: 7, open_source: 6,
}

export const MOCK_PRIORITIES: DomainPriority[] = DOMAIN_REGISTRY.map((d, i) => ({
  id: String(i + 1),
  user_id: 'mock',
  domain: d.id,
  score: STARTER_ACTIVE[d.id] ?? d.defaultPriority,
  active: d.id in STARTER_ACTIVE,
}))

// ─── Life Goals (EN / HE) ──────────────────────────────────────────────────

export const MOCK_GOALS_EN: LifeGoal[] = [
  { id: '1', user_id: 'mock', text: 'Find a senior engineering role (Python / AI)', domain: 'career', active: true, created_at: '' },
  { id: '2', user_id: 'mock', text: 'Learn AI/ML product development', domain: 'ai_tech', active: true, created_at: '' },
  { id: '3', user_id: 'mock', text: 'Buy an apartment in Tel Aviv in the next 18 months', domain: 'real_estate', active: true, created_at: '' },
  { id: '4', user_id: 'mock', text: 'Build a B2B SaaS side project', domain: 'startups', active: true, created_at: '' },
]

export const MOCK_GOALS_HE: LifeGoal[] = [
  { id: '1', user_id: 'mock', text: 'למצוא משרת הנדסה בכירה (Python / AI)', domain: 'career', active: true, created_at: '' },
  { id: '2', user_id: 'mock', text: 'ללמוד פיתוח מוצרי AI/ML', domain: 'ai_tech', active: true, created_at: '' },
  { id: '3', user_id: 'mock', text: 'לקנות דירה בתל אביב בתוך 18 החודשים הקרובים', domain: 'real_estate', active: true, created_at: '' },
  { id: '4', user_id: 'mock', text: 'לבנות פרויקט SaaS צדי לעסקים', domain: 'startups', active: true, created_at: '' },
]

export function getMockGoals(lang: Lang): LifeGoal[] {
  return lang === 'he' ? MOCK_GOALS_HE : MOCK_GOALS_EN
}

// ─── Board items (EN / HE) ──────────────────────────────────────────────────

export const MOCK_ITEMS_EN: BoardItem[] = [
  {
    id: '1',
    user_id: 'mock',
    agent: 'Career Agent',
    domain: 'career',
    title: 'Senior Python Engineer at Weights & Biases — matches your exact stack',
    why_seeing: 'You\'re actively job hunting for senior Python/AI roles. This was posted 6 hours ago.',
    why_matters: 'W&B is a top MLOps company. The role requires Python and ML experience — an exact match. Early applicants are 3× more likely to get a first interview.',
    action: 'Apply via their careers page · Personalize with your ML and SaaS side project',
    lvs: 94, relevance: 96, impact: 91, urgency: 95, novelty: 68,
    attention_budget: 'high',
    source: 'HN Jobs · LinkedIn',
    source_url: 'https://wandb.ai/careers',
    feedback: null, dismissed: false,
    created_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '2',
    user_id: 'mock',
    agent: 'AI / GitHub Agent',
    domain: 'ai_tech',
    title: 'Claude tool-use API released — the architecture your SaaS needs',
    why_seeing: 'You\'re building a B2B SaaS and AI development is your second-highest priority.',
    why_matters: 'Tool-use lets Claude take real actions, not just answer. This is the primitive that makes AI agents genuinely useful in products. Your side project needs this as its core.',
    action: 'Read the API docs · Prototype a tool-use workflow this week',
    lvs: 89, relevance: 92, impact: 88, urgency: 61, novelty: 95,
    attention_budget: 'high',
    source: 'Hacker News #1 · 847 points',
    source_url: 'https://news.ycombinator.com',
    feedback: null, dismissed: false,
    created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '3',
    user_id: 'mock',
    agent: 'Real Estate Agent',
    domain: 'real_estate',
    title: 'Tel Aviv apartment prices dropped 4.2% in Q2 — largest fall in 3 years',
    why_seeing: 'You\'re saving to buy an apartment in Tel Aviv in the next 18 months.',
    why_matters: 'If this trend continues another two quarters, waiting 6 months could save you ₪40–80K. The right time to talk to a mortgage advisor is before prices recover, not after.',
    action: 'Schedule a mortgage advisor meeting · Re-run your savings timeline',
    lvs: 87, relevance: 90, impact: 88, urgency: 70, novelty: 84,
    attention_budget: 'medium',
    source: 'Bank of Israel · Globes Real Estate Index',
    source_url: 'https://www.boi.org.il',
    feedback: null, dismissed: false,
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '4',
    user_id: 'mock',
    agent: 'AI / GitHub Agent',
    domain: 'ai_tech',
    title: '"llm-agents-from-scratch" — 2.8K stars in 48h, zero framework dependency',
    why_seeing: 'You\'re learning AI product development. This repo is #1 trending on GitHub Python.',
    why_matters: 'Implements ReAct, function calling, and memory from scratch. Understanding these without framework abstraction is a significant edge when building AI products.',
    action: 'Clone it · Spend 2 hours on the ReAct implementation this weekend',
    lvs: 82, relevance: 88, impact: 74, urgency: 42, novelty: 92,
    attention_budget: 'medium',
    source: 'GitHub Trending · Python #1',
    source_url: 'https://github.com/trending/python',
    feedback: null, dismissed: false,
    created_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '5',
    user_id: 'mock',
    agent: 'Career Agent',
    domain: 'career',
    title: 'Vercel is hiring a Developer Advocate — fully remote, Python community focus',
    why_seeing: 'You\'re job hunting and your profile includes technical writing and community involvement.',
    why_matters: 'A DevRel role at Vercel (200K+ developer ecosystem) builds audience, code, and brand simultaneously — unusual leverage for someone building a SaaS side project.',
    action: 'Read the JD · Decide within 72 hours whether to apply',
    lvs: 76, relevance: 80, impact: 78, urgency: 66, novelty: 60,
    attention_budget: 'medium',
    source: 'Vercel Careers · Remote OK',
    source_url: 'https://vercel.com/careers',
    feedback: null, dismissed: false,
    created_at: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '6',
    user_id: 'mock',
    agent: 'Investment Agent',
    domain: 'investing',
    title: 'NVIDIA beat Q2 estimates by 18% — AI infrastructure demand cycle confirmed',
    why_seeing: 'You track investing and have interest in AI sector exposure.',
    why_matters: 'This signals sustained enterprise AI spend, not a blip. Infrastructure plays (NVDA, TSMC, ASML) historically front-run application plays by 12–18 months. Worth reviewing your allocation.',
    action: 'Review portfolio AI infrastructure exposure · Not financial advice',
    lvs: 71, relevance: 80, impact: 72, urgency: 44, novelty: 62,
    attention_budget: 'low',
    source: 'Bloomberg · CNBC Earnings',
    source_url: 'https://www.cnbc.com',
    feedback: null, dismissed: false,
    created_at: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '7',
    user_id: 'mock',
    agent: 'Sports Agent',
    domain: 'sports',
    title: 'Because Arsenal lost, Maccabi Tel Aviv\'s Europa path opens significantly',
    why_seeing: 'You follow Maccabi Tel Aviv and Israeli football.',
    why_matters: 'Arsenal\'s group-stage exit creates a clearer Europa Conference League qualification route for MTA. The draw is Thursday.',
    action: 'Watch the draw Thursday 12:00 CET',
    lvs: 41, relevance: 55, impact: 35, urgency: 50, novelty: 70,
    attention_budget: 'low',
    source: 'UEFA · ESPN',
    source_url: 'https://www.uefa.com',
    feedback: null, dismissed: false,
    created_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
  },
]

export const MOCK_ITEMS_HE: BoardItem[] = [
  {
    id: '1',
    user_id: 'mock',
    agent: 'Career Agent',
    domain: 'career',
    title: 'מהנדס/ת Python בכיר/ה ב-Weights & Biases — התאמה מדויקת למחסנית הטכנולוגית שלך',
    why_seeing: 'אתה מחפש באופן פעיל משרות Python/AI בכירות. המשרה פורסמה לפני 6 שעות.',
    why_matters: 'Weights & Biases היא מהחברות המובילות בתחום ה-MLOps. המשרה דורשת ניסיון ב-Python וב-ML — התאמה מדויקת. למגישי מועמדות מוקדמים סיכוי גבוה פי 3 לקבל ריאיון ראשון.',
    action: 'הגש מועמדות בעמוד הקריירה שלהם · התאם את הקורות חיים לפרויקט ה-ML וה-SaaS הצדי שלך',
    lvs: 94, relevance: 96, impact: 91, urgency: 95, novelty: 68,
    attention_budget: 'high',
    source: 'HN Jobs · לינקדאין',
    source_url: 'https://wandb.ai/careers',
    feedback: null, dismissed: false,
    created_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '2',
    user_id: 'mock',
    agent: 'AI / GitHub Agent',
    domain: 'ai_tech',
    title: 'ה-API של Claude לשימוש בכלים פורסם — האדריכלות שה-SaaS שלך צריך',
    why_seeing: 'אתה בונה SaaS לעסקים (B2B) ופיתוח AI הוא העדיפות השנייה בחשיבותה שלך.',
    why_matters: 'שימוש בכלים מאפשר ל-Claude לבצע פעולות אמיתיות, לא רק לענות. זהו הבסיס שהופך סוכני AI לשימושיים באמת במוצרים. הפרויקט הצדי שלך צריך את זה בליבה שלו.',
    action: 'קרא את תיעוד ה-API · בנה אבטיפוס לתהליך עבודה עם כלים השבוע',
    lvs: 89, relevance: 92, impact: 88, urgency: 61, novelty: 95,
    attention_budget: 'high',
    source: 'Hacker News #1 · 847 נקודות',
    source_url: 'https://news.ycombinator.com',
    feedback: null, dismissed: false,
    created_at: new Date(Date.now() - 3 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '3',
    user_id: 'mock',
    agent: 'Real Estate Agent',
    domain: 'real_estate',
    title: 'מחירי דירות בתל אביב צנחו ב-4.2% ברבעון השני — הירידה הגדולה ביותר ב-3 שנים',
    why_seeing: 'אתה חוסך לקניית דירה בתל אביב בתוך 18 החודשים הקרובים.',
    why_matters: 'אם המגמה תימשך עוד שני רבעונים, המתנה של 6 חודשים יכולה לחסוך לך 40–80 אלף ש״ח. הזמן הנכון לפנות ליועץ משכנתאות הוא לפני שהמחירים מתאוששים, לא אחרי.',
    action: 'קבע פגישה עם יועץ משכנתאות · עדכן את לוח הזמנים לחיסכון שלך',
    lvs: 87, relevance: 90, impact: 88, urgency: 70, novelty: 84,
    attention_budget: 'medium',
    source: 'בנק ישראל · מדד הנדל״ן של גלובס',
    source_url: 'https://www.boi.org.il',
    feedback: null, dismissed: false,
    created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '4',
    user_id: 'mock',
    agent: 'AI / GitHub Agent',
    domain: 'ai_tech',
    title: '"llm-agents-from-scratch" — 2.8K כוכבים ב-48 שעות, בלי תלות בפריימוורקים',
    why_seeing: 'אתה לומד פיתוח מוצרי AI. הריפו הזה במקום הראשון בטרנדים של GitHub בקטגוריית Python.',
    why_matters: 'מימוש של ReAct, function calling וזיכרון מהבסיס. הבנה של אלה בלי הפשטה של פריימוורק נותנת יתרון משמעותי בבנייה של מוצרי AI.',
    action: 'עשה clone לריפו · הקדש שעתיים למימוש ה-ReAct בסוף השבוע',
    lvs: 82, relevance: 88, impact: 74, urgency: 42, novelty: 92,
    attention_budget: 'medium',
    source: 'GitHub Trending · Python #1',
    source_url: 'https://github.com/trending/python',
    feedback: null, dismissed: false,
    created_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '5',
    user_id: 'mock',
    agent: 'Career Agent',
    domain: 'career',
    title: 'Vercel מחפשת Developer Advocate — עבודה מרחוק מלאה, פוקוס על קהילת Python',
    why_seeing: 'אתה מחפש עבודה והפרופיל שלך כולל כתיבה טכנית ומעורבות בקהילה.',
    why_matters: 'תפקיד DevRel ב-Vercel (אקוסיסטם של למעלה מ-200,000 מפתחים) בונה במקביל קהל, קוד ומותג אישי — מנוף יוצא דופן למי שבונה פרויקט SaaS צדי.',
    action: 'קרא את תיאור המשרה · החלט בתוך 72 שעות אם להגיש מועמדות',
    lvs: 76, relevance: 80, impact: 78, urgency: 66, novelty: 60,
    attention_budget: 'medium',
    source: 'Vercel Careers · Remote OK',
    source_url: 'https://vercel.com/careers',
    feedback: null, dismissed: false,
    created_at: new Date(Date.now() - 8 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '6',
    user_id: 'mock',
    agent: 'Investment Agent',
    domain: 'investing',
    title: 'NVIDIA עקפה את תחזיות הרבעון השני ב-18% — מחזור הביקוש לתשתיות AI מתאשר',
    why_seeing: 'אתה עוקב אחרי השקעות ומעוניין בחשיפה למגזר ה-AI.',
    why_matters: 'זה מסמן הוצאה עסקית מתמשכת על AI, לא תנודה חד-פעמית. חברות תשתית (NVDA, TSMC, ASML) נוהגות היסטורית להקדים חברות אפליקציה ב-12–18 חודשים. שווה לבדוק מחדש את הקצאת התיק שלך.',
    action: 'בדוק את החשיפה לתשתיות AI בתיק שלך · אין בכך ייעוץ פיננסי',
    lvs: 71, relevance: 80, impact: 72, urgency: 44, novelty: 62,
    attention_budget: 'low',
    source: 'Bloomberg · CNBC Earnings',
    source_url: 'https://www.cnbc.com',
    feedback: null, dismissed: false,
    created_at: new Date(Date.now() - 10 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '7',
    user_id: 'mock',
    agent: 'Sports Agent',
    domain: 'sports',
    title: 'בעקבות ההפסד של ארסנל, הדרך של מכבי תל אביב באירופה נפתחת משמעותית',
    why_seeing: 'אתה עוקב אחרי מכבי תל אביב והכדורגל הישראלי.',
    why_matters: 'ההדחה של ארסנל משלב הבתים פותחת מסלול הסמכה ברור יותר למכבי ת״א לליגת הקונפרנס האירופית. ההגרלה ביום חמישי.',
    action: 'עקוב אחרי ההגרלה ביום חמישי בשעה 12:00 לפי שעון מרכז אירופה',
    lvs: 41, relevance: 55, impact: 35, urgency: 50, novelty: 70,
    attention_budget: 'low',
    source: 'UEFA · ESPN',
    source_url: 'https://www.uefa.com',
    feedback: null, dismissed: false,
    created_at: new Date(Date.now() - 1 * 60 * 60 * 1000).toISOString(),
  },
]

export function getMockItems(lang: Lang): BoardItem[] {
  return lang === 'he' ? MOCK_ITEMS_HE : MOCK_ITEMS_EN
}

// Default export (English) — kept so any code that hasn't been
// migrated to getMockItems(lang) yet still works.
export const MOCK_ITEMS: BoardItem[] = MOCK_ITEMS_EN

// ─── Memory events (EN / HE) ────────────────────────────────────────────────

export const MOCK_MEMORY_EN: MemoryEvent[] = [
  {
    id: '1', user_id: 'mock', type: 'acted_on', domain: 'career', item_id: '1',
    description: 'You clicked "Apply" on the Vercel engineering role. Career agent reinforced.',
    meta: {}, created_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '2', user_id: 'mock', type: 'priority_adjusted', domain: 'ai_tech',
    description: 'You expanded 4 of 5 AI-related cards this week. AI & Tech priority raised 8 → 9.',
    meta: { from: 8, to: 9 }, created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '3', user_id: 'mock', type: 'not_helpful', domain: 'sports',
    description: 'Sports items ignored for 3 weeks. Priority reduced 5 → 2.',
    meta: { from: 5, to: 2 }, created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '4', user_id: 'mock', type: 'pattern_learned',
    description: 'Cards with a clear next action get 2.4× more engagement. Judgment Engine weighted actionability higher.',
    meta: {}, created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '5', user_id: 'mock', type: 'helpful', domain: 'investing',
    description: 'Investment item about TSMC was marked helpful. Investment agent trust score improved.',
    meta: {}, created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
]

export const MOCK_MEMORY_HE: MemoryEvent[] = [
  {
    id: '1', user_id: 'mock', type: 'acted_on', domain: 'career', item_id: '1',
    description: 'לחצת על "הגש מועמדות" במשרת ההנדסה של Vercel. סוכן הקריירה התחזק.',
    meta: {}, created_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '2', user_id: 'mock', type: 'priority_adjusted', domain: 'ai_tech',
    description: 'פתחת 4 מתוך 5 כרטיסים הקשורים ל-AI השבוע. עדיפות ה-AI והטכנולוגיה עלתה מ-8 ל-9.',
    meta: { from: 8, to: 9 }, created_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '3', user_id: 'mock', type: 'not_helpful', domain: 'sports',
    description: 'פריטי ספורט לא נפתחו במשך 3 שבועות. העדיפות הופחתה מ-5 ל-2.',
    meta: { from: 5, to: 2 }, created_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '4', user_id: 'mock', type: 'pattern_learned',
    description: 'כרטיסים עם פעולה הבאה ברורה מקבלים מעורבות גבוהה פי 2.4. מנוע השיפוט נתן משקל גבוה יותר לניתנות-לפעולה.',
    meta: {}, created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
  },
  {
    id: '5', user_id: 'mock', type: 'helpful', domain: 'investing',
    description: 'פריט השקעה על TSMC סומן כמועיל. מדד האמון של סוכן ההשקעות השתפר.',
    meta: {}, created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
  },
]

export function getMockMemory(lang: Lang): MemoryEvent[] {
  return lang === 'he' ? MOCK_MEMORY_HE : MOCK_MEMORY_EN
}

// ─── Stats (language-independent numbers) ───────────────────────────────────

export const MOCK_STATS: BoardStats = {
  items_today: 7,
  filtered_today: 183,
  acted_on_week: 3,
  domains_active: 5,
  trust_score: 94,
  noise_rate: 4,
}
