import { NextResponse } from 'next/server'
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client'

/**
 * Signs client-side upload tokens for `@vercel/blob/client`.
 *
 * Why bypass our own upload proxy? Vercel Functions on the Hobby plan
 * cap request bodies at 4.5 MB, which is fine for JPEG captures but
 * blows up on 20–50 MB video files. The client-uploads flow uploads
 * straight from the browser to the Blob store using a short-lived
 * signed token this endpoint issues — no bytes ever cross a Vercel
 * Function.
 *
 * The flow is:
 *   1. client calls upload(...) from '@vercel/blob/client'
 *   2. SDK POSTs a `blob.generate-client-token` body to this route
 *   3. we call handleUpload() which validates + signs a token
 *   4. SDK PUTs the blob directly to
 *      `<store>.public.blob.vercel-storage.com/...`
 *
 * We keep the same deterministic keying as the server-upload endpoint:
 * `captures/<sha256-hex>.<ext>`. The Blob store is public so the
 * resolved URL is fetchable by any wallet or marketplace without auth.
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
  const body = (await request.json()) as HandleUploadBody

  try {
    const json = await handleUpload({
      body,
      request,
      onBeforeGenerateToken: async (pathname /* clientPayload */) => {
        // Enforce our deterministic key shape so a malicious client
        // can't scatter arbitrary blobs across the store.
        const m = /^captures\/([0-9a-f]{64})\.(jpg|png|mp4|webm)$/.exec(pathname)
        if (!m) {
          throw new Error(`pathname must be captures/<hash>.(jpg|png|mp4|webm) — got ${pathname}`)
        }
        const hash = m[1]
        if (!HASH_RE.test(hash)) {
          throw new Error('hash segment must be 64-char lowercase hex')
        }
        return {
          allowedContentTypes: Array.from(ALLOWED_MIMES),
          // Cap uploads at 60 MB — plenty of headroom for a 60s
          // 6 Mbps video (~45 MB) while still stopping abuse.
          maximumSizeInBytes: 60 * 1024 * 1024,
          addRandomSuffix: false,
          allowOverwrite: true,
        }
      },
      onUploadCompleted: async () => {
        // No-op: the metadata endpoint pulls the URL fresh via head()
        // on every request, so we don't need to persist anything here.
      },
    })
    return NextResponse.json(json)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 400 })
  }
}
