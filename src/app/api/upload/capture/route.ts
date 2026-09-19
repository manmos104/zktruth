import { NextResponse } from 'next/server'
import { PutObjectCommand } from '@aws-sdk/client-s3'
import { getR2Client, r2HeadPublicUrl, r2PublicUrl, R2_BUCKET } from '@/lib/r2'

/**
 * Server-side capture upload — writes the file to Cloudflare R2 at
 * `captures/<sha256-hex>.<ext>` and returns the deterministic public
 * URL. Used as a fallback when the client-side presigned-PUT path
 * fails (rare); most uploads go straight to R2 from the browser via
 * `/api/upload/token`.
 *
 * Migrated off Vercel Blob after the free-tier caps blew out — see
 * `/api/upload/token/route.ts` for the client-side path.
 *
 * Request body: multipart/form-data with fields
 *   file  — the image blob (jpg/png; ~2-5 MB expected)
 *   hash  — lowercase 64-char hex SHA-256 of the file (used as key)
 *
 * Response: { url: string, hash: string, cached?: true }
 */
export const runtime = 'nodejs'
export const maxDuration = 30

const HASH_RE = /^[0-9a-f]{64}$/

export async function POST(request: Request) {
  const client = getR2Client()
  if (!client) {
    return NextResponse.json(
      { error: 'R2 not configured (missing R2_ACCOUNT_ID / KEY / BUCKET envs)' },
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

  // Content-addressed storage: same hash → same bytes, so if the key
  // already exists we're done.
  const existing = await r2HeadPublicUrl(key)
  if (existing) {
    return NextResponse.json({ url: existing, hash, cached: true })
  }

  try {
    const buf = Buffer.from(await file.arrayBuffer())
    await client.send(new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
      Body: buf,
      ContentType: file.type || 'image/jpeg',
    }))
    return NextResponse.json({ url: r2PublicUrl(key), hash })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
