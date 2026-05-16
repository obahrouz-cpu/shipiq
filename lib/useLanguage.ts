'use client'
import { useState, useEffect, useCallback } from 'react'
import type { Lang } from './i18n'
import { i18n } from './i18n'

export type { Lang }

const LS_KEY  = 'shipiq_lang'
const EV_NAME = 'shipiq:lang_change'

function readStored(): Lang {
  if (typeof window === 'undefined') return 'en'
  return (localStorage.getItem(LS_KEY) as Lang) ?? 'en'
}

function applyToDocument(lang: Lang) {
  if (typeof document === 'undefined') return
  document.documentElement.dir  = lang === 'ar' ? 'rtl' : 'ltr'
  document.documentElement.lang = lang
  document.body.classList.toggle('ar', lang === 'ar')
}

export function useLanguage() {
  const [language, setLang] = useState<Lang>('en')

  // Hydrate from localStorage after mount (SSR-safe)
  useEffect(() => {
    const lang = readStored()
    setLang(lang)
    applyToDocument(lang)
  }, [])

  // Sync with other hook instances via custom event
  useEffect(() => {
    const handler = () => {
      const lang = readStored()
      setLang(lang)
      applyToDocument(lang)
    }
    window.addEventListener(EV_NAME, handler)
    return () => window.removeEventListener(EV_NAME, handler)
  }, [])

  const setLanguage = useCallback((lang: Lang) => {
    localStorage.setItem(LS_KEY, lang)
    setLang(lang)
    applyToDocument(lang)
    window.dispatchEvent(new Event(EV_NAME))
  }, [])

  const t = useCallback((section: string, key: string): string => {
    const langDict = i18n[language] as Record<string, Record<string, string>>
    const enDict   = i18n.en       as Record<string, Record<string, string>>
    return langDict?.[section]?.[key] ?? enDict?.[section]?.[key] ?? key
  }, [language])

  return { language, t, setLanguage }
}
