import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  try {
    const { proof, nullifier_hash, merkle_root, verification_level, signal } = await req.json()

    const response = await fetch(
      `https://developer.worldcoin.org/api/v2/verify/app_29bbb24bbdc571dc7814a6c088347576`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          nullifier_hash,
          merkle_root,
          proof,
          verification_level,
          action: 'capture-proof',
          signal: signal ?? '',
        }),
      }
    )

    const data = await response.json()

    if (response.ok) {
      return NextResponse.json({ success: true, nullifier_hash })
    } else {
      return NextResponse.json({ success: false, error: data }, { status: 400 })
    }
  } catch (e) {
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 })
  }
}
