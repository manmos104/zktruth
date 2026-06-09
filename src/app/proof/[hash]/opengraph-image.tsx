// Reuse the Twitter image renderer for the OG (Facebook / iMessage / Discord)
// card — same Frame design, single source of truth. Next.js / Turbopack needs
// the route-segment config fields to be declared in this file directly
// (statically parseable), so we duplicate the literals rather than re-export.
export const runtime = 'nodejs'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export { default } from './twitter-image'
