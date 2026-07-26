import { NextRequest, NextResponse } from 'next/server'

/**
 * POST /api/telegram/post
 *
 * Forwards a captured photo or video to the public zkTruth Telegram
 * channel using the Bot API. This is how a capture becomes shareable:
 * the media lives on Telegram's CDN (zero storage cost to us), and the
 * post URL we hand back is the canonical "proof" link — no separate
 * /proof/[hash] viewer needed for the MVP.
 *
 * Required env vars (set in Vercel dashboard):
 *   TELEGRAM_BOT_TOKEN   – secret token from @BotFather
 *   TELEGRAM_CHANNEL_ID  – channel username with '@' or numeric id
 *                          (defaults to '@zktruth_capture')
 *
 * Request: multipart/form-data
 *   media        – Blob (image/* or video/*)
 *   metadata     – JSON string { hash?, timestamp?, gps?, wallet? }
 *
 * Response: { ok, message_id, file_id, post_url }
 */

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN
const CHANNEL_ID = process.env.TELEGRAM_CHANNEL_ID || '@zktruth_capture'

interface CaptureMetadata {
  hash?: string
  timestamp?: string
  gps?: string
  wallet?: string
  comment?: string
}

interface TelegramSendResponse {
  ok: boolean
  description?: string
  result?: {
    message_id: number
    photo?: Array<{ file_id: string; width: number; height: number }>
    video?: { file_id: string }
  }
}

function short(h?: string): string {
  if (!h) return ''
  const clean = h.replace(/^0x/, '')
  return `0x${clean.slice(0, 8)}…${clean.slice(-6)}`
}

function buildCaption(meta: CaptureMetadata): string {
  const lines: string[] = ['✓ <b>Verified Proof of Capture</b>', '']
  if (meta.hash) {
    lines.push(`<b>Hash</b> · <code>${short(meta.hash)}</code>`)
  }
  if (meta.timestamp) {
    // If it looks like an ISO string, strip subseconds and "T"
    const t = meta.timestamp
      .replace('T', ' ')
      .replace(/\.\d+/, '')
      .replace('Z', ' UTC')
    lines.push(`<b>Time</b> · ${t}`)
  }
  if (meta.gps) {
    lines.push(`<b>Location</b> · ${meta.gps}`)
  }
  if (meta.wallet) {
    lines.push(`<b>Wallet</b> · <code>${short(meta.wallet)}</code>`)
  }
  if (meta.comment && meta.comment.trim()) {
    lines.push('', `<i>${meta.comment.trim()}</i>`)
  }
  lines.push('')
  lines.push(
    'Captured with <a href="https://zktruth.vercel.app">zkTruth</a> · Proof of Capture on TON.',
  )
  return lines.join('\n')
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  if (!BOT_TOKEN) {
    return NextResponse.json(
      { ok: false, error: 'TELEGRAM_BOT_TOKEN env var not configured' },
      { status: 500 },
    )
  }

  let form: FormData
  try {
    form = await req.formData()
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: `invalid form data: ${(e as Error).message}` },
      { status: 400 },
    )
  }

  const media = form.get('media') as File | null
  const metaRaw = form.get('metadata') as string | null
  if (!media) {
    return NextResponse.json(
      { ok: false, error: 'media field is required' },
      { status: 400 },
    )
  }

  let meta: CaptureMetadata = {}
  if (metaRaw) {
    try {
      meta = JSON.parse(metaRaw)
    } catch {
      // Non-fatal — post with empty metadata rather than fail.
    }
  }

  const isVideo = (media.type || '').startsWith('video/')
  // Telegram's sendVideo endpoint tops out at 50 MB via direct upload;
  // sendPhoto at 10 MB. Anything larger would need chunked upload
  // (documents) which we don't handle yet.
  const method = isVideo ? 'sendVideo' : 'sendPhoto'
  const fileField = isVideo ? 'video' : 'photo'

  const tgForm = new FormData()
  tgForm.set('chat_id', CHANNEL_ID)
  tgForm.set(fileField, media, media.name || (isVideo ? 'capture.mp4' : 'capture.jpg'))
  tgForm.set('caption', buildCaption(meta))
  tgForm.set('parse_mode', 'HTML')
  // Enable the built-in Telegram "protect content" toggle? Left off
  // deliberately so viewers can forward the proof onwards.

  let tgRes: Response
  try {
    tgRes = await fetch(
      `https://api.telegram.org/bot${BOT_TOKEN}/${method}`,
      { method: 'POST', body: tgForm },
    )
  } catch (e) {
    return NextResponse.json(
      { ok: false, error: `telegram request failed: ${(e as Error).message}` },
      { status: 502 },
    )
  }

  const tgData = (await tgRes.json().catch(() => null)) as TelegramSendResponse | null
  if (!tgRes.ok || !tgData?.ok || !tgData.result) {
    return NextResponse.json(
      {
        ok: false,
        error: 'telegram rejected the post',
        detail: tgData?.description ?? `HTTP ${tgRes.status}`,
      },
      { status: 502 },
    )
  }

  const messageId = tgData.result.message_id
  // For photos, Telegram returns an array of increasingly-large sizes —
  // pick the largest one so downstream consumers get the full-res
  // file_id.
  const fileId = isVideo
    ? tgData.result.video?.file_id
    : tgData.result.photo?.[tgData.result.photo.length - 1]?.file_id

  const channelPath = CHANNEL_ID.startsWith('@')
    ? CHANNEL_ID.slice(1)
    : CHANNEL_ID
  const postUrl = `https://t.me/${channelPath}/${messageId}`

  return NextResponse.json({
    ok: true,
    message_id: messageId,
    file_id: fileId,
    post_url: postUrl,
  })
}
