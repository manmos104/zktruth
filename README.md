<p align="center">
  <img src="https://img.shields.io/badge/World_Chain-480-00c8ff?style=for-the-badge" alt="World Chain" />
  <img src="https://img.shields.io/badge/World_ID-ZKP-00ff87?style=for-the-badge" alt="World ID" />
  <img src="https://img.shields.io/badge/Next.js-16-black?style=for-the-badge" alt="Next.js" />
  <img src="https://img.shields.io/badge/License-MIT-blue?style=for-the-badge" alt="License" />
</p>

# zkTRUTH — Proof of Capture

> **Fight misinformation with cryptographic proof of reality.**

zkTRUTH is a decentralized camera application that cryptographically proves media authenticity using zero-knowledge proofs and blockchain timestamping on World Chain.

In a world where AI-generated deepfakes are indistinguishable from reality, zkTRUTH establishes trust at the point of capture — not after the fact.

---

## The Problem

- **4.7B** AI-generated images created in 2025 alone
- **67%** of people can't distinguish real from AI content
- **96%** of deepfakes are created without consent

No existing solution simultaneously verifies that content was captured by a real device, at a specific time and place, by a verified human, and has not been tampered with since capture.

---

## How It Works

```
📸 CAPTURE  →  🔐 VERIFY  →  ⛓ MINT & SHARE
```

### 1. Capture
Take a photo or video. GPS coordinates, UTC timestamp, and device metadata are embedded in real-time.

### 2. Verify
Authenticate with **World ID** using zero-knowledge proofs. Prove you're human without revealing your identity.

### 3. Mint & Share
SHA-256 content hash is minted as an **ERC-721 NFT** on **World Chain** (Chain ID: 480). Share your verified proof on any platform.

---

## Key Features

| Feature | Description |
|---------|-------------|
| **Zero-Knowledge Proof** | World ID verifies you're human without revealing identity |
| **Content Hashing** | SHA-256 tamper-proof fingerprint generated at capture time |
| **On-Chain Record** | Immutable timestamp and proof on World Chain |
| **Real-Time Metadata** | GPS, time, device info overlaid on camera view |
| **Social Sharing** | Export verified proof to X, Instagram, Farcaster |
| **Photo & Video** | Supports both photo capture and video recording |
| **Mobile-First PWA** | Optimized for iPhone/Android with native camera access |

---

## Technology Stack

| Layer | Technology | Purpose |
|-------|-----------|---------|
| Frontend | Next.js 16 + React 19 | PWA camera application |
| Identity | World ID (ZKP) | Human verification |
| Integrity | SHA-256 + C2PA (Phase 2) | Tamper detection |
| Blockchain | World Chain (ID: 480) | Immutable proof storage |
| Wallet | Privy (embedded wallets) | Non-custodial wallet |
| Storage | Arweave / Irys (Phase 2) | Permanent media storage |

---

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn

### Installation

```bash
git clone https://github.com/manmos104/zktruth.git
cd zktruth
npm install --legacy-peer-deps
```

### Development

```bash
# HTTP (desktop browser testing)
npm run dev

# HTTPS (required for mobile camera access)
npx next dev --experimental-https -p 3000
```

Open [https://localhost:3000](https://localhost:3000) in your browser.

### Mobile Testing

1. Run HTTPS dev server: `npx next dev --experimental-https -p 3000`
2. Find your local IP: `ipconfig getifaddr en0`
3. Open `https://<your-ip>:3000` on your phone's browser
4. Accept the self-signed certificate warning

---

## Architecture

```
┌─────────────────────────────────────────────┐
│                 zkTRUTH App                  │
│         (Next.js PWA / React 19)            │
├──────────┬──────────┬───────────────────────┤
│  Camera  │ Metadata │    UI / Sharing       │
│  Module  │ Overlay  │    Module             │
├──────────┴──────────┴───────────────────────┤
│            Proof of Capture Engine           │
│  ┌────────┐ ┌─────────┐ ┌────────────────┐  │
│  │SHA-256 │ │World ID │ │  GPS + Time    │  │
│  │Hashing │ │  (ZKP)  │ │  Capture       │  │
│  └────┬───┘ └────┬────┘ └───────┬────────┘  │
│       └──────────┼──────────────┘            │
│                  ▼                            │
│         Proof Structure (JSON)               │
├──────────────────────────────────────────────┤
│          World Chain (ID: 480)               │
│     ERC-721 NFT + Immutable Timestamp        │
└──────────────────────────────────────────────┘
```

---

## Roadmap

### Phase 1: MVP ✅ Complete
- [x] Mobile-first PWA camera with real-time metadata overlay
- [x] SHA-256 content hashing at capture time
- [x] World ID integration (zero-knowledge human verification)
- [x] Social sharing with embedded proof data
- [x] Photo and video capture support
- [x] Splash screen with brand animation

### Phase 2: On-Chain Infrastructure 🔄 In Progress
- [ ] ERC-721 smart contract deployment on World Chain
- [ ] Real NFT minting with on-chain attestation
- [ ] C2PA integration for media authenticity standard
- [ ] Arweave / Irys permanent storage
- [ ] Gasless minting for World ID verified users

### Phase 3: Ecosystem & Scale 📋 Planned
- [ ] Public verification portal
- [ ] API for third-party integration
- [ ] Media organization partnerships
- [ ] Multi-chain expansion (Ethereum, Optimism, Base)
- [ ] Proof of Capture SDK for developers

---

## Use Cases

- **🏛 Citizen Journalism** — Verify war zone footage and eyewitness reports
- **⚖️ Legal Evidence** — Tamper-proof photographic evidence for courts
- **🌱 Environmental Monitoring** — Authenticated deforestation/pollution records
- **🎨 Content Authenticity** — Creators prove original authorship vs AI copies
- **🗳 Election Monitoring** — Verified records of polling stations

---

## Security Model

| Threat | Mitigation |
|--------|-----------|
| Content manipulation | SHA-256 hash detects any modification |
| Identity spoofing | World ID biometric uniqueness (1 person = 1 ID) |
| Timestamp manipulation | Blockchain consensus on World Chain |
| Metadata forgery | On-device capture binding |

### Honest Limitations

zkTRUTH proves **when, where, and by whom** media was captured, and that it hasn't been modified. It does **not** verify the semantic meaning of content (e.g., photographing a screen showing fake content).

---

## Project Links

- **GitHub**: [github.com/manmos104/zktruth](https://github.com/manmos104/zktruth)
- **World Developer Portal**: [developer.worldcoin.org](https://developer.worldcoin.org)
- **World Chain Explorer**: [worldchain-mainnet.explorer.alchemy.com](https://worldchain-mainnet.explorer.alchemy.com)

---

## License

MIT License — see [LICENSE](LICENSE) for details.

---

<p align="center">
  <b>zkTRUTH — Where every capture tells the truth.</b>
</p>
