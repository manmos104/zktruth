import { NextResponse } from 'next/server'
import { Address } from '@ton/core'
import {
  appendPost,
  saveMessageRecord,
  type MessageRecord,
} from '@/lib/trustStore'
import { creditMintToPool } from '@/lib/rewardPool'
import { saveProof, type ProofRecord } from '@/lib/proofStore'

const ZKTRUTH_COLLECTION = 'EQBHzSXx-b8tXjka-TfBeEomFpzxGJujIIeUgFzEohvfjMU_'
const TELEGRAM_CHANNEL_URL_BASE =
  process.env.NEXT_PUBLIC_TELEGRAM_CHANNEL_URL_BASE
  ?? 'https://t.me/zktruth_channel'

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
    // ---- Phase 5 additions --------------------------------------
    // Only relevant when kind === 'mint'. Free posts don't have an
    // on-chain anchor to point at from /proof/<hash>.
    captureTimestampSec?: number
    gpsHashDec?: string
    mediaUrl?: string
    posterUrl?: string
  }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const rawWallet = body?.wallet
  const messageIdRaw = body?.messageId
  const contentHashHex = typeof body?.contentHashHex === 'string'
    ? body.contentHashHex.toLowerCase()
    : ''
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

      // Phase 5 — persist the proof record so /proof/<hash> can look
      // it up server-side and cross-check against the on-chain Item.
      // Free posts skip this on purpose: they don't create an NFT,
      // so there's nothing to anchor for verification.
      if (/^[0-9a-f]{64}$/.test(contentHashHex)) {
        const captureTs =
          typeof body?.captureTimestampSec === 'number'
          && Number.isFinite(body.captureTimestampSec)
          && body.captureTimestampSec > 0
            ? Math.floor(body.captureTimestampSec)
            : Math.floor(now / 1000)
        const rec: ProofRecord = {
          contentHashHex,
          wallet,
          captureTimestampSec: captureTs,
          telegramMessageId: messageId,
          telegramPostUrl: messageId > 0
            ? `${TELEGRAM_CHANNEL_URL_BASE.replace(/\/$/, '')}/${messageId}`
            : undefined,
          mediaUrl: typeof body?.mediaUrl === 'string' ? body.mediaUrl : undefined,
          posterUrl: typeof body?.posterUrl === 'string' ? body.posterUrl : undefined,
          gpsHashDec: typeof body?.gpsHashDec === 'string' ? body.gpsHashDec : undefined,
          mintedAt: now,
          chain: 'ton-mainnet',
          collection: ZKTRUTH_COLLECTION,
        }
        try { await saveProof(rec) } catch (err) {
          // proofStore failure is non-fatal — the mint still counts
          // toward Trust Score; /proof/<hash> will just fall back to
          // the on-chain-only path (item address discovery via tonapi).
          console.warn('[mint] saveProof failed', err)
        }
      }
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
