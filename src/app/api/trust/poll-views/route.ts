import { NextResponse } from 'next/server'

/**
 * @deprecated Share/views tracking removed 2026-09.
 *
 * The Telegram Bot API doesn't expose real forward counts to bots,
 * and the getMessages workaround this endpoint tried to use doesn't
 * exist in Bot API — the endpoint was silently returning null every
 * hour anyway. The cron entry has been removed from vercel.json.
 *
 * This stub is kept so any stale external caller (or a not-yet-purged
 * platform cron) returns a clean 410 instead of a 404.
 */

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function goneResponse() {
  return NextResponse.json(
    { ok: false, error: 'endpoint retired — share tracking removed' },
    { status: 410 },
  )
}

export async function GET() { return goneResponse() }
export async function POST() { return goneResponse() }
