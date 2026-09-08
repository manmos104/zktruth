import type { Metadata } from 'next'
import { resolveCaptureMedia, type ResolvedCaptureMedia } from '@/lib/mediaResolver'
import { ProofView } from './_view'

/**
 * /proof/<hash>
 *
 * Public verification page. Both SNS scrapers and human viewers get
 * the same body — a card showing the capture timestamp, GPS status,
 * SHA-256 hash, on-chain anchor and the linked Telegram post, plus a
 * short "About zkTruth" section explaining what the product is doing
 * (authenticity guarantee, anti-fake-news, decentralised journalism,
 * incentive structure).
 *
 * OG meta tags in the head point image/video at the raw capture on
 * Vercel Blob so the shared thumbnail on X / Telegram / Discord is
 * the actual photo, and the title carries the short hash.
 */

export const revalidate = 15

export async function generateMetadata(
  { params }: { params: Promise<{ hash: string }> },
): Promise<Metadata> {
  const { hash: raw } = await params
  const hash = raw.toLowerCase()
  const short = hash.length >= 10 ? `${hash.slice(0, 6)}…${hash.slice(-4)}` : hash
  const title = `zkTruth Proof #${short}`
  const description = 'On-chain, tamper-evident proof of capture — SHA-256 anchored on TON. Join the channel: t.me/zktruth_channel'

  // Point og:image directly at the raw capture on Blob when we have
  // one. Satori (via /twitter-image) kept 500'ing on JPEG data URLs
  // even with the simplest possible layout — passing the Blob URL
  // straight to the SNS scraper is the reliable path and the one
  // that historically produced the thumbnail the user was happy with.
  // The hash is already surfaced by the title (`zkTruth Proof #…`)
  // so cards still carry the short address next to the image.
  const media = /^[0-9a-f]{64}$/.test(hash)
    ? await resolveCaptureMedia(hash).catch(() => ({ hasMedia: false } as ResolvedCaptureMedia))
    : ({ hasMedia: false } as ResolvedCaptureMedia)
  const captureImage = media.imageUrl
  const captureVideo = media.animationUrl
  const videoMime =
    captureVideo && /\.mp4(\?|$)/i.test(captureVideo)  ? 'video/mp4'
    : captureVideo && /\.webm(\?|$)/i.test(captureVideo) ? 'video/webm'
    : captureVideo && /\.mov(\?|$)/i.test(captureVideo)  ? 'video/quicktime'
    : undefined

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      images: captureImage ? [captureImage] : undefined,
      videos: captureVideo
        ? [{
            url: captureVideo,
            secureUrl: captureVideo,
            type: videoMime,
            width: 1080,
            height: 1080,
          }]
        : undefined,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: captureImage ? [captureImage] : undefined,
    },
  }
}

export default async function ProofPage(
  { params }: { params: Promise<{ hash: string }> },
) {
  const { hash: raw } = await params
  const hash = raw.toLowerCase()
  // Humans and bots both land on the verification card — the redirect
  // to Telegram was pulled back at the user's request. The card itself
  // now carries the timestamp / GPS / hash + a short "About zkTruth"
  // section so a first-time visitor gets both the receipt and the
  // product pitch in one view.
  return <ProofView hash={hash} />
}
