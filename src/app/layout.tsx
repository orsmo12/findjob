import type { Metadata } from 'next'
import './globals.css'
import { LanguageProvider } from '@/lib/language-context'

export const metadata: Metadata = {
  title: 'Life Board',
  description: 'A personal bulletin board that researches the world for you.',
}

// Runs before paint/hydration so the page never flashes the wrong
// direction while React boots up.
const noFlashScript = `
(function () {
  try {
    var l = localStorage.getItem('lifeboard-lang') || 'he';
    document.documentElement.lang = l;
    document.documentElement.dir = l === 'he' ? 'rtl' : 'ltr';
  } catch (e) {}
})();
`

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="he" dir="rtl" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: noFlashScript }} />
      </head>
      <body className="antialiased">
        <LanguageProvider>{children}</LanguageProvider>
      </body>
    </html>
  )
}
