import { NextResponse } from 'next/server'
import { head, put } from '@vercel/blob'

/**
 * Upload a captured photo to Vercel Blob under a deterministic key
 * (`captures/<sha256-hex>.jpg`) so the NFT metadata endpoint can
 * construct the public URL from the same hash without a KV lookup.
 *
 * Called by the frontend right before it fires the TON mint tx. If this
 * fails the frontend aborts the mint — a Proof NFT with no image is
 * worse than no NFT at all.
 *
 * Request body: multipart/form-data with fields
 *   file  — the image blob (jpg/png; ~2-5 MB expected)
 *   hash  — lowercase 64-char hex SHA-256 of the file (used as key)
 *
 * Response: { url: string, hash: string }
 *
 * Auth: none. Deterministic key + allowOverwrite means a malicious
 * caller could replace someone else's NFT image by knowing the hash.
 * SHA-256 preimage resistance makes this hard in practice (you'd need
 * to know the original photo), and the NFT itself lives on-chain — so
 * worst case is cosmetic. We can layer TON Connect signature check in
 * later if this becomes an issue.
 */
export const runtime = 'nodejs'
// The Blob SDK does its own body handling; disable Next's default
// bodyParser cap so 5 MB captures don't get rejected.
export const maxDuration = 30

const HASH_RE = /^[0-9a-f]{64}$/

export async function POST(request: Request) {
  const token = process.env.BLOB_READ_WRITE_TOKEN
  if (!token) {
    return NextResponse.json(
      { error: 'BLOB_READ_WRITE_TOKEN not configured' },
      { status: 500 },
    )
  }

  let form: FormData
  try {
    form = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Bad multipart body' }, { status: 400 })
  }

  const file = form.get('file')
  const hashRaw = form.get('hash')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Missing file field' }, { status: 400 })
  }
  if (typeof hashRaw !== 'string' || !HASH_RE.test(hashRaw.toLowerCase())) {
    return NextResponse.json(
      { error: 'hash must be 64-char lowercase hex' },
      { status: 400 },
    )
  }
  const hash = hashRaw.toLowerCase()

  // Pick an extension the wallets / marketplaces will sniff correctly.
  // Order matters: check the most-specific mime types first (video vs
  // image), then fall back to jpg for the common photo path.
  const mime = (file.type || '').toLowerCase()
  const ext =
    mime === 'image/png'
      ? 'png'
      : mime.startsWith('video/mp4') || mime === 'video/quicktime'
        ? 'mp4'
        : mime.startsWith('video/webm')
          ? 'webm'
          : mime.startsWith('video/')
            ? 'mp4'
            : 'jpg'
  const key = `captures/${hash}.${ext}`

  // Content-addressed storage: the same hash always maps to the same
  // bytes, so if the key already exists we're done — no re-upload
  // needed. This also sidesteps the fact that older @vercel/blob
  // versions don't accept `allowOverwrite: true`, which would otherwise
  // make put() throw on a duplicate key.
  try {
    const existing = await head(key, { token })
    if (existing?.url) {
      return NextResponse.json({ url: existing.url, hash, cached: true })
    }
  } catch {
    // head() throws on 404; that just means we haven't uploaded yet.
  }

  try {
    const { url } = await put(key, file, {
      access: 'public',
      addRandomSuffix: false,
      contentType: file.type || 'image/jpeg',
      token,
    })
    return NextResponse.json({ url, hash })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
