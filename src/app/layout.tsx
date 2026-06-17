import type { Metadata, Viewport } from 'next'
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
  description: 'Proof of Capture — Authenticated photos on World Chain',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'zkTruth',
  },
  manifest: '/manifest.json',
  other: {
    // Stops Safari / Chrome from auto-translating the camera UI labels
    // (e.g. "VERIFY :: WORLD ID", "WALLET", "REC 00:07") which mangles
    // the inline copy and the debug overlay we use to chase Safari bugs.
    google: 'notranslate',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" translate="no" className="notranslate" style={{ height: '100%', overflow: 'hidden' }}>
      <body className={geist.className} style={{ height: '100%', overflow: 'hidden', margin: 0 }}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
