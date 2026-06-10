import React, { createContext, useContext, useEffect, useState } from 'react'

export type Lang = 'zh' | 'en'

interface LangContextValue {
  lang: Lang
  setLang: (lang: Lang) => void
}

const LangContext = createContext<LangContextValue | undefined>(undefined)

const STORAGE_KEY = 'site_lang'

export const LangProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [lang, setLangState] = useState<Lang>(() => {
    if (typeof window === 'undefined') return 'zh'
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY)
      if (stored === 'en' || stored === 'zh') return stored
    } catch {
      // ignore
    }
    return 'zh'
  })

  const setLang = (next: Lang) => {
    setLangState(next)
    try {
      window.localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, lang)
    } catch {
      // ignore
    }
  }, [lang])

  // 站点切换语言时同步 Crisp 聊天框语言（zh / en）
  useEffect(() => {
    try {
      const crisp = (window as Window & { $crisp?: { push: (cmd: unknown[]) => void } }).$crisp
      if (crisp && typeof crisp.push === 'function') {
        crisp.push(['config', 'locale', [lang]])
      }
    } catch {
      // ignore
    }
  }, [lang])

  return <LangContext.Provider value={{ lang, setLang }}>{children}</LangContext.Provider>
}

export function useLang(): LangContextValue {
  const ctx = useContext(LangContext)
  if (!ctx) {
    throw new Error('useLang must be used within LangProvider')
  }
  return ctx
}

