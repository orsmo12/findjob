/**
 * i18n dictionary — Hebrew / English.
 *
 * Flat key → { en, he } strings for all static UI text.
 * Use t('key') from useLanguage() to resolve. Supports {var} interpolation.
 *
 * Domain / agent / attention-budget labels live in their own typed maps
 * below so call sites get autocomplete + type safety against the real
 * Domain / AgentName / AttentionBudget unions.
 */

import type { AttentionBudget } from '@/types'

export type Lang = 'en' | 'he'

type Entry = { en: string; he: string }

export const dict: Record<string, Entry> = {
  // ── Brand / shell ──────────────────────────────────────────────
  'brand.tagline':            { en: 'Personal intelligence board', he: 'לוח מודעות אישי וחכם' },

  // ── Sidebar ────────────────────────────────────────────────────
  'nav.section.board':        { en: 'Board',     he: 'לוח' },
  'nav.myBoard':               { en: 'My Board',  he: 'הלוח שלי' },
  'nav.explore':               { en: 'Explore & Expand', he: 'גלה והרחב' },
  'nav.memory':                { en: 'Memory',    he: 'זיכרון' },
  // Mobile drawer controls (Part 8 — mobile readiness). Not visible text,
  // only aria-labels on the hamburger/close buttons, but still threaded
  // through t() per the Language Consistency standard — an aria-label is
  // app-generated text like any other.
  'nav.openMenu':              { en: 'Open menu',  he: 'פתח תפריט' },
  'nav.closeMenu':             { en: 'Close menu', he: 'סגור תפריט' },
  'sidebar.profession':        { en: 'Software Engineer', he: 'מהנדס תוכנה' },
  'sidebar.userName':          { en: 'Alex Kim', he: 'אלכס קים' },

  // ── Board topbar ───────────────────────────────────────────────
  'board.title':                { en: 'My Board', he: 'הלוח שלי' },
  'board.domainsActive':        { en: '{n} domains active', he: '{n} תחומים פעילים' },
  'board.lastRun':              { en: 'Last run {time}', he: 'הרצה אחרונה {time}' },
  'board.refresh':              { en: '⟳ Refresh', he: '⟳ רענון' },
  'board.running':              { en: '⟳ Running…', he: '⟳ מריץ…' },

  // ── Trust bar ──────────────────────────────────────────────────
  // Jargon tooltips (Product Quality Audit fix #2): a first-time user has
  // no way to know what "Trust Score" or "Noise Rate" actually measure
  // without these — wired as native `title` attributes on the labels below.
  'tooltip.trustScore':          { en: 'Trust Score: the share of items shown this week that you later marked "Helpful" — a rough measure of whether the board is earning its keep.', he: 'מדד אמון: אחוז הפריטים שהוצגו השבוע וסומנו על ידך כ"מועיל" — מדד גס לכך שהלוח באמת מספק ערך.' },
  'tooltip.noiseRate':           { en: 'Noise Rate: the share of items the system found but filtered out before they reached your board, because they failed the relevance/quality bar.', he: 'שיעור רעש: אחוז הפריטים שהמערכת מצאה אך סינתה לפני שהגיעו ללוח שלך, מכיוון שלא עברו את רף הרלוונטיות/האיכות.' },
  'trust.score':                { en: 'Trust Score:', he: 'מדד אמון:' },
  'trust.noise':                 { en: 'Noise Rate:', he: 'שיעור רעש:' },
  'trust.itemsToday':            { en: 'Items today:', he: 'פריטים היום:' },
  'trust.filteredOut':           { en: 'Filtered out:', he: 'סוננו:' },
  'trust.actedOnWeek':           { en: 'Acted on this week:', he: 'טופלו השבוע:' },

  // ── Attention filter ───────────────────────────────────────────
  'filter.all':                  { en: 'All', he: 'הכול' },
  'filter.high':                  { en: 'High', he: 'גבוהה' },
  'filter.medium':                { en: 'Medium', he: 'בינונית' },
  'filter.low':                   { en: 'Low', he: 'נמוכה' },
  'filter.filteredToday':         { en: '{n} items filtered out today', he: '{n} פריטים סוננו היום' },

  // ── Agent status row ───────────────────────────────────────────
  'agentStatus.running':         { en: 'Running', he: 'פעיל' },
  'agentStatus.idle':             { en: 'Idle', he: 'לא פעיל' },
  'agentStatus.itemCount':        { en: '{n} item', he: 'פריט אחד' },
  'agentStatus.itemCountPlural':  { en: '{n} items', he: '{n} פריטים' },

  // ── Research status — compact one-line summary replacing the large
  // per-domain status grid by default (click to expand for detail) ──
  'research.statusLine':          { en: '{sources} sources scanned · {domains} active domains · Weekly brief ready', he: '{sources} מקורות נסקרו · {domains} תחומים פעילים · התקציר השבועי מוכן' },
  'research.statusLineRunning':   { en: '{sources} sources scanned · {domains} active domains · Updating…', he: '{sources} מקורות נסקרו · {domains} תחומים פעילים · מתעדכן…' },
  'research.expand':               { en: 'Show details', he: 'הצג פרטים' },
  'research.collapse':             { en: 'Hide details', he: 'הסתר פרטים' },

  // ── Weekly Brief (primary layer) ────────────────────────────────
  // Life Board's primary layer is framed as a weekly intelligence briefing,
  // not a real-time feed — see src/lib/week.ts for the week-range/generated
  // date strings (built bilingually there, not through this dict).
  'important.title':              { en: 'Weekly Brief', he: 'תקציר שבועי' },
  'important.subtitle':           { en: '{n} items this week · ranked by Life Value Score', he: '{n} פריטים השבוע · מסודרים לפי ניקוד ערך (LVS)' },
  'tooltip.lvs':                   { en: 'Life Value Score (LVS): a 0–100 estimate of how relevant, impactful, urgent, and novel this item is for you — the number this whole board is ranked by.', he: 'ניקוד ערך (LVS): הערכה בין 0 ל-100 של כמה הפריט הזה רלוונטי, משפיע, דחוף וחדש בשבילך — המספר שלפיו כל הלוח מסודר.' },
  'important.empty':              { en: 'No items for this attention level.', he: 'אין פריטים ברמת תשומת הלב הזו.' },
  // Shown only during the very first load on a fresh page open, in place of
  // important.subtitle — see BoardPage.tsx's `initialLoading`. Runtime audit
  // finding: without this, the board briefly rendered static mock items
  // (a deliberately varied demo set) as if they were the real Weekly Brief,
  // then silently swapped them for the real pipeline's output ~2-3s later —
  // reading like the board "changed itself" rather than like a normal load.
  'important.loading':            { en: 'Building your personalized weekly brief…', he: 'בונים את התקציר השבועי האישי שלך…' },
  'important.tagline':            { en: 'The most important things you should know from the last 7 days.', he: 'הדברים החשובים ביותר שכדאי שתדע מ-7 הימים האחרונים.' },
  'card.whyThisWeek':              { en: 'Why this week?', he: 'למה זה רלוונטי השבוע?' },

  // ── Explore & Expand (secondary layer) ──────────────────────────
  'explore.title':                 { en: 'Explore & Expand', he: 'גילוי והרחבה' },
  'explore.pageIntro':             { en: 'Items that didn\'t make this week\'s Weekly Brief but are still worth a look — near misses, goal matches, learning material, and emerging trends, all explained.', he: 'פריטים שלא נכנסו לתקציר השבוע אך עדיין שווה להכיר — כמעט-נכנסו, התאמות למטרות שלך, חומרי למידה ומגמות מתפתחות, הכול עם הסבר.' },
  'explore.subtitleCount':         { en: '{n} more opportunities, adjacent ideas, and near-miss signals', he: '{n} הזדמנויות, רעיונות משלימים ואיתותים שכמעט נכנסו לתקציר' },
  'explore.empty':                 { en: 'Nothing extra to explore right now.', he: 'אין כרגע פריטים נוספים לגילוי.' },
  'explore.loading':               { en: 'Still gathering items to explore…', he: 'עדיין אוספים פריטים לגילוי…' },

  // Explore & Expand shelves — groups secondary items by *why* they're here
  // instead of one flat grid, so "almost made the brief" reads differently
  // from "a trend worth knowing about." See exploreBucket() in route.ts.
  'explore.bucket.near_miss':       { en: 'Near misses', he: 'כמעט נכנסו לתקציר' },
  'explore.bucket.near_miss.sub':   { en: 'Just below this week\'s bar', he: 'ממש מתחת לסף השבועי' },
  'explore.bucket.goal_match':      { en: 'Related to your goals', he: 'קשור למטרות שלך' },
  'explore.bucket.goal_match.sub':  { en: 'Matches a goal you set', he: 'מתאים למטרה שהגדרת' },
  'explore.bucket.learning':        { en: 'Learning opportunities', he: 'הזדמנויות למידה' },
  'explore.bucket.learning.sub':    { en: 'Worth reading, even if not urgent', he: 'שווה קריאה, גם אם לא דחוף' },
  'explore.bucket.trend':           { en: 'Emerging trends', he: 'מגמות מתפתחות' },
  'explore.bucket.trend.sub':       { en: 'Early signals worth watching', he: 'איתותים מוקדמים ששווה לעקוב אחריהם' },
  'explore.bucket.more':            { en: 'More to explore', he: 'עוד לגילוי' },
  'explore.bucket.more.sub':        { en: 'Adjacent ideas outside this week\'s focus', he: 'רעיונות משלימים מעבר למיקוד השבוע' },

  // ── Secondary signals (items that passed the quality bar but ranked
  // outside the strict top-15 main board — kept out of the main feed on
  // purpose so the board stays curated, not crowded) ──────────────
  'secondary.title':                { en: 'More signals', he: 'עוד איתותים' },
  'secondary.subtitle':             { en: '{n} more good items, ranked just below the main board', he: '{n} פריטים טובים נוספים, מתחת לדירוג הלוח הראשי' },
  'secondary.show':                 { en: 'Show {n} more signals', he: 'הצג {n} איתותים נוספים' },
  'secondary.hide':                 { en: 'Hide', he: 'הסתרה' },

  // ── Board card ─────────────────────────────────────────────────
  'card.whyMatters':                { en: 'Why does this matter?', he: 'למה זה חשוב?' },
  'card.subScores':                  { en: 'Sub-scores', he: 'פירוט הניקוד' },
  'card.relevance':                  { en: 'Relevance', he: 'רלוונטיות' },
  'card.impact':                      { en: 'Impact', he: 'השפעה' },
  'card.urgency':                      { en: 'Urgency', he: 'דחיפות' },
  'card.novelty':                      { en: 'Novelty', he: 'חדשנות' },
  'card.recommended':                  { en: 'Recommended', he: 'מומלץ' },
  'card.helpful':                       { en: '👍 Helpful', he: '👍 מועיל' },
  'card.notHelpful':                     { en: '👎 Not helpful', he: '👎 לא מועיל' },
  'card.whyFits':                        { en: 'Why this fits you', he: 'למה זה מתאים לך' },
  'card.sources':                        { en: 'Sources', he: 'מקורות' },
  'card.publishedAgo':                   { en: 'Published {time}', he: 'פורסם {time}' },
  'card.olderItem':                      { en: 'Older item — kept for unusually high relevance', he: 'פריט ישן יותר — נכלל בשל רלוונטיות גבוהה במיוחד' },
  'card.placementReason':                { en: 'Why it is placed here', he: 'למה זה ממוקם כאן' },
  'tooltip.placementReason':              { en: 'Placement Reason: specifically why this item landed in this section and at this position this run — separate from why it was surfaced at all.', he: 'הסבר מיקום: ההסבר הספציפי לכך שהפריט נמצא בקטע הזה ובמיקום הזה בהרצה הנוכחית — בנפרד מהסבר למה הוא נבחר בכלל.' },
  // Collapsed-card badge shown when an item has more than one source link —
  // currently any item with multiple supporting links (most visibly a
  // cross-item synthesized insight once that pipeline stage lands), so the
  // collapsed card itself signals "this is backed by more than one source"
  // without needing a separate "synthesized" field on BoardItem.
  'card.multiSource':                     { en: '{n} sources', he: '{n} מקורות' },
  'tooltip.multiSource':                   { en: 'This item is backed by multiple related sources, not just one — expand it to see all of them.', he: 'הפריט הזה מבוסס על כמה מקורות קשורים, לא רק אחד — הרחיבו לראות את כולם.' },

  // ── Card category labels (Learn | Build | Career | Tool | Trend | Market | Research) ─
  'category.Learn':                      { en: 'Learn', he: 'למידה' },
  'category.Build':                       { en: 'Build', he: 'בנייה' },
  'category.Career':                       { en: 'Career', he: 'קריירה' },
  'category.Tool':                          { en: 'Tool', he: 'כלי' },
  'category.Trend':                          { en: 'Trend', he: 'מגמה' },
  'category.Market':                          { en: 'Market Signal', he: 'סיגנל שוק' },
  'category.Research':                         { en: 'Research', he: 'מחקר' },

  // ── Market Signals domain — experimental, research-only framing ─
  'market.disclaimer':                          { en: 'This is a research signal, not financial advice.', he: 'זהו סיגנל למחקר, לא ייעוץ פיננסי.' },
  'market.experimentalBadge':                    { en: 'Experimental', he: 'ניסיוני' },

  // ── Attention budget labels ────────────────────────────────────
  'budget.high':                          { en: 'High Attention', he: 'תשומת לב גבוהה' },
  'budget.medium':                         { en: 'Medium Attention', he: 'תשומת לב בינונית' },
  'budget.low':                             { en: 'Low Attention', he: 'תשומת לב נמוכה' },
  'tooltip.attentionBudget':                { en: 'Attention Budget: how much of your time this item is worth — High means act on it soon, Low means it is fine to skim or skip.', he: 'תקציב תשומת לב: כמה מהזמן שלך הפריט הזה שווה — גבוהה אומרת שכדאי לטפל בו בקרוב, נמוכה אומרת שאפשר לעבור עליו במהירות או לדלג.' },

  // ── Memory page ────────────────────────────────────────────────
  'memory.title':                            { en: 'Memory System', he: 'מערכת הזיכרון' },
  'memory.subtitle':                          { en: 'Life Board learns from every interaction', he: 'Life Board לומדת מכל אינטראקציה' },
  'memory.stats.helpful':                      { en: 'Helpful', he: 'מועיל' },
  'memory.stats.helpfulSub':                    { en: 'items confirmed', he: 'פריטים שאושרו' },
  'memory.stats.notHelpful':                     { en: 'Not Helpful', he: 'לא מועיל' },
  'memory.stats.notHelpfulSub':                   { en: 'items rejected', he: 'פריטים שנדחו' },
  'memory.stats.patterns':                         { en: 'Patterns', he: 'דפוסים' },
  'memory.stats.patternsSub':                       { en: 'rules learned', he: 'חוקים שנלמדו' },
  'memory.recentEvents':                            { en: 'Recent Events', he: 'אירועים אחרונים' },
  'memory.howItWorks':                                { en: 'How memory works', he: 'איך הזיכרון עובד' },
  'memory.bullet1':                                    { en: 'Every helpful/not helpful feedback trains the Judgment Engine', he: 'כל משוב — מועיל או לא — מאמן את מנוע השיפוט' },
  'memory.bullet2':                                     { en: 'Domains you consistently ignore get their priority score lowered', he: 'תחומים שאתה מתעלם מהם באופן עקבי מקבלים ציון עדיפות נמוך יותר' },
  'memory.bullet3':                                      { en: 'Domains you engage with get their priority score raised', he: 'תחומים שאתה מתעניין בהם מקבלים ציון עדיפות גבוה יותר' },
  'memory.bullet4':                                       { en: 'Patterns in what you act on are used to weight the LVS formula', he: 'דפוסים בפעולות שלך משמשים לכיול הנוסחה של ניקוד הערך (LVS)' },
  'memory.type.actedOn':                                   { en: 'Acted On', he: 'בוצעה פעולה' },
  'memory.type.helpful':                                    { en: 'Helpful', he: 'מועיל' },
  'memory.type.notHelpful':                                  { en: 'Not Helpful', he: 'לא מועיל' },
  'memory.type.dismissed':                                    { en: 'Dismissed', he: 'נמחק' },
  'memory.type.priorityAdjusted':                              { en: 'Priority Adjusted', he: 'עדיפות עודכנה' },
  'memory.type.patternLearned':                                 { en: 'Pattern Learned', he: 'דפוס נלמד' },
  'memory.justNow':                                              { en: 'just now', he: 'הרגע' },
  'memory.hoursAgo':                                              { en: '{n}h ago', he: 'לפני {n} שעות' },
  'memory.daysAgo':                                                { en: '{n}d ago', he: 'לפני {n} ימים' },
  'memory.empty.title':                                            { en: 'No memory yet', he: 'אין עדיין זיכרון' },
  'memory.empty.body':                                              { en: 'Mark a few items helpful or not helpful on your board — Life Board will start learning what matters to you and show it here.', he: 'סמנו כמה פריטים בלוח כ"מועיל" או "לא מועיל" — Life Board תתחיל ללמוד מה חשוב לכם ותציג זאת כאן.' },
  'memory.rankingImpact':                                           { en: 'How this changed your rankings', he: 'איך זה שינה את הדירוג שלך' },
  'memory.rankingImpact.sub':                                       { en: 'Each point nudges future scoring for that domain, source, or category.', he: 'כל נקודה מזיזה את הניקוד העתידי לתחום, למקור או לקטגוריה הזו.' },
  'memory.rankingImpact.domains':                                   { en: 'By domain', he: 'לפי תחום' },
  'memory.rankingImpact.sources':                                   { en: 'By source', he: 'לפי מקור' },
  'memory.rankingImpact.categories':                                { en: 'By category', he: 'לפי קטגוריה' },
  'memory.rankingImpact.empty':                                     { en: 'Not enough feedback yet to show an impact here.', he: 'אין עדיין מספיק משוב כדי להציג השפעה כאן.' },

  // ── Profile page ───────────────────────────────────────────────
  'profile.title':                  { en: 'Profile & Goals', he: 'פרופיל ומטרות' },
  'profile.save':                    { en: 'Save Changes', he: 'שמירת שינויים' },
  'profile.saved':                    { en: '✓ Saved', he: '✓ נשמר' },
  'profile.identity':                  { en: 'Identity', he: 'פרטים אישיים' },
  'profile.name':                       { en: 'Name', he: 'שם' },
  'profile.age':                          { en: 'Age', he: 'גיל' },
  'profile.profession':                    { en: 'Profession', he: 'מקצוע' },
  'profile.professionValue':                { en: 'Software Engineer, 3 years', he: 'מהנדס תוכנה, 3 שנות ניסיון' },
  'profile.skills':                          { en: 'Skills', he: 'כישורים' },
  'profile.skillsValue':                      { en: 'Python, TypeScript, React, ML basics', he: 'Python, TypeScript, React, יסודות ML' },
  'profile.location':                          { en: 'Location', he: 'מיקום' },
  'profile.locationValue':                      { en: 'Tel Aviv, Israel', he: 'תל אביב, ישראל' },
  'profile.domainPriorities':                    { en: 'Domain Priorities', he: 'תחומי עדיפות' },
  'profile.domainPrioritiesSub':                  { en: 'Adjust what Life Board focuses on', he: 'התאם את המיקוד של Life Board' },
  'profile.activeGoals':                            { en: 'Active Life Goals', he: 'מטרות חיים פעילות' },
  'profile.addGoal':                                  { en: '+ Add goal', he: '+ הוספת מטרה' },
  'profile.dataSources':                                { en: 'Data Sources', he: 'מקורות מידע' },
  'profile.dataSourcesSub':                              { en: 'Live, free, no-key sources for your active domains', he: 'מקורות חיים וחינמיים לתחומים הפעילים שלך' },
  'profile.noActiveSources':                             { en: 'No active domains yet — turn some on above.', he: 'אין תחומים פעילים עדיין — הפעל כמה למעלה.' },
  'profile.connect':                                     { en: 'Connect', he: 'חיבור' },
  'profile.connected':                                    { en: 'Connected', he: 'מחובר' },
  'profile.addDomain':                                     { en: '+ Add', he: '+ הוספה' },
  'profile.remove':                                         { en: 'Remove', he: 'הסרה' },
  'profile.priorityScaleLow':                                { en: 'Irrelevant', he: 'לא רלוונטי' },
  'profile.priorityScaleHigh':                                { en: 'Extremely important', he: 'חשוב ביותר' },
  'profile.lifeDomains':                                       { en: 'Life Domains', he: 'תחומי עניין' },
  'profile.lifeDomainsSub':                                    { en: 'Broad life areas your tracked domains roll up into', he: 'תחומי החיים הרחבים שהתחומים שאתה עוקב אחריהם משתייכים אליהם' },

  // ── Onboarding ────────────────────────────────────────────────
  'onboarding.welcomeTitle':       { en: 'Welcome to Life Board', he: 'ברוכים הבאים ל-Life Board' },
  'onboarding.welcomeSub':         { en: 'A personal intelligence board that researches the world and surfaces what is truly worth your attention.', he: 'לוח אישי וחכם שסורק את העולם ומציג את מה שבאמת שווה את תשומת הלב שלך.' },
  'onboarding.interestsTitle':     { en: 'What should Life Board track for you?', he: 'מה Life Board צריך לעקוב בשבילך?' },
  'onboarding.interestsSub':       { en: 'Pick as many domains as you like — change this anytime in your profile.', he: 'בחר כמה תחומים שתרצה — אפשר לשנות בכל עת בפרופיל.' },
  'onboarding.priorityTitle':      { en: 'How important is each one right now?', he: 'כמה חשוב כל אחד מהם כרגע?' },
  'onboarding.goalTitle':          { en: 'Anything specific you’re working toward?', he: 'יש משהו ספציפי שאתה עובד עליו?' },
  'onboarding.goalOptional':       { en: 'optional', he: 'אופציונלי' },
  'onboarding.goalPlaceholder':    { en: 'e.g. Find a senior engineering role', he: 'לדוגמה: למצוא משרת הנדסה בכירה' },
  'onboarding.low':                { en: 'Low', he: 'נמוכה' },
  'onboarding.medium':             { en: 'Medium', he: 'בינונית' },
  'onboarding.high':               { en: 'High', he: 'גבוהה' },
  'onboarding.getStarted':         { en: 'Get Started →', he: 'התחלה →' },
  'onboarding.selectAtLeastOne':   { en: 'Pick at least one domain to continue', he: 'בחר לפחות תחום אחד כדי להמשיך' },
  'onboarding.selectedCount':      { en: '{n} selected', he: '{n} נבחרו' },
}

