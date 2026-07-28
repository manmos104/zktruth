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

  // Detect video by BOTH MIME type and filename extension — iOS Safari
  // sometimes strips the MIME on multipart-uploaded Blobs so we can't
  // rely on media.type alone.
  const mimeType = (media.type || '').toLowerCase()
  const filenameLower = (media.name || '').toLowerCase()
  const looksLikeVideoByMime = mimeType.startsWith('video/')
  const looksLikeVideoByName =
    filenameLower.endsWith('.mp4') ||
    filenameLower.endsWith('.webm') ||
    filenameLower.endsWith('.mov') ||
    filenameLower.endsWith('.m4v')
  const isVideo = looksLikeVideoByMime || looksLikeVideoByName

  // For videos we ALWAYS use sendDocument regardless of container:
  //  - sendVideo only guarantees inline playback for MP4 with H.264,
  //    and even MP4 uploads sometimes get rejected/silently dropped
  //    when the server can't infer the codec fast enough.
  //  - sendDocument accepts every container Telegram knows about and
  //    still renders a tappable inline preview + a thumbnail on
  //    modern clients, which is the outcome the user actually cares
  //    about ("the video shows up in the channel").
  // Photos stay on sendPhoto — Telegram never mishandles JPEG uploads.
  const useSendDocument = isVideo
  const method = useSendDocument ? 'sendDocument' : 'sendPhoto'
  const fileField = useSendDocument ? 'document' : 'photo'

  // Pick a sensible filename with the right extension so Telegram's
  // client detects the file type correctly — some clients decide the
  // preview UI purely from the extension.
  let uploadName = media.name
  if (!uploadName) {
    if (useSendDocument) {
      uploadName = mimeType.includes('mp4') ? 'capture.mp4' : 'capture.webm'
    } else uploadName = 'capture.jpg'
  }

  const tgForm = new FormData()
  tgForm.set('chat_id', CHANNEL_ID)
  tgForm.set(fileField, media, uploadName)
  tgForm.set('caption', buildCaption(meta))
  tgForm.set('parse_mode', 'HTML')
  if (useSendDocument) {
    // Let Telegram sniff the content type so it renders a native
    // video player for the file rather than a generic download card.
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
  const fileId = useSendDocument
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
