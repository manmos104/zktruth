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
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" style={{ height: '100%', overflow: 'hidden' }}>
      <body className={geist.className} style={{ height: '100%', overflow: 'hidden', margin: 0 }}>
        <Providers>{children}</Providers>
      </body>
    </html>
  )
}
