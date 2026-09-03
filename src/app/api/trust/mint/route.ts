import { NextResponse } from 'next/server'
import { Address } from '@ton/core'
import {
  appendPost,
  appendShare,
  getRedis,
  saveMessageRecord,
  type MessageRecord,
  type ShareEvent,
} from '@/lib/trustStore'

/**
 * Record a successful zkTruth mint against the author's wallet.
 *
 * Called by the Mini App right after `tonConnectUI.sendTransaction`
 * returns without throwing. The mint tx is already on the mempool by
 * then, so we can safely credit the wallet with a post even before
 * TON's ~10s confirmation window closes.
 *
 * Request body: { wallet, messageId }
 *   wallet:    TON address in raw (0:hex) or friendly (UQ…) form
 *   messageId: numeric Telegram channel post id (from the earlier
 *              /api/telegram/post caption preview)
 *
 * Auth: none. Score inflation via spam POSTs is bounded because
 * mint requires 0.15 TON and messageId must correspond to an actual
 * channel post — future work: verify against Telegram's getMessages
 * before crediting. For MVP the on-chain gas cost is a natural
 * anti-spam signal.
 */
export const runtime = 'nodejs'

function normaliseWallet(input: string): string {
  try {
    return Address.parse(input).toString({
      urlSafe: true,
      bounceable: false,
      testOnly: false,
    })
  } catch {
    return input
  }
}

export async function POST(request: Request) {
  let body: { wallet?: string; messageId?: number }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const rawWallet = body?.wallet
  const messageIdRaw = body?.messageId
  const contentHashHex: string | undefined =
    typeof body?.contentHashHex === 'string' ? body.contentHashHex.toLowerCase() : undefined
  if (!rawWallet || typeof rawWallet !== 'string') {
    return NextResponse.json({ error: 'wallet is required' }, { status: 400 })
  }
  const wallet = normaliseWallet(rawWallet)
  const now = Date.now()
  // messageId is OPTIONAL: users can mint without a Telegram post (e.g.
  // if they'll share later). A post still counts toward Trust; we just
  // skip the message→wallet mapping when the id is missing.
  const messageId =
    typeof messageIdRaw === 'number' && Number.isFinite(messageIdRaw) && messageIdRaw > 0
      ? messageIdRaw
      : 0

  try {
    if (messageId > 0) {
      const msgRec: MessageRecord = {
        messageId,
        wallet,
        postedAt: now,
        lastViews: 0,
        lastReactionSignature: '',
      }
      await saveMessageRecord(msgRec)
    }

    // Credit the wallet with a post event either way.
    await appendPost(wallet, { messageId, timestamp: now })

    // Attestation bonus / penalty — read the claim record produced by
    // /api/attest/claim (indexed by content hash) and adjust the
    // wallet's Trust Score accordingly:
    //   - +3 bonus shares if Telegram-verified + low anomaly
    //   - -2 penalty shares if high anomaly (heuristic spoof signal)
    // We record this as a `ShareEvent` so the same decay + weight math
    // applies without introducing a new event type.
    let attestBonus = 0
    let attestReason: string | undefined
    if (contentHashHex) {
      try {
        const r = getRedis()
        const rec = await r.get<{
          telegramVerified?: boolean
          anomaly?: { severity?: number }
        }>(`claim:${contentHashHex}`)
        if (rec) {
          const sev = rec.anomaly?.severity ?? 0
          if (rec.telegramVerified && sev < 20) {
            attestBonus = 3
            attestReason = 'attested_low_anomaly'
          } else if (sev >= 60) {
            attestBonus = -2
            attestReason = `high_anomaly_${sev}`
          }
          if (attestBonus !== 0) {
            const ev: ShareEvent = {
              messageId,
              source: 'repost',
              weight: attestBonus,
              timestamp: now,
            }
            await appendShare(wallet, ev)
          }
        }
      } catch { /* attestation bonus is best-effort */ }
    }

    return NextResponse.json({
      ok: true,
      wallet,
      messageId,
      attestBonus,
      attestReason: attestReason ?? null,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
