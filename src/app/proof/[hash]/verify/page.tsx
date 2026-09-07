import type { Metadata } from 'next'
import { ProofView } from '../_view'

/**
 * /proof/<hash>/verify
 *
 * Always renders the full verification card, regardless of User-Agent.
 * This is the URL to share when someone actually wants receipts —
 * on-chain confirmation, item address, tonviewer link, etc. — rather
 * than the community funnel that /proof/<hash> becomes for humans.
 */

export const revalidate = 15

export async function generateMetadata(
  { params }: { params: Promise<{ hash: string }> },
): Promise<Metadata> {
  const { hash: raw } = await params
  const hash = raw.toLowerCase()
  const short = hash.length >= 10 ? `${hash.slice(0, 6)}…${hash.slice(-4)}` : hash
  return {
    title: `Verify · zkTruth Proof #${short}`,
    description: 'Independent on-chain verification of a zkTruth capture. Anchored on TON, TEP-62 NFT.',
    // Verify URLs don't need a rich card — anyone hitting this link is
    // already committed to reading receipts, not previewing them.
    openGraph: { title: `Verify · zkTruth Proof #${short}` },
  }
}

export default async function VerifyPage(
  { params }: { params: Promise<{ hash: string }> },
) {
  const { hash: raw } = await params
  const hash = raw.toLowerCase()
  return <ProofView hash={hash} />
}