// Domain and agent labels now live in '@/lib/domains' (getDomainLabel,
// agentLabel) — sourced from the domain registry so they scale to any
// number of domains instead of a closed Record here.

// ── Attention budget labels (short form, used outside cards) ───────
export const BUDGET_SHORT_LABELS: Record<AttentionBudget, Entry> = {
  high:   { en: 'High',   he: 'גבוהה' },
  medium: { en: 'Medium', he: 'בינונית' },
  low:    { en: 'Low',    he: 'נמוכה' },
}

export function tr(key: string, lang: Lang, vars?: Record<string, string | number>): string {
  const entry = dict[key]
  let str = entry ? entry[lang] : key
  if (vars) {
    for (const [k, v] of Object.entries(vars)) {
      str = str.replace(new RegExp(`\\{${k}\\}`, 'g'), String(v))
    }
  }
  return str
}

export function formatTimeAgo(dateStr: string, lang: Lang): string {
  const diff  = Date.now() - new Date(dateStr).getTime()
  const days  = Math.floor(diff / 86400000)
  const hours = Math.floor(diff / 3600000)
  if (days > 0)  return tr('memory.daysAgo', lang, { n: days })
  if (hours > 0) return tr('memory.hoursAgo', lang, { n: hours })
  return tr('memory.justNow', lang)
}

