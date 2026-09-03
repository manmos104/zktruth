import { NextResponse } from 'next/server'
import { verifyTelegramInitData } from '@/lib/attest'

/**
 * POST /api/attest/telegram
 *
 * Body: { initData: string }   ← raw Telegram.WebApp.initData query string
 *
 * Response: { valid, reason?, user?, authDate? }
 *
 * The Mini App calls this once at startup so the server has a
 * cryptographically-verified Telegram user id to associate with
 * subsequent mints. The verified user id feeds into:
 *   - the C2PA claim payload
 *   - Trust Score attestation bonus
 *   - anomaly detection (multiple wallets under one Telegram user)
 */

export const runtime = 'nodejs'

export async function POST(request: Request) {
  const botToken =
    process.env.TELEGRAM_BOT_TOKEN ||
    process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN
  if (!botToken) {
    return NextResponse.json({ error: 'TELEGRAM_BOT_TOKEN not configured' }, { status: 500 })
  }
  let body: { initData?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 })
  }
  if (!body?.initData || typeof body.initData !== 'string') {
    return NextResponse.json({ error: 'initData required' }, { status: 400 })
  }
  const result = verifyTelegramInitData(body.initData, botToken)
  return NextResponse.json(result, { status: result.valid ? 200 : 401 })
}
