import type { Metadata } from 'next'
import { headers } from 'next/headers'
import { redirect } from 'next/navigation'
import { getProofByHash } from '@/lib/proofStore'
import { ProofView } from './_view'

/**
 * /proof/<hash>
 *
 * Dual-mode entry point:
 *   - SNS scrapers (Twitter, Telegram, Discord, Facebook, iMessage, …)
 *     receive the full HTML with rich Open Graph meta tags: image /
 *     video from Vercel Blob, title, description. The page body renders
 *     the same verification card so any preview crawler that follows
 *     the link (e.g. `curl` from a chat bot) sees a real page.
 *   - Human viewers are 302-redirected straight to the linked Telegram
 *     channel post. Tapping the SNS card feels like "the photo took me
 *     to the community", not "the photo took me to a technical proof
 *     page". The verification UI is still reachable via /verify.
 *
 * We distinguish scrapers from humans by User-Agent. It's imperfect
 * (a determined actor can fake either) but reliable enough for OG /
 * card scraping which uses well-known crawler identities.
 */

export const revalidate = 15

// User-Agent substrings for the SNS crawlers we care about. Anything
// that matches one of these gets served the full HTML + OG meta so the
// preview card can render. Everything else counts as a human visit and
// gets bounced to the Telegram channel.
const BOT_UA_PATTERNS = [
  'twitterbot',
  'facebookexternalhit',
  'facebot',
  'telegrambot',
  'discordbot',
  'slackbot',
  'linkedinbot',
  'whatsapp',
  'linebot',
  'line/',
  'skypeuripreview',
  'applebot',
  'redditbot',
  'pinterest',
  'embedly',
  'quora link preview',
  'showyoubot',
  'outbrain',
  'vkshare',
  'w3c_validator',
  'iframely',
  'nuzzel',
  'bitlybot',
  'yahoo! slurp',
  'googlebot',
  'bingbot',
]

function isBotUserAgent(ua: string): boolean {
  const lower = ua.toLowerCase()
  return BOT_UA_PATTERNS.some((p) => lower.includes(p))
}

const FALLBACK_TELEGRAM = 'https://t.me/zktruth_channel'

export async function generateMetadata(
  { params }: { params: Promise<{ hash: string }> },
): Promise<Metadata> {
  const { hash: raw } = await params
  const hash = raw.toLowerCase()
  const short = hash.length >= 10 ? `${hash.slice(0, 6)}…${hash.slice(-4)}` : hash
  const title = `zkTruth Proof #${short}`
  const description = 'On-chain, tamper-evident proof of capture — SHA-256 anchored on TON. Join the channel: t.me/zktruth_channel'

  // We intentionally leave `openGraph.images` / `twitter.images`
  // unset so Next.js falls back to the sibling twitter-image /
  // opengraph-image routes. Those render a branded wordmark card
  // with the short SHA-256 line at the bottom (the "0x… address"
  // look), which the user prefers over the raw capture photo.
  return {
    title,
    description,
    openGraph: {
      title,
      description,
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
    },
  }
}

export default async function ProofPage(
  { params }: { params: Promise<{ hash: string }> },
) {
  const { hash: raw } = await params
  const hash = raw.toLowerCase()

  const h = await headers()
  const ua = h.get('user-agent') ?? ''

  // Non-bot? Redirect straight to the Telegram channel post so the
  // shared SNS card feels like a portal into the community, not a
  // detour through a proof card. The verification UI lives at
  // /proof/<hash>/verify for anyone who actually wants receipts.
  if (!isBotUserAgent(ua)) {
    let target = FALLBACK_TELEGRAM
    try {
      const proof = await getProofByHash(hash)
      if (proof?.telegramPostUrl) target = proof.telegramPostUrl
    } catch { /* fall back to channel root */ }
    redirect(target)
  }

  // Bot — render the proof card so their OG scraper has real content.
  return <ProofView hash={hash} />
}
