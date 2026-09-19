import { head, list } from '@vercel/blob'
import { r2HeadPublicUrl, r2List, getR2Client } from '@/lib/r2'

/**
 * Central "given a content hash, what media do we have?" helper.
 *
 * Storage strategy after the R2 migration:
 *   1. Every NEW upload lands in Cloudflare R2 at `captures/<hash>.<ext>`.
 *   2. LEGACY uploads (pre-migration) still live in Vercel Blob at the
 *      same key. We check R2 first — the common case — and only fall
 *      back to Vercel Blob when R2 has nothing, so old records keep
 *      resolving without a manual copy.
 *
 * Callers get a single `ResolvedCaptureMedia` shape regardless of
 * which store the URL came from.
 */

export interface ResolvedCaptureMedia {
  imageUrl?: string
  animationUrl?: string
  posterUrl?: string
  /** True when we resolved any media URL (from R2 or legacy Blob). */
  hasMedia: boolean
}

// ---- Legacy Vercel Blob helpers -----------------------------------------

async function tryHeadBlob(pathname: string, token: string): Promise<string | null> {
  try {
    const meta = await head(pathname, { token })
    return meta?.url ?? null
  } catch {
    return null
  }
}

async function resolveFromVercelBlob(hash: string): Promise<{
  imageUrl?: string
  animationUrl?: string
}> {
  const token = process.env.BLOB_READ_WRITE_TOKEN
  if (!token) return {}
  const [jpgUrl, pngUrl, mp4Url, webmUrl] = await Promise.all([
    tryHeadBlob(`captures/${hash}.jpg`, token),
    tryHeadBlob(`captures/${hash}.png`, token),
    tryHeadBlob(`captures/${hash}.mp4`, token),
    tryHeadBlob(`captures/${hash}.webm`, token),
  ])
  let imageUrl = jpgUrl ?? pngUrl ?? undefined
  let animationUrl = mp4Url ?? webmUrl ?? undefined
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
  return { imageUrl, animationUrl }
}

// ---- R2 helpers ---------------------------------------------------------

async function resolveFromR2(hash: string): Promise<{
  imageUrl?: string
  animationUrl?: string
}> {
  if (!getR2Client()) return {}
  const [jpgUrl, pngUrl, mp4Url, webmUrl] = await Promise.all([
    r2HeadPublicUrl(`captures/${hash}.jpg`),
    r2HeadPublicUrl(`captures/${hash}.png`),
    r2HeadPublicUrl(`captures/${hash}.mp4`),
    r2HeadPublicUrl(`captures/${hash}.webm`),
  ])
  let imageUrl = jpgUrl ?? pngUrl ?? undefined
  let animationUrl = mp4Url ?? webmUrl ?? undefined
  if (!imageUrl || !animationUrl) {
    const items = await r2List(`captures/${hash}`)
    for (const it of items) {
      const p = it.key.toLowerCase()
      if (!imageUrl && /\.(jpe?g|png|webp|gif)$/.test(p)) imageUrl = it.url
      if (!animationUrl && /\.(mp4|webm|mov|m4v)$/.test(p)) animationUrl = it.url
    }
  }
  return { imageUrl, animationUrl }
}

// ---- Public entry point -------------------------------------------------

export async function resolveCaptureMedia(hash: string): Promise<ResolvedCaptureMedia> {
  if (!/^[0-9a-f]{64}$/.test(hash)) return { hasMedia: false }

  // R2 first — that's where all new uploads land after the migration.
  const r2 = await resolveFromR2(hash)
  let imageUrl = r2.imageUrl
  let animationUrl = r2.animationUrl

  // Legacy Vercel Blob fallback. Only bother when at least one media
  // channel is still missing so we skip an unnecessary HEAD round-trip
  // in the common R2-hit case.
  if (!imageUrl || !animationUrl) {
    const blob = await resolveFromVercelBlob(hash)
    imageUrl = imageUrl ?? blob.imageUrl
    animationUrl = animationUrl ?? blob.animationUrl
  }

  return {
    imageUrl,
    animationUrl,
    // Poster = still image alongside a playable video. When only an
    // image is present it doubles as the primary asset; when a video
    // is present, callers use posterUrl on <video>.
    posterUrl: animationUrl ? imageUrl : undefined,
    hasMedia: !!(imageUrl || animationUrl),
  }
}
