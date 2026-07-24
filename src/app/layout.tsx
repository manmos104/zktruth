import type { Metadata, Viewport } from 'next'
import Script from 'next/script'
import { Geist } from 'next/font/google'
import './globals.css'
import { Providers } from './providers'

const geist = Geist({ subsets: ['latin'] })

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: 'cover',
}

export const metadata: Metadata = {
  title: 'zkTruth',
  description: 'Proof of Capture on TON — verified photos & videos with on-chain authenticity',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'zkTruth',
  },
  manifest: '/manifest.json',
  other: {
    // Stops Safari / Chrome / the Telegram in-app browser from
    // auto-translating the capture UI labels ("VERIFY :: WORLD ID",
    // "WALLET", "REC 00:07"). Any auto-translation mangles the inline
    // copy and the debug overlay we lean on to chase in-Telegram bugs.
    google: 'notranslate',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" translate="no" className="notranslate" style={{ height: '100%', overflow: 'hidden' }}>
      <head>
        {/* Telegram WebApp runtime. Injecting it via <Script strategy="beforeInteractive">
            guarantees `window.Telegram.WebApp` exists before any client
            component tries to read it (our TelegramInit reads it on
            mount). Outside Telegram the script is a harmless no-op. */}
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
        />
      </head>
      <body className={geist.className} style={{ height: '100%', overflow: 'hidden', margin: 0 }}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
