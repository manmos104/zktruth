import { head, list } from '@vercel/blob'

/**
 * Central "given a content hash, what media do we have?" helper.
 *
 * We store every uploaded capture under `captures/<hash>.<ext>` where
 * <ext> is one of jpg / png / mp4 / webm. Both the NFT metadata
 * endpoint (`/api/nft/item/<hash>`) and the proof page endpoint
 * (`/api/proof/<hash>`) need to resolve the actual public URLs, so
 * the probing logic lives here and is called from both — a single
 * source of truth prevents them drifting apart (which is what caused
 * "video plays in the NFT but not in /proof" before).
 *
 * Resolution strategy:
 *   1. `head()` the four canonical extensions in parallel.
 *   2. If none of the primary probes hit, fall back to `list()` with a
 *      prefix — this catches non-canonical extensions like `.jpeg`,
 *      `.mov`, or old records where the extension was different.
 *   3. Return whatever we found. Callers decide how to fill in a
 *      fallback logo when everything is null.
 */

export interface ResolvedCaptureMedia {
  imageUrl?: string
  animationUrl?: string
  posterUrl?: string
  /** True when the media was uploaded to Blob and we can serve it. */
  hasMedia: boolean
}

async function tryHead(pathname: string, token: string): Promise<string | null> {
  try {
    const meta = await head(pathname, { token })
    return meta?.url ?? null
  } catch {
    return null
  }
}

export async function resolveCaptureMedia(hash: string): Promise<ResolvedCaptureMedia> {
  const token = process.env.BLOB_READ_WRITE_TOKEN
  if (!token) return { hasMedia: false }
  if (!/^[0-9a-f]{64}$/.test(hash)) return { hasMedia: false }

  const [jpgUrl, pngUrl, mp4Url, webmUrl] = await Promise.all([
    tryHead(`captures/${hash}.jpg`, token),
    tryHead(`captures/${hash}.png`, token),
    tryHead(`captures/${hash}.mp4`, token),
    tryHead(`captures/${hash}.webm`, token),
  ])
  let imageUrl = jpgUrl ?? pngUrl ?? undefined
  let animationUrl = mp4Url ?? webmUrl ?? undefined

  // Fallback listing catches non-canonical extensions (.jpeg / .mov /
  // .m4v / .webp) — these show up when a client uploaded with a MIME
  // type that maps to a suffix we don't probe explicitly.
  if (!imageUrl || !animationUrl) {
    try {
      const listing = await list({ prefix: `captures/${hash}`, token })
      for (const b of listing.blobs) {
        const p = b.pathname.toLowerCase()
        if (!imageUrl && /\.(jpe?g|png|webp|gif)$/.test(p)) imageUrl = b.url
        if (!animationUrl && /\.(mp4|webm|mov|m4v)$/.test(p)) animationUrl = b.url
      }
    } catch { /* best-effort */ }
  }

  return {
    imageUrl,
    animationUrl,
    // Poster = still image alongside a playable video. When only an
    // image is present it doubles as the primary asset; when a video
    // is present, callers use posterUrl on <video>. Same URL either
    // way, but named separately so the API surface stays clear.
    posterUrl: animationUrl ? imageUrl : undefined,
    hasMedia: !!(imageUrl || animationUrl),
  }
}
