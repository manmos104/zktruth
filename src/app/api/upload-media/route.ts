// Placeholder — Vercel Blob upload route is on hold per #74.
// We keep the path so the import shape stays consistent if we resume
// the feature, but the handler short-circuits with 501 today so no
// runtime cost or accidental usage.

import { NextResponse } from 'next/server'

export async function POST() {
  return NextResponse.json(
    { error: 'media upload is not enabled in this build' },
    { status: 501 },
  )
}
