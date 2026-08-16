'use client'

import { useEffect } from 'react'

/**
 * useTelegramExpand — squeeze the Telegram Mini App header out of the way.
 *
 * When the Mini App is launched via the OPEN button (from the Bot's
 * profile / a `t.me/bot/appname` deep link), Telegram gives us the
 * compact header — just Close (✕) and ⋯.
 *
 * When launched via the bot's Menu Button (a `web_app` URL registered
 * with BotFather), Telegram inserts a taller header with the bot's
 * name + "mini app" title. That extra strip shoves our whole UI down.
 *
 * We can't strip the header text from JS — only Telegram controls that
 * — but we CAN:
 *   1. Call `WebApp.expand()` so the sheet always opens at full height
 *      (no more half-screen slide-up mode).
 *   2. Paint the header background the same color as our top bar so
 *      the bot-name text visually merges into the dark chrome and no
 *      longer reads as a separate strip pushing content down.
 *   3. Turn off the vertical-swipe close so accidental scroll gestures
 *      inside our camera UI don't dismiss the whole Mini App.
 *   4. Fire `ready()` last so Telegram knows the app is done booting
 *      and stops holding the launch splash.
 *
 * Runs once on mount. Outside Telegram (regular browser tab) the API
 * is absent and the hook becomes a no-op.
 */
export function useTelegramExpand() {
  useEffect(() => {
    if (typeof window === 'undefined') return
    const wa = (window as unknown as {
      Telegram?: {
        WebApp?: {
          expand?: () => void
          ready?: () => void
          setHeaderColor?: (color: string) => void
          setBackgroundColor?: (color: string) => void
          disableVerticalSwipes?: () => void
          requestFullscreen?: () => void
        }
      }
    }).Telegram?.WebApp

    if (!wa) return

    try {
      // Match Telegram's header + surrounding chrome to our #080808
      // camera background. Even when Telegram's UI still shows the
      // bot name up top, painting the strip the same colour as our
      // canvas hides the visual seam that was making the app look
      // "pushed down" versus the compact OPEN-button launch.
      wa.setHeaderColor?.('#080808')
      wa.setBackgroundColor?.('#080808')
      // Full-height sheet — no half-screen slide-up.
      wa.expand?.()
      // Prevent accidental drag-to-close during camera / recording use.
      wa.disableVerticalSwipes?.()
      // Newer clients let us go actually fullscreen (removes the header
      // text row entirely). Best-effort — silently no-ops on older
      // Telegram builds.
      wa.requestFullscreen?.()
      // Tell Telegram we're booted so it drops the splash overlay.
      wa.ready?.()
    } catch {
      /* older Mini App runtimes may not expose every method — ignore */
    }
  }, [])
}
