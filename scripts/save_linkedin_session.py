"""
save_linkedin_session.py — שמירת session cookies של LinkedIn.

הרץ פעם אחת כדי לשמור את ה-session שלך:
  python scripts/save_linkedin_session.py

הסקריפט פותח חלון Chromium גלוי — התחבר ל-LinkedIn ידנית,
ואז הסקריפט יישמור את ה-cookies אוטומטית.

הקובץ נשמר ב: agent_core/linkedin_cookies.json
לעולם אל תכניס אותו ל-Git! (הוא כבר ב-.gitignore)
"""

import json
import asyncio
from pathlib import Path

COOKIES_OUTPUT = Path(__file__).parent.parent / "agent_core" / "linkedin_cookies.json"


async def main():
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        print("❌ playwright לא מותקן. הרץ:")
        print("   pip install playwright")
        print("   playwright install chromium")
        return

    print("🌐 פותח Chrome לחיבור LinkedIn...")
    print("   1. התחבר ל-LinkedIn בחלון שייפתח")
    print("   2. אחרי שתתחבר — לחץ Enter בטרמינל")
    print()

    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=False)
        context = await browser.new_context()
        page    = await context.new_page()

        await page.goto("https://www.linkedin.com/login")

        # המתן לכניסת המשתמש
        input("   → לאחר שנכנסת ל-LinkedIn, לחץ Enter כאן: ")

        # שמור cookies
        cookies = await context.cookies()
        COOKIES_OUTPUT.parent.mkdir(parents=True, exist_ok=True)
        COOKIES_OUTPUT.write_text(json.dumps(cookies, ensure_ascii=False, indent=2))

        print(f"✅ נשמרו {len(cookies)} cookies אל: {COOKIES_OUTPUT}")
        print("   הסקראפר יוכל עכשיו להתחבר ללינקדין כמוך.")

        await browser.close()


if __name__ == "__main__":
    asyncio.run(main())
