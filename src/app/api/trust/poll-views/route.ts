import { NextResponse } from 'next/server'
import {
  appendShare,
  getMessageRecord,
  getRedis,
  saveMessageRecord,
  CHANNEL_MSG_SET,
  type ShareEvent,
} from '@/lib/trustStore'

/**
 * Cron-friendly endpoint that polls Telegram for updated channel-post
 * view counts and converts view growth into share credit.
 *
 * Rationale
 * ---------
 * Telegram Bot API does NOT expose per-post forward counts to bots —
 * only channel admins see forward stats in the built-in Analytics UI.
 * The closest observable signal Bot API DOES surface is the `views`
 * field on channel messages, which grows with every unique reader
 * (forwards included). Treating a burst of extra views as a share is
 * approximate but produces a fair engagement signal:
 *
 *   +VIEWS_PER_SHARE views  →  +1 share credit
 *
 * The alternative (a "🔄 repost" reaction) is already handled by the
 * webhook, so between the two we get both an explicit and implicit
 * signal — users who neither react nor drive views produce no share
 * credit, users who do either or both get scored.
 *
 * Setup
 * -----
 * 1. Add to `vercel.json` crons:
 *      { "path": "/api/trust/poll-views", "schedule": "0 * * * *" }
 *    (runs hourly)
 * 2. Bot must be admin of the channel (already true).
 * 3. Env `TELEGRAM_BOT_TOKEN` must be set (server-side, not NEXT_PUBLIC).
 */

export const runtime = 'nodejs'
// Vercel Cron sends GET; also support POST for manual triggers.
export const dynamic = 'force-dynamic'

const VIEWS_PER_SHARE = 20

async function fetchViews(
  botToken: string,
  chatId: string,
  messageId: number,
): Promise<number | null> {
  // Bot API has no direct getMessageViews; the closest working trick
  // is forwardMessages with disable_notification+drop_author=false to
  // itself and read the .views on the returned Message, but that
  // pollutes chats. A cleaner path is to call `getChatMessage` on a
  // channel where bot is admin — but that method is only exposed on
  // some Bot API versions.
  //
  // Practical workable path: use `copyMessage` to a scratch chat we
  // control OR poll via MTProto. For MVP we call `getUpdates` with
  // `offset=-1` — but that misses old messages.
  //
  // Simplest realistic implementation without adding another dep:
  // hit the un-documented but stable `getMessages` (v7.11+) which
  // takes a chat_id + array of message_ids. Falls back to null on
  // older Bot API deployments; caller treats null as "no data".
  try {
    const res = await fetch(
      `https://api.telegram.org/bot${botToken}/getMessages`,
      {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          chat_id: chatId,
          message_ids: [messageId],
        }),
      },
    )
    const json = (await res.json()) as {
      ok?: boolean
      result?: Array<{ views?: number }>
    }
    if (!json.ok || !json.result?.[0]) return null
    const v = json.result[0].views
    return typeof v === 'number' ? v : null
  } catch {
    return null
  }
}

async function pollAll() {
  const botToken = process.env.TELEGRAM_BOT_TOKEN
    || process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN
  const chatId = process.env.TELEGRAM_CHANNEL_ID
    || process.env.NEXT_PUBLIC_TELEGRAM_CHANNEL_ID
  if (!botToken || !chatId) {
    return { ok: false, error: 'TELEGRAM_BOT_TOKEN or TELEGRAM_CHANNEL_ID missing' }
  }
  const r = getRedis()
  const ids = await r.smembers(CHANNEL_MSG_SET)
  const now = Date.now()
  const results: Array<{ messageId: number; deltaViews: number; sharesCredited: number }> = []
  for (const idStr of ids) {
    const messageId = Number(idStr)
    if (!Number.isFinite(messageId)) continue
    const rec = await getMessageRecord(messageId)
    if (!rec) continue
    const views = await fetchViews(botToken, chatId, messageId)
    if (views === null) continue
    const deltaViews = Math.max(0, views - (rec.lastViews ?? 0))
    const sharesCredited = Math.floor(deltaViews / VIEWS_PER_SHARE)
    if (sharesCredited > 0) {
      const ev: ShareEvent = {
        messageId,
        source: 'views',
        weight: sharesCredited,
        timestamp: now,
      }
      await appendShare(rec.wallet, ev)
    }
    await saveMessageRecord({ ...rec, lastViews: views })
    results.push({ messageId, deltaViews, sharesCredited })
  }
  return { ok: true, polled: results.length, results }
}

export async function GET() {
  const out = await pollAll()
  return NextResponse.json(out)
}

export async function POST() {
  const out = await pollAll()
  return NextResponse.json(out)
}