export function formatItemCount(n: number, lang: Lang): string {
  if (n === 1) return tr('agentStatus.itemCount', lang, { n })
  return tr('agentStatus.itemCountPlural', lang, { n })
}

// "Published 2d ago" / "פורסם לפני 2 ימים" — wraps formatTimeAgo so cards
// can show a real, source-derived age instead of feeling timeless.
export function formatPublished(dateStr: string, lang: Lang): string {
  return tr('card.publishedAgo', lang, { time: formatTimeAgo(dateStr, lang) })
}

// ── Action-oriented source link labels ──────────────────────────────
// "View GitHub repo" beats a bare "GitHub ↗" — the point of a source link
// is to help someone go deeper, so the label should say what they'll find.
const SOURCE_ACTION_LABELS: Record<string, Entry> = {
  'GitHub':         { en: 'View GitHub repo', he: 'צפייה ברפו ב-GitHub' },
  'Hacker News':    { en: 'Open discussion',  he: 'פתיחת הדיון' },
  'arXiv':          { en: 'Open paper',       he: 'פתיחת המאמר' },
  'Dev.to':         { en: 'Read article',     he: 'קריאת המאמר' },
  'CoinGecko':      { en: 'View market source', he: 'צפייה במקור השוק' },
  'Federal Reserve': { en: 'Read official release', he: 'קריאת ההודעה הרשמית' },
}
const DEFAULT_SOURCE_ACTION_LABEL: Entry = { en: 'Open source', he: 'פתיחת המקור' }

export function sourceActionLabel(sourceName: string, lang: Lang): string {
  const clean = sourceName.replace(/\s*\(live\)\s*$/i, '').trim()
  const entry = SOURCE_ACTION_LABELS[clean]
  if (entry) return entry[lang]
  return `${DEFAULT_SOURCE_ACTION_LABEL[lang]}: ${clean}`
}
