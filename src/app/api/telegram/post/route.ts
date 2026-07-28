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
    document?: { file_id: string }
    animation?: { file_id: string }
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
  // sendVideo silently rejects (or attaches without inline playback)
  // anything that isn't MP4 — Telegram Bot API only guarantees inline
  // video preview for `video/mp4`. Our captures come off iOS Safari's
  // MediaRecorder as `video/webm;codecs=vp9,opus` in most cases,
  // which sendVideo will refuse. Route webm and other non-MP4 videos
  // through sendDocument, which produces a playable inline preview
  // in Telegram (an inline "attached file" card) and works for any
  // container. sendPhoto stays as-is because iOS gives us JPEG.
  const mimeType = (media.type || '').toLowerCase()
  const isMp4Video = isVideo && (mimeType.includes('mp4') || mimeType.includes('quicktime'))
  const useSendVideo = isMp4Video
  const useSendDocument = isVideo && !isMp4Video
  const method = useSendVideo ? 'sendVideo' : useSendDocument ? 'sendDocument' : 'sendPhoto'
  const fileField = useSendVideo ? 'video' : useSendDocument ? 'document' : 'photo'

  // Pick a sensible filename with the right extension so Telegram's
  // client detects and previews the file correctly. Some Telegram
  // clients decide the preview UI purely from the extension.
  let uploadName = media.name
  if (!uploadName) {
    if (useSendVideo) uploadName = 'capture.mp4'
    else if (useSendDocument) {
      uploadName = mimeType.includes('webm') ? 'capture.webm' : 'capture.mov'
    } else uploadName = 'capture.jpg'
  }

  const tgForm = new FormData()
  tgForm.set('chat_id', CHANNEL_ID)
  tgForm.set(fileField, media, uploadName)
  tgForm.set('caption', buildCaption(meta))
  tgForm.set('parse_mode', 'HTML')
  if (useSendVideo) {
    // Ask Telegram to enable streaming playback + generate a preview
    // thumbnail. Cheap to include and makes MP4 videos render inline.
    tgForm.set('supports_streaming', 'true')
  }
  if (useSendDocument) {
    // Documents can be posted with a hidden filename display so the
    // caption + inline preview stay clean. Telegram will still render
    // an in-line video player for the .webm document on most clients.
    tgForm.set('disable_content_type_detection', 'false')
  }

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
        used_method: method,
        mime: mimeType,
      },
      { status: 502 },
    )
  }

  const messageId = tgData.result.message_id
  // Pull the file_id from whichever field Telegram populated for the
  // method we used. Photos come back as an array of sizes (pick the
  // largest); videos and documents each have a single file_id.
  const fileId = useSendVideo
    ? tgData.result.video?.file_id
    : useSendDocument
      ? tgData.result.document?.file_id
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
