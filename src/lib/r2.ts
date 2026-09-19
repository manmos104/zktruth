import { S3Client, PutObjectCommand, HeadObjectCommand, ListObjectsV2Command } from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

/**
 * Cloudflare R2 client.
 *
 * R2 speaks the S3 API, so we drive it with the AWS SDK. All 4 env
 * vars must be set:
 *
 *   R2_ACCOUNT_ID          — the 32-char Cloudflare account id
 *   R2_ACCESS_KEY_ID       — from Cloudflare → R2 → Manage R2 API Tokens
 *   R2_SECRET_ACCESS_KEY   — pair of the above
 *   R2_BUCKET_NAME         — bucket you created, e.g. "zktruth-captures"
 *
 * And one public-URL var so we don't have to sign every read:
 *
 *   R2_PUBLIC_URL          — either the public bucket URL
 *                            (https://pub-<id>.r2.dev) or, preferably,
 *                            a custom domain (https://media.zktruth.app)
 *
 * `region: 'auto'` is the R2 convention — R2 has one global region
 * and the SDK ignores the value.
 */

const R2_ACCOUNT_ID = process.env.R2_ACCOUNT_ID
const R2_ACCESS_KEY_ID = process.env.R2_ACCESS_KEY_ID
const R2_SECRET_ACCESS_KEY = process.env.R2_SECRET_ACCESS_KEY
export const R2_BUCKET = process.env.R2_BUCKET_NAME ?? ''
export const R2_PUBLIC_URL = (process.env.R2_PUBLIC_URL ?? '').replace(/\/$/, '')

let cachedClient: S3Client | null = null

export function getR2Client(): S3Client | null {
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) {
    return null
  }
  if (cachedClient) return cachedClient
  cachedClient = new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: R2_ACCESS_KEY_ID,
      secretAccessKey: R2_SECRET_ACCESS_KEY,
    },
    // Path-style URLs (`<account>.r2.cloudflarestorage.com/<bucket>/...`)
    // instead of virtual-hosted (`<bucket>.<account>...`). The virtual-
    // hosted subdomain frequently fails on iOS Safari inside the
    // Telegram Mini App WebView with a bare "Load failed" fetch error —
    // Cloudflare's wildcard cert or DNS handling on the sub-subdomain
    // isn't reliable there. Path-style hits a single well-known host
    // that always resolves cleanly.
    forcePathStyle: true,
    // R2 rejects the `x-amz-checksum-crc32` header that the AWS SDK
    // now sends by default (since v3.729). Without this the presigned
    // PUT URL bakes the checksum header into the signature and the
    // browser's PUT fails with 400/403 because the header isn't in
    // the actual request. `WHEN_REQUIRED` tells the SDK to only add
    // checksum bytes when the server explicitly asks for them.
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  })
  return cachedClient
}

export function r2PublicUrl(key: string): string {
  return `${R2_PUBLIC_URL}/${key.replace(/^\/+/, '')}`
}

/**
 * Presigned PUT URL for direct browser-to-R2 upload. Client does a
 * plain fetch(url, { method: 'PUT', body: blob }) — no bytes touch
 * Vercel Functions, which is what got us onto R2 in the first place
 * (Vercel Hobby caps request bodies at 4.5 MB and long videos blow
 * through that).
 */
export async function presignPutUrl(
  key: string,
  contentType: string,
  expiresInSeconds = 300,
): Promise<string> {
  const client = getR2Client()
  if (!client) throw new Error('R2 client not configured')
  const cmd = new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: key,
    ContentType: contentType,
  })
  // Aggressively strip the AWS SDK's flexible-checksum middleware.
  // The middleware injects `x-amz-checksum-crc32` (or similar)
  // headers into the presigned signature; R2 doesn't support those
  // headers, and even if it silently accepted them, the browser's
  // subsequent PUT wouldn't include the checksum bytes, so R2 would
  // return `SignatureDoesNotMatch`. Removing the middleware here
  // guarantees the signature only covers headers the browser will
  // actually send.
  try {
    cmd.middlewareStack.remove('flexibleChecksumsMiddleware')
  } catch { /* older SDKs don't have this middleware — fine */ }
  return getSignedUrl(client, cmd, {
    expiresIn: expiresInSeconds,
    // Belt-and-braces: whitelist the only headers we know the browser
    // will send. `host` is required, `content-type` matches what our
    // client-side fetch() sets. Any other header sneaking into the
    // signature would trigger a signature-mismatch failure.
    signableHeaders: new Set(['host', 'content-type']),
  })
}

/**
 * Existence check — returns the object's public URL when the key
 * exists in the bucket, null otherwise. Used by mediaResolver to
 * decide whether a hash has media stored yet.
 */
export async function r2HeadPublicUrl(key: string): Promise<string | null> {
  const client = getR2Client()
  if (!client) return null
  try {
    await client.send(new HeadObjectCommand({
      Bucket: R2_BUCKET,
      Key: key,
    }))
    return r2PublicUrl(key)
  } catch {
    return null
  }
}

/**
 * Listing fallback for non-canonical extensions (`.jpeg`, `.mov`,
 * `.m4v`, etc.) that we don't head() explicitly. Returns an array
 * of { key, url }.
 */
export async function r2List(prefix: string): Promise<Array<{ key: string; url: string }>> {
  const client = getR2Client()
  if (!client) return []
  try {
    const res = await client.send(new ListObjectsV2Command({
      Bucket: R2_BUCKET,
      Prefix: prefix,
      MaxKeys: 20,
    }))
    return (res.Contents ?? [])
      .map((o) => o.Key)
      .filter((k): k is string => !!k)
      .map((k) => ({ key: k, url: r2PublicUrl(k) }))
  } catch {
    return []
  }
}
