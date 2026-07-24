'use client'

import { useEffect } from 'react'

/**
 * useTelegramBackButton — bind the native Telegram Mini App back button.
 *
 * Telegram exposes a system BackButton in the WebApp header. Showing
 * it is the idiomatic way for a Mini App to offer "back" navigation —
 * the user gets a familiar chevron in the same spot Telegram uses
 * elsewhere, and the button is guaranteed not to overlap the Close (✕)
 * button that would otherwise dismiss the entire app.
 *
 * Outside Telegram (regular browser) the API is absent, so this hook
 * becomes a no-op and the caller's on-screen back buttons remain the
 * only way to navigate.
 *
 * @param show    Whether the back button should be visible right now
 * @param onClick Called when the user taps the back button
 */
export function useTelegramBackButton(show: boolean, onClick: () => void) {
  useEffect(() => {
    if (typeof window === 'undefined') return
    const backButton = (window as unknown as {
      Telegram?: {
        WebApp?: {
          BackButton?: {
            show: () => void
            hide: () => void
            onClick: (cb: () => void) => void
            offClick: (cb: () => void) => void
          }
        }
      }
    }).Telegram?.WebApp?.BackButton

    if (!backButton) return

    if (show) {
      backButton.onClick(onClick)
      backButton.show()
    } else {
      backButton.hide()
    }

    // Cleanup: always detach the listener when the effect re-runs or
    // the component unmounts so we don't accumulate handlers.
    return () => {
      try {
        backButton.offClick(onClick)
        // We intentionally don't hide() on cleanup — hide() is caller-
        // controlled via the `show` prop. Hiding here would flicker
        // the button off between re-renders even when it should stay
        // visible.
      } catch {
        /* ignore */
      }
    }
  }, [show, onClick])
}
