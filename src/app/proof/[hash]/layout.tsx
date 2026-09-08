import type { Metadata } from 'next'

/**
 * Route-scoped layout. Adds a small style override so this page can
 * scroll — the root layout locks `html, body { overflow: hidden }`
 * because the Mini App camera surface fills the viewport, but the
 * /proof/<hash> verification page is a normal long-form document and
 * needs the browser's default vertical scroll back.
 *
 * Metadata is intentionally minimal here; the per-hash `generateMetadata`
 * in page.tsx supplies title / description / OG image / OG video.
 */

export const metadata: Metadata = {
  title: 'zkTruth Proof',
  description: 'On-chain proof of capture — SHA-256 anchored on TON.',
}

export default function ProofLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: `
        html, body {
          height: auto !important;
          overflow: auto !important;
          overflow-x: hidden !important;
          -webkit-overflow-scrolling: touch;
        }
      ` }} />
      {children}
    </>
  )
}
