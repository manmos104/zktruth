'use client'

import { useEffect } from 'react'

/**
 * TelegramInit — one-shot Telegram Mini App bootstrap.
 *
 * When the page is loaded inside the Telegram in-app browser, Telegram
 * injects `window.Telegram.WebApp` and expects the app to call
 * `.ready()` to signal it's done drawing and can be revealed. Without
 * that call, Telegram keeps the launch loading indicator up
 * indefinitely.
 *
 * Outside Telegram (regular web browser) the global is absent, and
 * this component becomes a no-op — the app still works standalone.
 *
 * We also expand the WebApp to full height so the capture UI has the
 * whole screen, and force the theme colour to match the app's
 * background so the Telegram title bar doesn't clash.
 */
export function TelegramInit() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    const tg = (window as unknown as {
      Telegram?: {
        WebApp?: {
          ready: () => void
          expand: () => void
          setHeaderColor: (color: string) => void
          setBackgroundColor: (color: string) => void
        }
      }
    }).Telegram?.WebApp

    if (!tg) {
      // Not running inside Telegram — nothing to do, standalone web mode.
      return
    }

    try {
      tg.ready()
      tg.expand()
      // Match the app's splash + camera dark theme.
      tg.setHeaderColor('#000000')
      tg.setBackgroundColor('#000000')
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[TelegramInit] WebApp init failed', e)
    }
  }, [])

  return null
}
