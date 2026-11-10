// e2e_browser.js — חלק הדפדפן של scripts/e2e.py. מדפיס שורה אחת: RESULT {json}
const { chromium } = require('playwright');
const [phase, link, out] = process.argv.slice(2);
(async () => {
  const b = await chromium.launch();
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, locale: 'he-IL' });
  const p = await ctx.newPage();
  const errors = [], res = { errors };
  p.on('pageerror', e => errors.push(e.message));
  p.on('dialog', d => d.dismiss());
  try {
    await p.goto(link, { waitUntil: 'domcontentloaded', timeout: 60000 });
    await p.waitForFunction(() => typeof ME !== 'undefined' && ME && window.__runsReady, null, { timeout: 45000 });
    res.logged_in = true;
    await p.waitForTimeout(1500);
    res.token = await p.evaluate(async () => (await SB.auth.getSession()).data.session.access_token);
    await p.screenshot({ path: `${out}/${phase}_home.png` });
    if (phase === 'phase1') {
      // אותה קריאה שהאפליקציה עושה אחרי השאלון
      await p.evaluate(() => prepNow('scan'));
      await p.waitForTimeout(6000);
      res.prep_ok = await p.evaluate(() => !!(typeof _prep !== 'undefined' && _prep && _prep.scan));
      res.prep_note = await p.evaluate(() => (document.querySelector('#prepBar') || {}).innerText || (document.querySelector('.toast') || {}).innerText || '');
      await p.screenshot({ path: `${out}/phase1_scanning.png` });
      for (const pg of ['jobs', 'apps', 'prep', 'linkedin', 'office', 'profile', 'settings']) {
        await p.evaluate(x => goPage(x), pg); await p.waitForTimeout(700);
        await p.screenshot({ path: `${out}/phase1_${pg}.png` });
      }
      await p.evaluate(() => { goPage('main'); tourStart(); }); await p.waitForTimeout(900);
      await p.screenshot({ path: `${out}/phase1_tour.png` });
    } else {
      await p.evaluate(() => goPage('jobs')); await p.waitForTimeout(1200);
      res.cards = await p.evaluate(() => (typeof queue === 'function' ? queue().length : 0));
      await p.screenshot({ path: `${out}/phase2_jobs.png` });
      const id = await p.evaluate(() => queue()[0]);
      if (id) { await p.evaluate(x => openJobInfo(x), id); await p.waitForTimeout(800); await p.screenshot({ path: `${out}/phase2_job.png` }); await p.evaluate(() => closeSheet()); }
      await p.evaluate(() => goPage('apps')); await p.waitForTimeout(900);
      await p.screenshot({ path: `${out}/phase2_apps.png` });
      // מחיקת חשבון: אותה פונקציה שהכפתור בהגדרות מפעיל
      await p.evaluate(() => { deleteAccount(); }); await p.waitForTimeout(5000);   // הדף נטען מחדש אחרי המחיקה
      res.deleted = true;   // הבדיקה האמיתית: בצד השרת (e2e.py בודק שהפרופיל נמחק)
    }
  } catch (e) { res.note = String(e.message || e).slice(0, 200); await p.screenshot({ path: `${out}/${phase}_fail.png` }).catch(() => {}); }
  await b.close();
  console.log('RESULT ' + JSON.stringify(res));
})();
