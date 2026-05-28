import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

export default function InstallBanner() {
  const { t } = useTranslation()
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches
    if (isStandalone) return

    const handler = (e: Event) => {
      e.preventDefault()
      setPrompt(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  if (!prompt) return null

  const install = async () => {
    await prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') setPrompt(null)
  }

  return (
    <div className="install-banner">
      <span>{t('install.description')}</span>
      <button onClick={install}>{t('install.action')}</button>
      <button className="install-banner-close" onClick={() => setPrompt(null)}>✕</button>
    </div>
  )
}
