'use client'

import { createContext, useCallback, useContext, useEffect, useState } from 'react'
import { tr, type Lang } from './i18n'

const STORAGE_KEY = 'lifeboard-lang'

interface LanguageContextValue {
  lang: Lang
  dir: 'rtl' | 'ltr'
  setLang: (l: Lang) => void
  toggleLang: () => void
  t: (key: string, vars?: Record<string, string | number>) => string
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  // Default Hebrew. Corrected from localStorage right after mount (see also
  // the inline head script in layout.tsx, which sets dir/lang before paint).
  const [lang, setLangState] = useState<Lang>('he')

  useEffect(() => {
    const stored = window.localStorage.getItem(STORAGE_KEY)
    if (stored === 'en' || stored === 'he') setLangState(stored)
  }, [])

  useEffect(() => {
    document.documentElement.lang = lang
    document.documentElement.dir = lang === 'he' ? 'rtl' : 'ltr'
    window.localStorage.setItem(STORAGE_KEY, lang)
  }, [lang])

  const setLang = useCallback((l: Lang) => setLangState(l), [])
  const toggleLang = useCallback(() => setLangState(l => (l === 'he' ? 'en' : 'he')), [])
  const t = useCallback((key: string, vars?: Record<string, string | number>) => tr(key, lang, vars), [lang])

  return (
    <LanguageContext.Provider value={{ lang, dir: lang === 'he' ? 'rtl' : 'ltr', setLang, toggleLang, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage(): LanguageContextValue {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used within a LanguageProvider')
  return ctx
}
