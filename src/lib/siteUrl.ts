/**
 * Canonical public origin of the app.
 *
 * Used anywhere we have to hand an ABSOLUTE url to something outside
 * the request (OG/Twitter card meta, NFT metadata, server-side fetches
 * of our own API). Deliberately NOT derived from the incoming request
 * headers: reading `headers()` inside a page opts that page out of
 * static/ISR rendering, which is what used to make /proof/<hash>
 * render dynamically on every single social-scraper hit.
 *
 * Override with NEXT_PUBLIC_SITE_URL on a non-production domain.
 */
export const SITE_ORIGIN: string =
  (process.env.NEXT_PUBLIC_SITE_URL || '').replace(/\/+$/, '') ||
  'https://zktruth.vercel.app'
