import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'zkTruth — Verified Capture',
  description: 'On-chain proof of authenticity. Verified via World ID zero-knowledge proof on World Chain.',
  openGraph: {
    title: 'zkTruth — Verified Capture',
    description: 'On-chain proof of authenticity verified via World ID on World Chain.',
    siteName: 'zkTruth',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'zkTruth — Verified Capture',
    description: 'On-chain proof of authenticity verified via World ID on World Chain.',
  },
  other: {
    'fc:frame': 'vNext',
    'fc:frame:button:1': 'View Proof',
    'fc:frame:button:1:action': 'link',
  },
}

export default function ProofLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>
}
