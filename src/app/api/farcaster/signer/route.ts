import { NextResponse } from 'next/server'
import {
  loadSigner,
  saveSigner,
  createAndRegisterSigner,
  fetchSignerStatus,
  clearSigner,
} from '@/lib/neynar'

/**
 * POST /api/farcaster/signer
 *   body: { wallet: string }
 *   → Returns the existing signer record if we have one, otherwise
 *     creates a fresh signer + returns the approval URL the user
 *     needs to open in Warpcast.
 *
 * GET  /api/farcaster/signer?wallet=<addr>
 *   → Returns the current signer record. If it was pending_approval,
 *     we refresh from Neynar to catch the approved → fid transition.
 *
 * DELETE /api/farcaster/signer?wallet=<addr>
 *   → Wipes the stored signer. Used to reconnect after a revoke.
 */

export const runtime = 'nodejs'

function isWallet(x: unknown): x is string {
  return typeof x === 'string' && x.length > 0 && x.length < 100
}

export async function POST(request: Request) {
  let body: { wallet?: string }
  try { body = (await request.json()) as { wallet?: string } }
  catch { return NextResponse.json({ error: 'Bad JSON' }, { status: 400 }) }
  const wallet = body.wallet
  if (!isWallet(wallet)) {
    return NextResponse.json({ error: 'wallet required' }, { status: 400 })
  }
  try {
    // If we already have an approved signer, hand it back — the
    // client just needs the signer_uuid to publish casts.
    const existing = await loadSigner(wallet)
    if (existing && existing.status === 'approved') {
      return NextResponse.json(existing)
    }
    // If we have a pending signer, refresh its status once — the user
    // may have approved it in Warpcast since the last request.
    if (existing && existing.status === 'pending_approval') {
      try {
        const s = await fetchSignerStatus(existing.signer_uuid)
        const updated = { ...existing, status: s.status, fid: s.fid }
        await saveSigner(wallet, updated)
        return NextResponse.json(updated)
      } catch { /* fall through to create fresh */ }
    }
    // No usable signer — create and persist.
    const created = await createAndRegisterSigner()
    const rec = {
      signer_uuid: created.signer_uuid,
      public_key: created.public_key,
      status: created.status,
      signer_approval_url: created.signer_approval_url,
      createdAt: Date.now(),
    }
    await saveSigner(wallet, rec)
    return NextResponse.json(rec)
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function GET(request: Request) {
  const url = new URL(request.url)
  const wallet = url.searchParams.get('wallet')
  if (!isWallet(wallet)) {
    return NextResponse.json({ error: 'wallet required' }, { status: 400 })
  }
  try {
    const existing = await loadSigner(wallet)
    if (!existing) {
      return NextResponse.json({ status: 'none' })
    }
    if (existing.status === 'approved') return NextResponse.json(existing)
    // Refresh pending status
    try {
      const s = await fetchSignerStatus(existing.signer_uuid)
      const updated = { ...existing, status: s.status, fid: s.fid ?? existing.fid }
      await saveSigner(wallet, updated)
      return NextResponse.json(updated)
    } catch {
      return NextResponse.json(existing)
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(request: Request) {
  const url = new URL(request.url)
  const wallet = url.searchParams.get('wallet')
  if (!isWallet(wallet)) {
    return NextResponse.json({ error: 'wallet required' }, { status: 400 })
  }
  try {
    await clearSigner(wallet)
    return NextResponse.json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
