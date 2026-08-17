import { NextResponse } from 'next/server'
import { Address } from '@ton/core'
import {
  appendPost,
  saveMessageRecord,
  type MessageRecord,
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
  const messageId = body?.messageId
  if (!rawWallet || typeof rawWallet !== 'string') {
    return NextResponse.json({ error: 'wallet is required' }, { status: 400 })
  }
  if (!messageId || typeof messageId !== 'number' || !Number.isFinite(messageId)) {
    return NextResponse.json({ error: 'messageId must be a positive number' }, { status: 400 })
  }
  const wallet = normaliseWallet(rawWallet)
  const now = Date.now()

  try {
    // Store message → wallet mapping so the reaction webhook can
    // find the author when reactions come in later.
    const msgRec: MessageRecord = {
      messageId,
      wallet,
      postedAt: now,
      lastViews: 0,
      lastReactionSignature: '',
    }
    await saveMessageRecord(msgRec)

    // Credit the wallet with a post event.
    await appendPost(wallet, { messageId, timestamp: now })

    return NextResponse.json({ ok: true, wallet, messageId })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
