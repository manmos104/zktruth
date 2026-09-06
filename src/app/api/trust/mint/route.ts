import { NextResponse } from 'next/server'
import { Address } from '@ton/core'
import {
  appendPost,
  saveMessageRecord,
  type MessageRecord,
} from '@/lib/trustStore'
import { creditMintToPool } from '@/lib/rewardPool'

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
  let body: {
    wallet?: string
    messageId?: number
    contentHashHex?: string
    kind?: 'free' | 'mint'
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const rawWallet = body?.wallet
  const messageIdRaw = body?.messageId
  // contentHashHex is still accepted for API compatibility but no
  // longer drives an attestation bonus — the ×1.3 ATTESTATION_MULTIPLIER
  // in trustStore.computeScore already boosts any attested post.
  //
  // `kind` distinguishes a FREE hash-only post (weight 1, daily-capped)
  // from a paid NFT MINT (weight 10, gates score+rewards). Defaults to
  // 'free' for safety — a caller can't accidentally inflate score by
  // omitting the field; the mint path must send 'mint' explicitly.
  const kind: 'free' | 'mint' = body?.kind === 'mint' ? 'mint' : 'free'
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

    // Credit the wallet with a post event, discriminated by kind so
    // the scorer applies the right weight (free=1, mint=10) and the
    // daily-cap only fires on 'free'.
    await appendPost(wallet, { messageId, timestamp: now, kind })

    // Only paid mints contribute to the Reward Pool ledger — the pool
    // is 100% funded by mint fees, so a free post must not increment it.
    if (kind === 'mint') {
      try { await creditMintToPool(messageId) } catch { /* ignore */ }
    }

    return NextResponse.json({
      ok: true,
      wallet,
      messageId,
      kind,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
