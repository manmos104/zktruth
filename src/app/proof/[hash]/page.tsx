import type { Metadata } from 'next'
import { resolveCaptureMedia, type ResolvedCaptureMedia } from '@/lib/mediaResolver'
import { SITE_ORIGIN } from '@/lib/siteUrl'
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
 * OG meta tags in the head point the card image at the raw capture on
 * R2 so the shared thumbnail on X / Telegram / Discord is the actual
 * photo, and the title carries the short hash.
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

  // NEVER emit a card without an image. X caches the card it scraped
  // the first time a URL is seen (composer preview included) and keeps
  // serving it for days, so a single early scrape that found no media
  // used to leave the tweet permanently thumbnail-less — `images:
  // undefined` meant no og:image / twitter:image tag at all.
  //
  // The branded Satori route is the floor: it always answers 200, and
  // because it resolves the capture at RENDER time it self-heals — the
  // same cached URL starts returning the real photo as soon as the R2
  // upload lands.
  const fallbackCard = `${SITE_ORIGIN}/proof/${hash}/opengraph-image`
  const cardImage = media.imageUrl ?? fallbackCard

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      url: `${SITE_ORIGIN}/proof/${hash}`,
      type: 'website',
      images: [{ url: cardImage, alt: title }],
      // NOTE: no `videos`. og:video used to be emitted for video mints
      // (inline playback on Telegram/Discord), but those tags make X's
      // crawler go after a Player Card, which needs per-domain
      // whitelisting from X — unapproved, it renders no thumbnail at
      // all. Farcaster ignores og:video and reads og:image, which is
      // exactly why the same share showed a thumbnail on Farcaster and
      // nothing on X. The Telegram channel post carries the real media
      // through the Bot API, so dropping og:video costs us only
      // Discord's inline player.
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [{ url: cardImage, alt: title }],
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
