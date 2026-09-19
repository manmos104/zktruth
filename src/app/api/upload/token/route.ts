import { NextResponse } from 'next/server'
import { presignPutUrl, r2PublicUrl } from '@/lib/r2'

/**
 * Presigns a PUT URL against Cloudflare R2 so the browser can
 * upload capture media directly, bypassing Vercel Function body
 * limits (4.5 MB on Hobby) and, more importantly, Vercel Blob's
 * 10 000-Simple / 2 000-Advanced monthly caps that we blew past
 * when the app hit real traffic.
 *
 * Flow:
 *   1. Client POSTs `{ pathname, contentType }` (with pathname of
 *      shape `captures/<sha256-hex>.<ext>`).
 *   2. We validate the shape and the MIME, then presign a short-
 *      lived PUT URL.
 *   3. Client fetches (PUT) directly to the presigned URL with the
 *      blob body.
 *   4. Public URL of the finished object comes back in the same
 *      response so the client / server can persist it in the proof
 *      record.
 */

export const runtime = 'nodejs'

const HASH_RE = /^[0-9a-f]{64}$/
const ALLOWED_MIMES = new Set<string>([
  'image/jpeg',
  'image/png',
  'video/mp4',
  'video/webm',
  'video/quicktime',
])

export async function POST(request: Request): Promise<NextResponse> {
  let body: { pathname?: string; contentType?: string }
  try {
    body = (await request.json()) as { pathname?: string; contentType?: string }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const pathname = String(body?.pathname ?? '')
  const contentType = String(body?.contentType ?? '').toLowerCase()

  const m = /^captures\/([0-9a-f]{64})\.(jpg|png|mp4|webm)$/.exec(pathname)
  if (!m) {
    return NextResponse.json(
      { error: `pathname must be captures/<hash>.(jpg|png|mp4|webm) — got ${pathname}` },
      { status: 400 },
    )
  }
  const hash = m[1]
  if (!HASH_RE.test(hash)) {
    return NextResponse.json({ error: 'hash segment must be 64-char lowercase hex' }, { status: 400 })
  }
  if (!ALLOWED_MIMES.has(contentType)) {
    return NextResponse.json(
      { error: `contentType must be one of ${Array.from(ALLOWED_MIMES).join(', ')}` },
      { status: 400 },
    )
  }

  try {
    const uploadUrl = await presignPutUrl(pathname, contentType, 300)
    const publicUrl = r2PublicUrl(pathname)
    return NextResponse.json({
      uploadUrl,
      publicUrl,
      pathname,
      contentType,
      // Kept for older clients — the SDK-side `upload()` used to
      // return a similar shape. Doesn't hurt to include.
      url: publicUrl,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
