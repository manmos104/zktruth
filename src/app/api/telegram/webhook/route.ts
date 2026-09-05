import { NextResponse } from 'next/server'
import {
  appendReaction,
  appendShare,
  getMessageRecord,
  getRedis,
  type ReactionEvent,
  type ShareEvent,
} from '@/lib/trustStore'

/**
 * Telegram Bot webhook — feeds reaction/share signal into the Trust
 * Score store.
 *
 * BotFather webhook registration (one-time, user does this):
 *   1. Send `/setwebhook` (or use setWebhook API) with URL:
 *      https://zktruth.vercel.app/api/telegram/webhook?secret=<TELEGRAM_WEBHOOK_SECRET>
 *   2. Pass `allowed_updates=["message_reaction","message_reaction_count"]`
 *      so Telegram forwards reaction events (Bot API 7.0+).
 *   3. Bot must already be an admin of the channel (already done in
 *      Phase 0-b) so it can observe reactions on channel posts.
 *
 * Auth model
 * ----------
 * Telegram signs updates via its `secret_token` header (set at
 * setWebhook time). We accept EITHER:
 *   - `X-Telegram-Bot-Api-Secret-Token` header matching env
 *     TELEGRAM_WEBHOOK_SECRET
 *   - `?secret=` query param matching the same env (fallback for
 *     platforms that strip custom headers)
 *
 * How the signal maps to score
 * ----------------------------
 *   message_reaction_count: reflects TOTAL reactions per emoji on
 *   a channel post. We diff against the last-seen signature so
 *   removing a reaction properly subtracts score. A 🔄 (repost)
 *   reaction is treated as a share (weight × 1); everything else
 *   is a reaction (weight × 1).
 */

export const runtime = 'nodejs'

interface ReactionCountEntry {
  type: { type: string; emoji?: string; custom_emoji_id?: string }
  total_count: number
}

interface MessageReactionCountUpdate {
  chat: { id: number; username?: string }
  message_id: number
  date: number
  reactions?: ReactionCountEntry[]
}

interface TelegramUpdate {
  update_id: number
  message_reaction_count?: MessageReactionCountUpdate
  // message_reaction (individual) — we don't need it because
  // message_reaction_count already gives us the running totals.
}

// Emoji that we treat as "signal boost" (counts as share, not reaction).
const REPOST_EMOJIS = new Set(['🔄', '📢', '⚡', '🚀'])

function emojiKey(e: ReactionCountEntry): string {
  if (e.type.type === 'emoji' && e.type.emoji) return e.type.emoji
  if (e.type.type === 'custom_emoji' && e.type.custom_emoji_id)
    return `custom:${e.type.custom_emoji_id}`
  return `unknown:${e.type.type}`
}

export async function POST(request: Request) {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (secret) {
    const hdr = request.headers.get('x-telegram-bot-api-secret-token')
    const url = new URL(request.url)
    const qs = url.searchParams.get('secret')
    if (hdr !== secret && qs !== secret) {
      // Silent 200 so a probe can't distinguish "wrong secret" from
      // "endpoint doesn't exist" — same shape a real success returns.
      return NextResponse.json({ ok: true })
    }
  }

  let update: TelegramUpdate
  let rawBody = ''
  try {
    rawBody = await request.text()
    update = JSON.parse(rawBody) as TelegramUpdate
  } catch {
    return NextResponse.json({ ok: true }) // acknowledge to avoid retries
  }

  // Diagnostic counter so we can verify Telegram actually posts events
  // to us. Bumped on every invocation, plus the LAST payload is kept
  // so /api/telegram/webhook-stats can dump it for debugging.
  try {
    const r = getRedis()
    await r.incr('webhook:hits:total')
    const kind = update.message_reaction_count
      ? 'message_reaction_count'
      : 'other'
    await r.incr(`webhook:hits:${kind}`)
    await r.set('webhook:last', {
      at: Date.now(),
      kind,
      body: rawBody.slice(0, 4000),
    })
  } catch { /* diagnostics never block the handler */ }

  const evt = update.message_reaction_count
  if (!evt) return NextResponse.json({ ok: true })

  try {
    const rec = await getMessageRecord(evt.message_id)
    if (!rec) return NextResponse.json({ ok: true, note: 'unknown message' })

    // Diff current totals vs last-seen signature.
    const currentMap: Record<string, number> = {}
    for (const e of evt.reactions ?? []) {
      currentMap[emojiKey(e)] = e.total_count
    }
    let prevMap: Record<string, number> = {}
    if (rec.lastReactionSignature) {
      try { prevMap = JSON.parse(rec.lastReactionSignature) } catch { /* ignore */ }
    }

    const now = Date.now()
    const allKeys = new Set([...Object.keys(currentMap), ...Object.keys(prevMap)])
    for (const k of allKeys) {
      const delta = (currentMap[k] ?? 0) - (prevMap[k] ?? 0)
      if (delta === 0) continue
      if (REPOST_EMOJIS.has(k)) {
        const ev: ShareEvent = {
          messageId: evt.message_id,
          source: 'repost',
          weight: delta, // signed — remove pulls score back
          timestamp: now,
        }
        await appendShare(rec.wallet, ev)
      } else {
        const ev: ReactionEvent = {
          messageId: evt.message_id,
          emoji: k,
          delta,
          timestamp: now,
        }
        await appendReaction(rec.wallet, ev)
      }
    }

    // Persist new signature so the next update diffs against it.
    const { saveMessageRecord } = await import('@/lib/trustStore')
    await saveMessageRecord({
      ...rec,
      lastReactionSignature: JSON.stringify(currentMap),
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ ok: true, error: msg }, { status: 200 })
  }
}
