import { NextResponse } from 'next/server'

/**
 * POST /api/telegram/pin-welcome?secret=<ADMIN_SECRET>
 *
 * One-shot operator endpoint that (1) posts the channel welcome
 * message via the bot and (2) pins it so first-time visitors always
 * see it at the top when they open the channel.
 *
 * Telegram channels don't broadcast join events to bots, so there's
 * no way to auto-DM every new follower with a welcome. The pinned
 * message is the only surface that reliably greets a first-time
 * visitor. This endpoint exists so we can update the pinned
 * welcome (or restore it after a bot glitch) without SSHing anywhere.
 *
 * Auth
 * ----
 * Requires `?secret=<TELEGRAM_ADMIN_SECRET>` on the query string. The
 * secret is separate from TELEGRAM_WEBHOOK_SECRET so a compromise of
 * the webhook one doesn't hand out operator writes.
 *
 * Environment
 * -----------
 *   TELEGRAM_BOT_TOKEN      — bot token (server-side; not NEXT_PUBLIC)
 *   TELEGRAM_CHANNEL_ID     — @handle or numeric id of the channel
 *   TELEGRAM_ADMIN_SECRET   — shared secret required on the query
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const WELCOME_TEXT = `✓ Welcome to the zkTruth Channel

📡 About this channel
Every post you'll see here is a Proof of Capture minted through the zkTruth Mini App. Each photo/video is stamped with its SHA-256 hash, timestamp, GPS coordinates, and author wallet — then anchored on the TON blockchain as a TEP-62 NFT.

🤖 Capture your own proof
👉 https://t.me/zktruth_bot
Launch the Mini App → shoot → auto-post → mint. The whole flow takes about 30 seconds.

💎 Earn from your captures
Every mint (0.15 TON) sends 85% into a weekly Reward Pool that pays out to the Top 100 authors every Monday.

Trust Score earns you your rank:
- NFT mint      → +10
- Reaction      → +5
- Free post     → +1  (daily cap 5)

Mint at least once to unlock scoring & payouts — reactions on your posts accrue retroactively when you do.
Tiers: Source → Whistleblower → Muckraker → Investigative Reporter → Truth-Teller.

⛓ Under the hood
- TON blockchain (mainnet)
- TEP-62 NFT standard
- Tact smart contract
- Vercel Blob for content-addressed media storage

🔗 Links
- Web:      https://zktruth.vercel.app
- Contract: https://tonviewer.com/EQBHzSXx-b8tXjka-TfBeEomFpzxGJujIIeUgFzEohvfjMU_

Only the bot can post here. Every entry is verifiable — click any NFT link to trace it back to its on-chain proof.`

async function tg<T = unknown>(
  botToken: string,
  method: string,
  body: Record<string, unknown>,
): Promise<T> {
  const res = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (!json.ok) {
    throw new Error(`Telegram ${method} failed: ${JSON.stringify(json)}`)
  }
  return json.result as T
}

async function pinWelcome() {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
    || process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHANNEL_ID
    || process.env.NEXT_PUBLIC_TELEGRAM_CHANNEL_ID
  if (!botToken || !chatId) {
    return NextResponse.json({
      error: 'TELEGRAM_BOT_TOKEN and TELEGRAM_CHANNEL_ID must be set',
    }, { status: 500 })
  }

  try {
    // 1) Post the welcome message. Disable link previews so the URLs
    //    listed inside don't turn into big preview cards that push the
    //    actual instructions off-screen on mobile.
    const posted = await tg<{ message_id: number }>(botToken, 'sendMessage', {
      chat_id: chatId,
      text: WELCOME_TEXT,
      disable_web_page_preview: true,
      disable_notification: false, // subscribers get one notification
    })

    // 2) Pin it. Telegram lets a channel have only one pinned message
    //    at a time; pinning this one auto-replaces any previous pin.
    await tg(botToken, 'pinChatMessage', {
      chat_id: chatId,
      message_id: posted.message_id,
      disable_notification: true, // don't ping subscribers again
    })

    return NextResponse.json({
      ok: true,
      messageId: posted.message_id,
      note: 'Welcome posted and pinned. First-time visitors will see it at the top of the channel.',
    })
  } catch (err) {
    return NextResponse.json({
      error: err instanceof Error ? err.message : String(err),
    }, { status: 500 })
  }
}

async function checkSecret(request: Request) {
  const url = new URL(request.url)
  const provided = url.searchParams.get('secret')
  const expected = process.env.TELEGRAM_ADMIN_SECRET
  if (!expected) return { ok: false, msg: 'TELEGRAM_ADMIN_SECRET env not configured' }
  if (provided !== expected) return { ok: false, msg: 'invalid secret' }
  return { ok: true }
}

export async function POST(request: Request) {
  const auth = await checkSecret(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.msg }, { status: 401 })
  }
  return pinWelcome()
}

// GET support so operator can trigger this from a browser tab. Same
// auth check — the secret must still be in the query string.
export async function GET(request: Request) {
  const auth = await checkSecret(request)
  if (!auth.ok) {
    return NextResponse.json({ error: auth.msg }, { status: 401 })
  }
  return pinWelcome()
}
