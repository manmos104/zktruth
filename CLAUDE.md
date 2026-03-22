# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is **zkTRUTH**, a Next.js 16 application that demonstrates "Proof of Capture" - authenticated photos on World Chain. The app creates a mobile camera interface for capturing photos/videos and minting them as NFTs with cryptographic proof of authenticity, leveraging World ID for identity verification.

## Core Architecture

### Tech Stack
- **Next.js 16** with App Router (TypeScript)
- **React 19** with client-side state management
- **wagmi 3.x** for Web3/blockchain integration
- **TanStack React Query** for async state management
- **Viem 2.x** for Ethereum interaction
- **@worldcoin/idkit** for World ID verification
- **Tailwind CSS** for styling (postcss config)

### Key Components
- **Main App**: `src/app/page.tsx` - Complete camera interface with embedded styles
- **Web3 Setup**: `src/lib/wagmi.ts` - World Chain configuration (Chain ID: 480)
- **Providers**: `src/app/providers.tsx` - Wagmi + React Query setup
- **API Route**: `src/app/api/verify/route.ts` - World ID verification endpoint

### Blockchain Integration
- Configured for **World Chain** (mainnet, chain ID 480)
- Uses Alchemy RPC endpoint: `https://worldchain-mainnet.g.alchemy.com/public`
- Block explorer: `https://worldchain-mainnet.explorer.alchemy.com`

## Development Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm start

# Lint code
npm run lint
```

## Development Notes

### Camera Functionality
The app implements a sophisticated camera interface that handles:
- Camera permission requests
- Photo and video capture with metadata
- Real-time viewfinder with overlays
- Recording timers and progress indicators
- Simulated mode for development without camera access

### World ID Integration
- Uses World ID app ID: `app_29bbb24bbdc571dc7814a6c088347576`
- Verification endpoint configured in `src/app/api/verify/route.ts`
- Supports both verified (World ID) and unverified (gas fee) minting modes

### State Management
The main component manages complex state including:
- Camera permissions and ready states
- Capture modes (photo/video)
- World ID verification flow
- Minting progress with multi-step UI
- Modal states for wallet and verification overlays

### Styling Approach
Uses extensive inline CSS-in-JS within the component (1100+ lines of styles) rather than separate CSS files. The styling creates a mobile-first camera app interface with:
- Phone frame mockup design
- Live camera viewfinder
- Gradient backgrounds and animations
- Multi-screen navigation flows

### Path Aliases
- `@/*` maps to `./src/*` (configured in `tsconfig.json`)

## Important Implementation Details

When working with this codebase:
1. The main UI component is heavily self-contained with embedded styles
2. Web3 functionality is limited to World Chain - don't assume other networks
3. Camera features require browser permissions and may need simulation mode
4. World ID integration requires valid app configuration for production use
5. The app simulates mobile camera UI in a desktop browser environment