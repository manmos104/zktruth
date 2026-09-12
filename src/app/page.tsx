'use client'

import { useState, useRef, useEffect, useCallback } from "react";
import { useAccount, useDisconnect } from 'wagmi';
import { useMintVerifiedProof, useMintUnverifiedProof, toBytes32Hash, hashGps } from '@/lib/useZkTruth';
import { ZKTRUTH_CONTRACT_ADDRESS } from '@/lib/contract';
import { WorldIdVerifyButton } from '@/lib/worldid';
import { useTelegramBackButton } from './hooks/useTelegramBackButton';
import { useTelegramExpand } from './hooks/useTelegramExpand';
import { useTonConnectUI, useTonWallet } from '@tonconnect/ui-react';
import { upload } from '@vercel/blob/client';
import { Address } from '@ton/core';
import { TrustBadge, type TrustTier as TrustTierType } from './TrustBadge';
import { PromotionOverlay, TIER_ORDER } from './PromotionOverlay';
import {
  buildMintTransaction,
  hashHexToBigInt,
  messageIdFromPostUrl,
  normaliseHashHex,
  timestampToBigInt,
} from '@/lib/tonMint';


const styles = `
@import url('https://fonts.googleapis.com/css2?family=Space+Mono:ital,wght@0,400;0,700;1,400&family=Syne:wght@400;700;800&display=swap');

* { margin: 0; padding: 0; box-sizing: border-box; }

:root {
  --bg: #080808;
  --surface: #111111;
  --border: #1e1e1e;
  --accent: #00ff87;
  --accent2: #00c8ff;
  --text: #f0f0f0;
  --muted: #555;
  --danger: #ff3b5c;
}

html, body {
  width: 100%;
  height: 100%;
  overflow: hidden;
  background: #000;
  color: var(--text);
  font-family: 'Space Mono', monospace;
}

.fullscreen {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  width: 100%;
  height: 100vh;
  height: 100dvh;
  background: #000;
  overflow: hidden;
  -webkit-overflow-scrolling: touch;
}

@media (min-width: 500px) {
  .fullscreen {
    position: relative;
    width: 390px;
    height: 844px;
    max-height: 100vh;
    max-height: 100dvh;
    top: auto; left: auto; right: auto; bottom: auto;
    margin: 0 auto;
  }
}

@media (min-width: 500px) and (min-height: 860px) {
  .fullscreen {
    margin-top: calc((100vh - 844px) / 2);
    margin-top: calc((100dvh - 844px) / 2);
    border-radius: 40px;
    box-shadow: 0 0 80px rgba(0,255,135,0.08), 0 40px 100px rgba(0,0,0,0.8);
  }
}

.camera-video {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

canvas { display: none; }

.simulated-bg {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background:
    radial-gradient(ellipse at 30% 40%, rgba(0,80,40,0.3) 0%, transparent 60%),
    radial-gradient(ellipse at 70% 60%, rgba(0,40,80,0.3) 0%, transparent 60%),
    linear-gradient(180deg, #050a05 0%, #020508 50%, #050a05 100%);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 10px;
  color: rgba(0,255,135,0.2);
  font-family: 'Space Mono', monospace;
  letter-spacing: 2px;
}

.grid-overlay {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background-image:
    linear-gradient(rgba(0,255,135,0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(0,255,135,0.03) 1px, transparent 1px);
  background-size: 30px 30px;
  pointer-events: none;
}

.top-bar {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  bottom: auto;
  height: auto;
  /* Extra top padding leaves room for Telegram's own header (Close
     button + drag handle) when the app runs as a Mini App. In a
     regular browser the extra space just becomes a slight visual
     breathing area above the logo — acceptable trade. */
  padding: max(88px, env(safe-area-inset-top, 44px)) 20px 16px;
  background: linear-gradient(to bottom, rgba(0,0,0,0.7) 0%, transparent 100%);
  display: flex;
  align-items: center;
  justify-content: space-between;
  z-index: 10;
}

.logo {
  display: flex;
  align-items: center;
  gap: 8px;
}
.logo-icon { width: 26px; height: 26px; }
.logo-text {
  font-family: 'Syne', sans-serif;
  font-size: 18px;
  color: white;
  font-style: italic;
}
.logo-zk { font-weight: 400; }
.logo-truth { font-weight: 700; }

.live-badge {
  background: var(--danger);
  color: white;
  font-size: 9px;
  font-weight: 700;
  padding: 4px 10px;
  border-radius: 100px;
  letter-spacing: 1px;
  display: flex;
  align-items: center;
  gap: 5px;
  margin-left: 10px;
}
.live-dot {
  width: 5px; height: 5px;
  background: white;
  border-radius: 50%;
  animation: blink 1s infinite;
}
@keyframes blink {
  0%, 100% { opacity: 1; }
  50% { opacity: 0; }
}

/* Modifier for the TON-branded network status pill. Overrides the
   legacy cyan (World Chain) colours with a subtle green + neon-blue
   diamond glyph so the same DOM structure just re-skins cleanly. */
.chain-badge--ton {
  color: #d8ffe9;
  border-color: rgba(0, 255, 135, 0.28);
  background: rgba(0, 255, 135, 0.06);
  backdrop-filter: blur(6px);
  font-family: 'Space Mono', monospace;
  font-weight: 700;
  letter-spacing: 1px;
  display: inline-flex;
  align-items: center;
  gap: 5px;
}
.chain-badge {
  font-size: 9px;
  color: var(--accent2);
  border: 1px solid rgba(0,200,255,0.4);
  padding: 4px 10px;
  border-radius: 100px;
  background: rgba(0,200,255,0.08);
}

.meta-overlay {
  position: absolute;
  /* Sits below the top-bar (which itself has 88px top-padding to
     clear Telegram's Close/drag handle). Bumped from 90px so the
     time/GPS lines don't overlap the Telegram header inside a Mini
     App. */
  top: 140px;
  left: 20px;
  bottom: auto;
  right: auto;
  height: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
  z-index: 5;
  pointer-events: none;
}
/* Privacy notice modal — flat black-and-white sheet. Deliberately
   drops the blue accents used elsewhere so this reads as legal/
   formal content rather than a marketing surface. Backdrop closes
   on tap-outside; the sheet stops propagation so users can freely
   scroll inside. */
.privacy-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.6);
  z-index: 10005;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  animation: privacyFade 0.2s ease-out;
}
@keyframes privacyFade {
  from { opacity: 0; }
  to   { opacity: 1; }
}
.privacy-modal {
  background: #ffffff;
  border: 1px solid #000;
  border-radius: 16px;
  padding: 28px 22px 22px;
  max-width: 440px;
  width: 100%;
  max-height: 84vh;
  overflow-y: auto;
  position: relative;
  font-family: 'Space Mono', monospace;
  color: #111;
  animation: privacyPop 0.25s ease-out;
}
@keyframes privacyPop {
  from { opacity: 0; transform: translateY(12px); }
  to   { opacity: 1; transform: translateY(0); }
}
.privacy-modal-close {
  position: absolute;
  top: 12px;
  right: 12px;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 1px solid #111;
  background: #fff;
  color: #111;
  font-size: 14px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}
.privacy-modal-title {
  font-family: 'Syne', sans-serif;
  font-weight: 800;
  font-size: 16px;
  letter-spacing: 2px;
  color: #111;
  text-align: center;
  margin-bottom: 20px;
  padding-right: 32px;
  border-bottom: 1px solid #111;
  padding-bottom: 14px;
}
.privacy-modal-body {
  font-size: 12px;
  line-height: 1.75;
  color: #333;
}
.privacy-modal-body p {
  margin: 0 0 12px 0;
}
.privacy-modal-body ul {
  list-style: none;
  padding: 0;
  margin: 0 0 14px 0;
}
.privacy-modal-body li {
  padding: 8px 0 8px 14px;
  margin-bottom: 4px;
  border-left: 2px solid #111;
  background: transparent;
  border-radius: 0;
}
.privacy-modal-body b {
  color: #000;
  font-weight: 700;
}
.privacy-modal-final {
  padding: 12px 14px !important;
  border: 1px solid #111 !important;
  border-radius: 6px;
  font-size: 11px !important;
  line-height: 1.7 !important;
  color: #111 !important;
  background: #f5f5f5;
  margin-top: 8px;
}
.privacy-modal-ok {
  width: 100%;
  height: 44px;
  margin-top: 18px;
  border-radius: 8px;
  border: 1px solid #111;
  background: #111;
  color: #fff;
  font-family: 'Space Mono', monospace;
  font-weight: 700;
  font-size: 12px;
  letter-spacing: 2px;
  cursor: pointer;
}
.privacy-modal-ok:active {
  transform: translateY(1px);
  background: #333;
}

/* Full-screen posting overlay — a dim backdrop with a rotating
   diamond ring and progress text. Renders while the SHARE flow is
   awaiting the Telegram Bot API. Blocks pointer events so a jittery
   user can't spam-submit while the request is in flight. */
.posting-overlay {
  position: fixed;
  inset: 0;
  background: rgba(0, 8, 20, 0.75);
  backdrop-filter: blur(8px);
  z-index: 10001;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 20px;
  animation: postingFadeIn 0.2s ease-out;
}
@keyframes postingFadeIn {
  from { opacity: 0; }
  to   { opacity: 1; }
}
.posting-spinner {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  border: 3px solid rgba(0, 152, 234, 0.15);
  border-top-color: #0098ea;
  border-right-color: #0098ea;
  animation: postingSpin 0.9s linear infinite;
  box-shadow: 0 0 30px rgba(0, 152, 234, 0.35);
}
@keyframes postingSpin {
  from { transform: rotate(0deg); }
  to   { transform: rotate(360deg); }
}
.posting-label {
  color: #d8ecff;
  font-family: 'Space Mono', monospace;
  font-weight: 700;
  font-size: 12px;
  letter-spacing: 3px;
  text-transform: uppercase;
  animation: postingPulse 1.2s ease-in-out infinite;
}
@keyframes postingPulse {
  0%, 100% { opacity: 0.55; }
  50%      { opacity: 1; }
}
.posting-sub {
  color: rgba(255, 255, 255, 0.4);
  font-family: 'Space Mono', monospace;
  font-size: 10px;
  letter-spacing: 1px;
  margin-top: -8px;
}

/* Success burst overlay — pops on top of the posting spinner the
   instant the Bot API confirms the post landed. Uses a bright green
   check inside a soft glow so the eye is drawn to it before the tab
   swap fires. */
.posting-success {
  position: fixed;
  inset: 0;
  background: rgba(0, 8, 20, 0.85);
  backdrop-filter: blur(10px);
  z-index: 10002;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-direction: column;
  gap: 16px;
  animation: successFadeIn 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
}
@keyframes successFadeIn {
  from { opacity: 0; transform: scale(0.9); }
  to   { opacity: 1; transform: scale(1); }
}
.posting-success-check {
  width: 120px;
  height: 120px;
  border-radius: 50%;
  background: rgba(0, 255, 135, 0.12);
  border: 3px solid #00ff87;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 0 60px rgba(0, 255, 135, 0.55);
  animation: successPop 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
}
@keyframes successPop {
  0%   { transform: scale(0); opacity: 0; }
  60%  { transform: scale(1.2); opacity: 1; }
  100% { transform: scale(1); opacity: 1; }
}
.posting-success-check svg {
  width: 60px;
  height: 60px;
  stroke: #00ff87;
  stroke-width: 4;
  fill: none;
  stroke-linecap: round;
  stroke-linejoin: round;
  stroke-dasharray: 60;
  stroke-dashoffset: 60;
  animation: successDraw 0.5s 0.15s ease-out forwards;
}
@keyframes successDraw {
  to { stroke-dashoffset: 0; }
}
.posting-success-label {
  color: #00ff87;
  font-family: 'Space Mono', monospace;
  font-weight: 800;
  font-size: 14px;
  letter-spacing: 4px;
  text-transform: uppercase;
  text-shadow: 0 0 20px rgba(0, 255, 135, 0.6);
}

.meta-line {
  font-size: 11px;
  color: var(--accent);
  /* Was 0.6 — too faded to read against camera feed backgrounds,
     the timestamp + GPS coords were mistaken for missing. Full
     opacity plus a subtle text-shadow keeps them legible on both
     bright and dark scenes. */
  opacity: 1;
  letter-spacing: 0.5px;
  text-shadow: 0 1px 3px rgba(0,0,0,0.7);
}
/* The network status line gets full opacity and a compact
   token-style layout — dots + glyph + label read as a mission-
   control readout rather than a generic subtitle. */
.meta-network {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  opacity: 1;
  padding: 3px 8px 3px 6px;
  border-radius: 999px;
  background: rgba(0, 255, 135, 0.06);
  border: 1px solid rgba(0, 255, 135, 0.28);
  backdrop-filter: blur(6px);
  font-family: 'Space Mono', monospace;
  font-weight: 700;
  font-size: 9px;
  letter-spacing: 1px;
  color: #d8ffe9;
  width: fit-content;
}
.net-dot {
  width: 6px; height: 6px;
  border-radius: 50%;
  background: #00ff87;
  box-shadow: 0 0 8px #00ff87, 0 0 2px #fff inset;
  animation: netPulse 1.6s ease-in-out infinite;
}
.net-glyph {
  color: #0098ea;
  font-size: 11px;
  line-height: 1;
  text-shadow: 0 0 6px rgba(0, 152, 234, 0.6);
}
.net-label { color: #ffffff; }
.net-sep {
  color: rgba(255, 255, 255, 0.45);
  font-weight: 400;
}
.net-state { color: rgba(255, 255, 255, 0.85); }
.net-state--live { color: #00ff87; }
@keyframes netPulse {
  0%, 100% { opacity: 0.55; transform: scale(0.9); }
  50%      { opacity: 1;    transform: scale(1.15); }
}

.side-buttons {
  position: absolute;
  left: 16px;
  bottom: max(30px, env(safe-area-inset-bottom, 30px));
  top: auto;
  height: auto;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  z-index: 20;
}
.side-btn {
  width: 48px; height: 48px;
  border-radius: 50%;
  border: 1px solid rgba(255,255,255,0.2);
  background: rgba(0,0,0,0.4);
  color: #fff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
}
.side-btn-label {
  font-size: 8px;
  color: rgba(255,255,255,0.6);
  margin-top: 2px;
  text-align: center;
}

.bottom-controls {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  top: auto;
  height: auto;
  padding: 20px 0 max(24px, env(safe-area-inset-bottom, 24px));
  background: linear-gradient(to top, rgba(0,0,0,0.7) 0%, transparent 100%);
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  z-index: 10;
}

.zoom-controls {
  display: flex;
  gap: 6px;
  margin-bottom: 8px;
}
.zoom-btn {
  width: 36px; height: 36px;
  border-radius: 50%;
  border: none;
  background: rgba(0,0,0,0.4);
  color: rgba(255,255,255,0.6);
  font-family: 'Space Mono', monospace;
  font-size: 10px;
  font-weight: 700;
  cursor: pointer;
  backdrop-filter: blur(10px);
  transition: all 0.2s;
  display: flex;
  align-items: center;
  justify-content: center;
}
.zoom-btn.active {
  background: rgba(255,200,0,0.9);
  color: #000;
}

.mode-tabs {
  display: flex;
  gap: 24px;
  font-size: 12px;
}
.mode-tab {
  color: rgba(255,255,255,0.4);
  cursor: pointer;
  letter-spacing: 1px;
  background: none;
  border: none;
  font-family: 'Space Mono', monospace;
  font-size: 12px;
  padding: 4px 0;
}
.mode-tab.active {
  color: #fff;
  position: relative;
}
.mode-tab.active::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 50%;
  transform: translateX(-50%);
  width: 4px; height: 4px;
  background: #fff;
  border-radius: 50%;
}

.btn-capture {
  width: 80px; height: 80px;
  border-radius: 50%;
  border: 4px solid var(--accent);
  background: transparent;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
}
.btn-capture::after {
  content: '';
  width: 64px; height: 64px;
  background: var(--accent);
  border-radius: 50%;
  transition: all 0.15s;
}
.btn-capture:active::after { width: 48px; height: 48px; }

.btn-capture.video-mode { border-color: var(--danger); }
.btn-capture.video-mode::after {
  background: var(--danger);
  border-radius: 8px;
  width: 36px; height: 36px;
}
.btn-capture.video-mode.recording {
  animation: recordPulse 1.5s ease-in-out infinite;
}
.btn-capture.video-mode.recording::after {
  border-radius: 4px;
  width: 30px; height: 30px;
}
@keyframes recordPulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(255,59,92,0.4); }
  50% { box-shadow: 0 0 0 12px rgba(255,59,92,0); }
}

.rec-progress {
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 3px;
  background: rgba(255,255,255,0.1);
  z-index: 20;
}
.rec-progress-fill {
  height: 100%;
  background: var(--danger);
  transition: width 1s linear;
}

.flash-overlay {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: white;
  opacity: 0;
  pointer-events: none;
  z-index: 100;
}
.flash-overlay.active { opacity: 1; }

/* ===== OVERLAY SCREENS ===== */
.overlay-screen {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: linear-gradient(160deg, #080818 0%, #0a1628 40%, #0d0d1a 100%);
  display: flex;
  flex-direction: column;
  z-index: 200;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}
.overlay-screen::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background-image:
    radial-gradient(ellipse at 20% 0%, rgba(0,200,255,0.08) 0%, transparent 50%),
    radial-gradient(ellipse at 80% 100%, rgba(0,255,135,0.05) 0%, transparent 50%);
  pointer-events: none;
  z-index: 0;
}
.overlay-screen > * { position: relative; z-index: 1; }
.overlay-header {
  /* 88px top padding matches the camera top-bar — it leaves room
     for Telegram's back arrow / drag handle inside a Mini App so
     the logo doesn't collide with the system chrome. */
  padding: 88px 20px 12px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-shrink: 0;
  border-bottom: 1px solid rgba(0,200,255,0.08);
}
.overlay-title {
  font-family: 'Syne', sans-serif;
  font-weight: 800;
  font-size: 22px;
  color: var(--text);
  background: linear-gradient(90deg, #fff, var(--accent2));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
.overlay-subtitle {
  font-size: 10px;
  color: var(--accent2);
  margin-top: 4px;
  letter-spacing: 1px;
  opacity: 0.7;
}
.btn-back {
  background: rgba(255,255,255,0.05);
  border: 1px solid rgba(255,255,255,0.1);
  border-radius: 20px;
  color: var(--muted);
  font-family: 'Space Mono', monospace;
  font-size: 11px;
  cursor: pointer;
  padding: 6px 14px;
  transition: all 0.2s;
}
.btn-back:hover { border-color: var(--accent2); color: var(--accent2); }

/* World ID */
.worldid-preview {
  margin: 12px 20px 0;
  border-radius: 16px;
  overflow: hidden;
  position: relative;
  flex-shrink: 0;
  height: 130px;
  border: 1px solid rgba(0,200,255,0.15);
  box-shadow: 0 4px 30px rgba(0,200,255,0.1);
}
.worldid-preview img { width: 100%; height: 100%; object-fit: cover; filter: brightness(0.7) saturate(1.2); }

.worldid-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
  padding: 16px 28px 40px;
}

.worldid-orb-wrap {
  position: relative;
  width: 100px; height: 100px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}
.worldid-orb {
  width: 76px; height: 76px;
  border-radius: 50%;
  background: radial-gradient(circle at 35% 35%, #c8f0ff, #0099cc 50%, #003355 100%);
  box-shadow: 0 0 40px rgba(0,200,255,0.4);
  position: relative;
  overflow: hidden;
}
.worldid-orb::after {
  content: '';
  position: absolute;
  top: 14px; left: 18px;
  width: 30px; height: 20px;
  background: rgba(255,255,255,0.35);
  border-radius: 50%;
  transform: rotate(-30deg);
}
.orb-ring {
  position: absolute;
  top: -12px; left: -12px; right: -12px; bottom: -12px;
  border-radius: 50%;
  border: 2px solid rgba(0,200,255,0.3);
  animation: orbPulse 2s ease-in-out infinite;
}
.orb-ring:nth-child(2) {
  top: -24px; left: -24px; right: -24px; bottom: -24px;
  border-color: rgba(0,200,255,0.15);
  animation-delay: 0.5s;
}
@keyframes orbPulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.05); opacity: 0.6; }
}
.orb-ring-scan {
  position: absolute;
  top: -12px; left: -12px; right: -12px; bottom: -12px;
  border-radius: 50%;
  border: 2px solid transparent;
  border-top-color: var(--accent2);
  animation: orbSpin 1.2s linear infinite;
}
@keyframes orbSpin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.worldid-title {
  font-family: 'Syne', sans-serif;
  font-weight: 800;
  font-size: 20px;
  color: var(--text);
  text-align: center;
  background: linear-gradient(90deg, #fff, var(--accent2));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
.worldid-desc {
  font-size: 11px;
  color: rgba(255,255,255,0.4);
  text-align: center;
  line-height: 1.8;
  max-width: 300px;
}
.worldid-steps {
  width: 100%;
  background: rgba(0,0,0,0.4);
  border-radius: 16px;
  border: 1px solid rgba(0,200,255,0.1);
  overflow: hidden;
  backdrop-filter: blur(10px);
}
.worldid-step {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 14px 16px;
  border-bottom: 1px solid rgba(0,200,255,0.06);
  font-size: 10px;
  color: var(--muted);
  letter-spacing: 0.5px;
}
.worldid-step:last-child { border-bottom: none; }
.worldid-step-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  background: rgba(255,255,255,0.1);
  flex-shrink: 0;
  transition: all 0.3s;
}
.worldid-step.active .worldid-step-dot {
  background: var(--accent2);
  box-shadow: 0 0 12px var(--accent2);
  animation: blink 1s infinite;
}
.worldid-step.done .worldid-step-dot { background: var(--accent); box-shadow: 0 0 8px var(--accent); }
.worldid-step.done { color: var(--accent); }
.worldid-step.active { color: var(--accent2); }

.btn-worldid {
  width: 100%;
  height: 56px;
  border-radius: 16px;
  border: none;
  background: linear-gradient(135deg, #00c8ff, #0090ff);
  color: #fff;
  font-family: 'Space Mono', monospace;
  font-weight: 700;
  font-size: 12px;
  cursor: pointer;
  letter-spacing: 1px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  box-shadow: 0 4px 20px rgba(0,200,255,0.3);
  transition: all 0.2s;
}
.btn-worldid:hover { transform: translateY(-2px); box-shadow: 0 6px 30px rgba(0,200,255,0.4); }
.btn-worldid:disabled { opacity: 0.4; cursor: not-allowed; transform: none; box-shadow: none; }

.verify-divider {
  display: flex;
  align-items: center;
  gap: 10px;
  width: 100%;
}
.verify-divider::before,
.verify-divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(0,200,255,0.15), transparent);
}
.verify-divider span {
  font-size: 9px;
  color: rgba(255,255,255,0.25);
  letter-spacing: 2px;
}

.btn-unverified {
  width: 100%;
  height: 56px;
  border-radius: 16px;
  border: 1px solid rgba(255,255,255,0.08);
  background: rgba(255,255,255,0.03);
  color: rgba(255,255,255,0.5);
  font-family: 'Space Mono', monospace;
  font-size: 11px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  backdrop-filter: blur(10px);
  transition: all 0.2s;
}
.btn-unverified:hover { border-color: rgba(0,200,255,0.3); color: var(--accent2); }
.btn-unverified:disabled { opacity: 0.4; cursor: not-allowed; }

.wld-gas-tag {
  background: rgba(0,200,255,0.08);
  border: 1px solid rgba(0,200,255,0.25);
  border-radius: 100px;
  padding: 3px 8px;
  font-size: 9px;
  color: var(--accent2);
}

.worldid-verified-overlay {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: linear-gradient(160deg, rgba(5,10,25,0.97), rgba(10,20,40,0.98));
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  animation: fadeIn 0.3s ease;
  z-index: 10;
}
.worldid-check {
  width: 88px; height: 88px;
  border-radius: 50%;
  background: rgba(0,200,255,0.08);
  border: 2px solid var(--accent2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 36px;
  animation: scaleIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  box-shadow: 0 0 40px rgba(0,200,255,0.25);
}
.worldid-verified-title {
  font-family: 'Syne', sans-serif;
  font-weight: 800;
  font-size: 22px;
  background: linear-gradient(90deg, var(--accent2), #66e0ff);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
.worldid-verified-sub {
  font-size: 11px;
  color: var(--muted);
  text-align: center;
  max-width: 260px;
}
.worldid-nullifier {
  font-size: 10px;
  color: var(--accent2);
  background: rgba(0,200,255,0.05);
  border: 1px solid rgba(0,200,255,0.15);
  padding: 10px 16px;
  border-radius: 12px;
  max-width: 320px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  backdrop-filter: blur(10px);
}

/* World ID Fullscreen */
.wid-screen {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: #000;
  z-index: 200;
  overflow: hidden;
}
.wid-bg {
  position: absolute;
  top: 0; left: 0;
  width: 100%; height: 100%;
  /* Captures are 1:1 square now — contain centers the square and
     letterboxes the vertical space with black bars, matching what
     wallet galleries do. cover would silently crop the square
     back to a portrait and defeat the whole point. */
  object-fit: contain;
  background: #000;
}
/* ---- Square NFT crop guide (camera viewfinder overlay) ---- */
/* Frames the centered 1:1 area of the portrait viewfinder so the
   user knows exactly what pixels will become the NFT. Positioned
   with viewport-relative units so the square is always min(100vw,
   fullHeight) wide, centered vertically. Pointer-events disabled
   throughout so the guide never blocks camera controls underneath. */
.nft-square-guide {
  position: absolute;
  inset: 0;
  pointer-events: none;
  z-index: 5;
}
.nsg-mask {
  position: absolute;
  left: 0; right: 0;
  background: rgba(0, 0, 0, 0.42);
  backdrop-filter: blur(0.5px);
}
.nsg-mask-top {
  top: 0;
  height: calc((100% - 100vw) / 2);
}
.nsg-mask-bottom {
  bottom: 0;
  height: calc((100% - 100vw) / 2);
}
.nsg-frame {
  position: absolute;
  left: 0; right: 0;
  top: calc((100% - 100vw) / 2);
  height: 100vw;
  max-height: 100%;
  border: 1px solid rgba(255, 255, 255, 0.75);
  box-shadow:
    0 0 0 1px rgba(0, 0, 0, 0.35),
    inset 0 0 0 1px rgba(0, 0, 0, 0.35);
}
.nsg-corner {
  position: absolute;
  width: 22px;
  height: 22px;
  border-color: #ffffff;
  border-style: solid;
  border-width: 0;
  filter: drop-shadow(0 0 3px rgba(0, 0, 0, 0.6));
}
.nsg-tl { top: -1px; left: -1px; border-top-width: 3px; border-left-width: 3px; }
.nsg-tr { top: -1px; right: -1px; border-top-width: 3px; border-right-width: 3px; }
.nsg-bl { bottom: -1px; left: -1px; border-bottom-width: 3px; border-left-width: 3px; }
.nsg-br { bottom: -1px; right: -1px; border-bottom-width: 3px; border-right-width: 3px; }
.nsg-label {
  position: absolute;
  bottom: 8px;
  left: 50%;
  transform: translateX(-50%);
  font-family: monospace;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 1.5px;
  color: rgba(255, 255, 255, 0.85);
  background: rgba(0, 0, 0, 0.55);
  padding: 3px 8px;
  border-radius: 4px;
  text-shadow: 0 1px 1px rgba(0, 0, 0, 0.6);
}
.wid-overlay {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  z-index: 1;
}
.wid-top {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: max(48px, env(safe-area-inset-top, 48px)) 20px 0;
}
.wid-back {
  width: 36px; height: 36px;
  border-radius: 50%;
  border: none;
  background: rgba(0,0,0,0.5);
  color: #fff;
  font-size: 18px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  backdrop-filter: blur(10px);
}
.wid-badge {
  background: rgba(0,0,0,0.5);
  border: 1px solid rgba(0,255,135,0.4);
  color: #00ff87;
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 2px;
  padding: 6px 14px;
  border-radius: 100px;
  backdrop-filter: blur(10px);
}
.wid-bottom {
  padding: 0 20px max(24px, env(safe-area-inset-bottom, 24px));
  display: flex;
  flex-direction: column;
  gap: 10px;
  background: linear-gradient(to top, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.4) 60%, transparent 100%);
  padding-top: 80px;
}
.wid-hash {
  font-family: 'Space Mono', monospace;
  font-size: 11px;
  color: #00c8ff;
  letter-spacing: 0.5px;
}
.wid-time {
  font-size: 10px;
  color: rgba(255,255,255,0.4);
  margin-bottom: 6px;
}
.wid-verify-btn {
  width: 100%;
  height: 52px;
  border-radius: 14px;
  border: none;
  background: linear-gradient(135deg, #00c8ff, #0090ff);
  color: #fff;
  font-family: 'Space Mono', monospace;
  font-weight: 700;
  font-size: 13px;
  cursor: pointer;
  letter-spacing: 1px;
  box-shadow: 0 4px 20px rgba(0,200,255,0.3);
  transition: all 0.2s;
}
.wid-verify-btn:disabled { opacity: 0.5; cursor: not-allowed; }
/* Variant used when the surrounding card is the clean white background
   (video captures). Solid black button with white text reads cleanly
   against the white card and pairs visually with the outlined Replay
   button placed directly above it. */
.wid-verify-btn--light {
  background: #111 !important;
  color: #fff !important;
  box-shadow: 0 4px 18px rgba(0,0,0,0.18) !important;
}
/* zkTruth brand mark with animated check.
   The bubble is a static layer underneath; the check sits in an
   absolutely-positioned overlay so it can spin around its own center
   without dragging the bubble with it. The animation spends most of
   its cycle holding the check in its correct upright position, then
   does one quick full revolution and lands again — that's what reads
   as "rotate and stop, then repeat". */
.zk-icon-wrap {
  position: relative;
  width: 72%;
  max-width: 360px;
  aspect-ratio: 1;
}
.zk-icon-bubble,
.zk-icon-check {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.zk-icon-check {
  transform-origin: 50% 50%;
  /* Fast 3-revolution spin that overshoots its landing by a touch and
     springs back, giving the mark a snappy "lands and seals" beat. */
  animation: zk-check-spin 1.8s cubic-bezier(.45,.02,.4,1) infinite;
}
@keyframes zk-check-spin {
  0%   { transform: rotate(0deg); }        /* start at correct position */
  55%  { transform: rotate(1110deg); }     /* 3 full spins + slight overshoot */
  72%  { transform: rotate(1065deg); }     /* spring back past target */
  82%, 100% { transform: rotate(1080deg); } /* settle exactly on target + hold */
}
.wid-gas-btn {
  width: 100%;
  height: 44px;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,0.1);
  background: rgba(255,255,255,0.05);
  color: rgba(255,255,255,0.5);
  font-family: 'Space Mono', monospace;
  font-size: 11px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  backdrop-filter: blur(10px);
  transition: all 0.2s;
}
.wid-gas-btn:disabled { opacity: 0.4; cursor: not-allowed; }
.wid-verified {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: rgba(0,0,0,0.85);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  z-index: 10;
  animation: fadeIn 0.3s ease;
  backdrop-filter: blur(10px);
}
.wid-verified-icon {
  width: 88px; height: 88px;
  border-radius: 50%;
  background: rgba(0,255,135,0.08);
  border: 2.5px solid #00ff87;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: scaleIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  box-shadow: 0 0 40px rgba(0,255,135,0.2), 0 0 80px rgba(0,255,135,0.08);
}
.wid-verified-icon svg {
  width: 40px; height: 40px;
}
.wid-verified-title {
  font-family: 'Syne', sans-serif;
  font-weight: 800;
  font-size: 24px;
  font-style: italic;
  background: linear-gradient(135deg, #00ff87 0%, #00c8ff 50%, #a78bfa 100%);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  letter-spacing: -0.5px;
}
.wid-verified-sub {
  font-family: 'Space Mono', monospace;
  font-size: 10px;
  color: rgba(0,255,135,0.5);
  text-align: center;
  max-width: 280px;
  letter-spacing: 1.5px;
  text-transform: uppercase;
  line-height: 1.8;
}

/* Minting */
.captured-preview {
  margin: 12px 20px 0;
  border-radius: 16px;
  overflow: hidden;
  position: relative;
  flex-shrink: 0;
  height: 240px;
  border: 1px solid rgba(0,200,255,0.15);
  box-shadow: 0 4px 30px rgba(0,200,255,0.1);
}
.captured-preview img { width: 100%; height: 100%; object-fit: cover; filter: brightness(0.8) saturate(1.2); }
.proof-badge {
  position: absolute;
  top: 12px; right: 12px;
  background: rgba(0,0,0,0.6);
  border: 1px solid var(--accent);
  border-radius: 20px;
  padding: 6px 14px;
  font-size: 9px;
  color: var(--accent);
  backdrop-filter: blur(10px);
  letter-spacing: 1px;
  box-shadow: 0 2px 12px rgba(0,255,135,0.15);
}
.proof-data {
  margin: 16px 20px 0;
  background: rgba(0,0,0,0.4);
  border-radius: 16px;
  border: 1px solid rgba(0,200,255,0.1);
  overflow: hidden;
  backdrop-filter: blur(10px);
}
.proof-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(0,200,255,0.06);
}
.proof-row:last-child { border-bottom: none; }
.proof-key { font-size: 10px; color: var(--muted); letter-spacing: 1px; text-transform: uppercase; }
.proof-value { font-size: 10px; color: var(--text); max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; text-align: right; }
.proof-value.accent { color: var(--accent); }
.proof-value.accent2 { color: var(--accent2); }

.wld-badge {
  background: rgba(0,200,255,0.08);
  border: 1px solid rgba(0,200,255,0.25);
  border-radius: 8px;
  padding: 4px 10px;
  font-size: 10px;
  color: var(--accent2);
  font-weight: 700;
}

.mint-status { margin: 16px 20px 0; }
.status-bar-bg {
  height: 4px;
  background: rgba(255,255,255,0.05);
  border-radius: 100px;
  overflow: hidden;
  margin-bottom: 8px;
}
.status-bar-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--accent), var(--accent2));
  border-radius: 100px;
  transition: width 0.4s ease;
}
.status-text { font-size: 10px; color: var(--muted); display: flex; justify-content: space-between; }
.status-text .current { color: var(--accent); }

.share-section { margin: 16px 20px 40px; }
.share-label { font-size: 9px; color: var(--muted); letter-spacing: 1px; text-transform: uppercase; margin-bottom: 10px; }
.share-buttons { display: flex; gap: 8px; }
.share-btn {
  flex: 1;
  height: 48px;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,0.08);
  background: rgba(255,255,255,0.03);
  color: var(--text);
  font-family: 'Space Mono', monospace;
  font-size: 11px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  backdrop-filter: blur(10px);
  transition: all 0.2s;
}
.share-btn:hover { border-color: rgba(0,200,255,0.3); }
.share-btn.primary { background: linear-gradient(135deg, var(--accent), #00cc66); color: #000; border-color: transparent; font-weight: 700; box-shadow: 0 4px 16px rgba(0,255,135,0.2); }

.mint-complete-overlay {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: linear-gradient(160deg, rgba(5,10,25,0.97), rgba(10,15,30,0.98));
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 16px;
  z-index: 300;
  animation: fadeIn 0.3s ease;
  padding: 40px;
}
.mint-complete-overlay::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: radial-gradient(ellipse at 50% 30%, rgba(0,255,135,0.08) 0%, transparent 60%);
  pointer-events: none;
}
@keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
@keyframes scaleIn { from { transform: scale(0); opacity: 0; } to { transform: scale(1); opacity: 1; } }

.mint-icon {
  width: 80px; height: 80px;
  border-radius: 50%;
  background: rgba(0,255,135,0.1);
  border: 2px solid var(--accent);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 32px;
  animation: scaleIn 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
  box-shadow: 0 0 40px rgba(0,255,135,0.2);
}
.mint-complete-title {
  font-family: 'Syne', sans-serif;
  font-weight: 800;
  font-size: 24px;
  background: linear-gradient(90deg, var(--accent), #00ffcc);
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
.mint-complete-sub { font-size: 11px; color: var(--muted); text-align: center; max-width: 280px; line-height: 1.6; }
.tx-hash {
  font-size: 10px;
  color: var(--accent2);
  background: rgba(0,200,255,0.05);
  border: 1px solid rgba(0,200,255,0.15);
  padding: 10px 16px;
  border-radius: 12px;
  max-width: 320px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  backdrop-filter: blur(10px);
}

/* SNS Share */
.sns-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 20px 24px 40px;
  gap: 16px;
}
.sns-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 12px;
}
.sns-btn {
  height: 64px;
  border-radius: 16px;
  border: 1px solid rgba(255,255,255,0.08);
  background: rgba(255,255,255,0.03);
  color: var(--text);
  font-family: 'Space Mono', monospace;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  backdrop-filter: blur(10px);
  transition: all 0.2s;
  letter-spacing: 0.5px;
}
.sns-btn:hover { border-color: rgba(0,200,255,0.3); transform: translateY(-2px); }
.sns-btn .sns-icon {
  font-size: 18px;
  width: 24px;
  text-align: center;
}
.sns-btn.x-btn:hover { border-color: rgba(255,255,255,0.4); }
.sns-btn.ig-btn:hover { border-color: rgba(225,48,108,0.5); }
.sns-btn.tiktok-btn:hover { border-color: rgba(0,242,234,0.5); }
.sns-btn.link-btn:hover { border-color: rgba(0,255,135,0.5); }
.share-full-preview {
  flex: 1;
  position: relative;
  margin: 8px 12px 0;
  border-radius: 16px;
  overflow: hidden;
  min-height: 0;
  border: 1px solid rgba(0,200,255,0.15);
}
.share-full-preview img {
  width: 100%;
  height: 100%;
  object-fit: contain;
  background: #000;
}
.share-full-preview .proof-badge {
  position: absolute;
  top: 10px; right: 10px;
}

.sns-share-main {
  width: 100%;
  height: 56px;
  border-radius: 16px;
  border: none;
  background: linear-gradient(135deg, #00c8ff, #0090ff);
  color: #fff;
  font-family: 'Space Mono', monospace;
  font-weight: 700;
  font-size: 13px;
  cursor: pointer;
  letter-spacing: 1px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 10px;
  box-shadow: 0 4px 20px rgba(0,200,255,0.3);
  transition: all 0.2s;
}
.sns-share-main:hover { transform: translateY(-2px); box-shadow: 0 6px 30px rgba(0,200,255,0.4); }
.sns-copy-status {
  text-align: center;
  font-size: 10px;
  color: var(--accent);
  letter-spacing: 1px;
  min-height: 16px;
}

/* Confirm TX */
.confirm-tx-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px 24px 40px;
  gap: 20px;
}
.tx-icon {
  width: 88px; height: 88px;
  border-radius: 24px;
  background:
    radial-gradient(circle at 30% 30%, rgba(0,152,234,0.35), rgba(0,152,234,0.08) 60%, transparent 100%),
    linear-gradient(135deg, rgba(0,152,234,0.12), rgba(0,152,234,0.02));
  border: 1px solid rgba(0,152,234,0.4);
  box-shadow:
    0 0 40px rgba(0,152,234,0.25),
    inset 0 1px 0 rgba(255,255,255,0.12);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 42px;
  color: #0098ea;
  text-shadow: 0 0 20px rgba(0,152,234,0.8);
}
/* TON logo variant — the artwork is already a self-contained blue
   rounded-square badge, so we strip the surrounding glow/border to
   avoid stacking two visual containers. Slight drop-shadow keeps it
   from looking flat against the dark page background. */
.tx-icon--ton {
  background: none;
  border: none;
  box-shadow: 0 8px 32px rgba(0,152,234,0.35);
  padding: 0;
  width: 88px;
  height: 88px;
  border-radius: 20px;
  overflow: hidden;
}
.tx-icon--ton img {
  width: 100%;
  height: 100%;
  display: block;
}
.tx-title {
  font-family: 'Syne', sans-serif;
  font-weight: 800;
  font-size: 20px;
  text-align: center;
  background: linear-gradient(90deg, #fff, var(--accent2));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
}
.tx-desc {
  font-size: 11px;
  color: rgba(255,255,255,0.4);
  text-align: center;
  line-height: 1.8;
  max-width: 300px;
}
.tx-details {
  width: 100%;
  background: rgba(0,0,0,0.4);
  border-radius: 16px;
  border: 1px solid rgba(0,200,255,0.1);
  overflow: hidden;
  backdrop-filter: blur(10px);
}
.tx-detail-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 14px 16px;
  border-bottom: 1px solid rgba(0,200,255,0.06);
}
.tx-detail-row:last-child { border-bottom: none; }
.tx-detail-key {
  font-size: 10px;
  color: var(--muted);
  letter-spacing: 1px;
  text-transform: uppercase;
}
.tx-detail-value {
  font-size: 12px;
  color: var(--text);
  font-weight: 700;
}
.tx-detail-value.highlight {
  color: var(--accent2);
  font-size: 16px;
}
.tx-warning {
  width: 100%;
  background: rgba(255,200,0,0.05);
  border: 1px solid rgba(255,200,0,0.15);
  border-radius: 12px;
  padding: 12px 16px;
  font-size: 10px;
  color: rgba(255,200,0,0.7);
  line-height: 1.6;
  text-align: center;
}
.btn-confirm-tx {
  width: 100%;
  height: 56px;
  border-radius: 16px;
  border: none;
  background: linear-gradient(135deg, #00c8ff, #0090ff);
  color: #fff;
  font-family: 'Space Mono', monospace;
  font-weight: 700;
  font-size: 12px;
  cursor: pointer;
  letter-spacing: 1px;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  box-shadow: 0 4px 20px rgba(0,200,255,0.3);
  transition: all 0.2s;
}
.btn-confirm-tx:hover { transform: translateY(-2px); box-shadow: 0 6px 30px rgba(0,200,255,0.4); }
.btn-cancel-tx {
  width: 100%;
  height: 48px;
  border-radius: 16px;
  border: 1px solid rgba(255,255,255,0.08);
  background: rgba(255,255,255,0.03);
  color: rgba(255,255,255,0.4);
  font-family: 'Space Mono', monospace;
  font-size: 11px;
  cursor: pointer;
  transition: all 0.2s;
}
.btn-cancel-tx:hover { border-color: rgba(255,255,255,0.2); color: rgba(255,255,255,0.6); }



/* Splash */
.splash {
  position: absolute;
  top: 0; left: 0; right: 0; bottom: 0;
  background: #fff;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  gap: 0;
  opacity: 1;
  transition: opacity 0.6s ease;
}
.splash.fade-out { opacity: 0; pointer-events: none; }
.splash.gone { display: none; }

.splash-icon-wrap {
  /* Container matches bubble PNG aspect ratio 378:382. */
  width: 220px;
  height: 222px;
  position: relative;
  margin-bottom: 28px;
}
/* Bubble is the user's own brand asset, rendered as-is. Its own PNG
   contains the outline + white interior, so no ghost of the check. */
.splash-bubble {
  position: absolute;
  top: 0; left: 0;
  width: 100%;
  height: 100%;
  opacity: 0;
  display: block;
}
.splash.phase1 .splash-bubble {
  animation: bubbleIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}
@keyframes bubbleIn {
  from { opacity: 0; transform: scale(0.3); }
  to { opacity: 1; transform: scale(1); }
}

/* Check overlay — its own asset is a tight crop of the green check
   from the brand PNG. Position by placing its centre at the bubble
   body's centre (52.51%, 41.49% of the container, measured on the
   source image), then translate -50% to reference the check's own
   centre. Rotation happens around that same centre. */
.splash-check {
  position: absolute;
  left: 52.51%;
  top: 41.49%;
  /* Check natural aspect: 214x160. Width is chosen so the check
     matches the visual size in the source brand PNG (57% of bubble
     width, adjusted for container padding). */
  width: 56%;
  height: auto;
  opacity: 0;
  transform-origin: center center;
  display: block;
}
.splash.phase1 .splash-check {
  animation: checkSpin 1.6s cubic-bezier(.45,.02,.4,1) 0.3s forwards;
}
@keyframes checkSpin {
  /* Snap in, spin three full revolutions, overshoot a touch, spring
     back to the upright position and settle there. The
     translate(-50%,-50%) is preserved through every keyframe so the
     check stays centred on the bubble body while rotating. */
  0%   { opacity: 0; transform: translate(-50%,-50%) scale(0)   rotate(0deg); }
  15%  { opacity: 1; transform: translate(-50%,-50%) scale(1)   rotate(360deg); }
  60%  {            transform: translate(-50%,-50%) scale(1)   rotate(1110deg); }
  75%  {            transform: translate(-50%,-50%) scale(1)   rotate(1065deg); }
  100% { opacity: 1; transform: translate(-50%,-50%) scale(1)   rotate(1080deg); }
}
.splash.phase2 .splash-check {
  animation: checkBounce 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  opacity: 1;
  transform: translate(-50%,-50%) scale(1) rotate(1080deg);
}
@keyframes checkBounce {
  0%   { transform: translate(-50%,-50%) scale(1)    rotate(1080deg); }
  50%  { transform: translate(-50%,-50%) scale(1.18) rotate(1080deg); }
  100% { transform: translate(-50%,-50%) scale(1)    rotate(1080deg); }
}

.splash-logo-row {
  /* Container for the official brand wordmark PNG. Keeping the slide-in
     animation so the transition from the icon phase feels continuous. */
  display: flex;
  align-items: center;
  gap: 0;
  opacity: 0;
  transform: translateX(-40px);
  overflow: hidden;
}
.splash.phase2 .splash-logo-row {
  animation: logoSlideIn 0.6s cubic-bezier(0.16, 1, 0.3, 1) 0.3s forwards;
}
@keyframes logoSlideIn {
  to { opacity: 1; transform: translateX(0); }
}
@keyframes logoFadeUp {
  to { opacity: 1; transform: translateY(0); }
}
/* The wordmark is a pixel-perfect crop of the "zkTruth" text from the
   user's own brand PNG — no font fallback, no hand-tuned weights. */
.splash-wordmark {
  height: 52px;
  width: auto;
  display: block;
}

.splash-sub {
  margin-top: 12px;
  font-size: 11px;
  color: #000;
  letter-spacing: 3px;
  text-transform: uppercase;
  opacity: 0;
  font-weight: 700;
}
.splash.phase2 .splash-sub {
  animation: logoFadeUp 0.5s ease 0.5s forwards;
}

.splash-powered {
  position: absolute;
  bottom: 60px;
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 10px;
  color: #000;
  letter-spacing: 1px;
  opacity: 0;
  font-weight: 700;
}
.splash.phase2 .splash-powered {
  animation: logoFadeUp 0.4s ease 0.6s forwards;
}
.splash-pw-dot {
  width: 5px; height: 5px;
  border-radius: 50%;
  background: #00c864;
  box-shadow: 0 0 6px #00c864;
}
.splash-chain-dot {
  width: 5px; height: 5px;
  border-radius: 50%;
  background: #00c864;
  box-shadow: 0 0 8px #00c864;
}
`;

async function computeSHA256(data: string): Promise<string> {
  try {
    if (typeof crypto !== 'undefined' && crypto.subtle) {
      const encoder = new TextEncoder();
      const buffer = encoder.encode(data);
      const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      return '0x' + hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
    }
  } catch {}
  // Fallback: simple hash for non-secure contexts (HTTP)
  let hash = 0;
  for (let i = 0; i < Math.min(data.length, 10000); i++) {
    const chr = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + chr;
    hash |= 0;
  }
  const hex = Math.abs(hash).toString(16).padStart(8, '0');
  return '0x' + hex.repeat(8);
}
function generateHash() {
  return '0x' + Array.from({length: 64}, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('');
}
function generateTxHash() {
  return '0x' + Array.from({length: 40}, () => '0123456789abcdef'[Math.floor(Math.random() * 16)]).join('');
}
function getTimestamp() { return new Date().toISOString(); }

// Paint the zkTruth wordmark PNG centered on the canvas at low
// opacity — a passive watermark that survives cropping/re-sharing
// without competing with the actual capture content. Font matches
// the on-screen brand identity 1:1 because we're literally using the
// same PNG asset the splash screen uses.
function drawZkTruthWatermark(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  img: HTMLImageElement | null,
) {
  if (!img || !img.complete || !img.naturalWidth) return;
  ctx.save();
  ctx.globalAlpha = 0.22;
  // Target width ≈ 45% of the shorter edge so the wordmark reads on
  // both landscape and portrait captures without dominating either.
  const shortEdge = Math.min(w, h);
  const targetW = shortEdge * 0.55;
  const scale = targetW / img.naturalWidth;
  const drawW = img.naturalWidth * scale;
  const drawH = img.naturalHeight * scale;
  ctx.drawImage(img, (w - drawW) / 2, (h - drawH) / 2, drawW, drawH);
  ctx.restore();
}

// Paint a subtle CRT / broadcast-static texture over the current
// canvas contents. Deliberately restrained: horizontal scanlines at
// ~8% opacity, a light random-grain sprinkle, and a soft vignette so
// the corners fall off like an old tube TV. Called only when the user
// has explicitly opted in via `crtMode` — the default is a clean
// evidence-first look. Runs each drawFrame tick for video (so the
// noise animates), and once at capture time for stills.
function drawCrtOverlay(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  opts: { animateSeed?: number } = {},
) {
  // "Bad signal" video-glitch effect using a snapshot-then-reblit
  // pattern: we copy the current frame to an offscreen scratch
  // canvas, then paint horizontal SLICES of that scratch back onto
  // the main canvas at shifted X positions. Because reads and
  // writes never touch the same canvas at the same time, this
  // works reliably across browsers (self-blit is implementation-
  // defined and can silently fail — which was the earlier bug).
  //
  // Strips are chunky (~2–8% of frame height) and displaced up to
  // ±18% of frame width, so the tearing is impossible to miss but
  // the untouched parts of the frame stay clean.

  const seed = opts.animateSeed ?? Math.floor(Date.now() / 33);
  let s = (seed * 1103515245 + 12345) & 0x7fffffff;
  const rand = () => {
    s = (s * 1103515245 + 12345) & 0x7fffffff;
    return s / 0x7fffffff;
  };

  // 1. Snapshot the current canvas so we can safely read from it while
  //    we draw over the target.
  const snap = document.createElement('canvas');
  snap.width = w;
  snap.height = h;
  const snapCtx = snap.getContext('2d');
  if (!snapCtx) return;
  snapCtx.drawImage(ctx.canvas, 0, 0);

  // 2. Punch 1–2 tiny glitch strips per frame. User wants "just a
  //    hint" — a barely-perceptible slip that only draws the eye if
  //    you look for it.
  const stripCount = 1 + Math.floor(rand() * 2);
  for (let i = 0; i < stripCount; i++) {
    // Hair-thin strips: 0.3–1% of frame height.
    const stripH = Math.max(2, Math.floor(h * (0.003 + rand() * 0.007)));
    const y = Math.floor(rand() * (h - stripH));
    // Tiny shift: 0.8–3% of frame width.
    const shift = Math.floor((rand() < 0.5 ? -1 : 1) * w * (0.008 + rand() * 0.022));

    ctx.drawImage(snap, 0, y, w, stripH, shift, y, w, stripH);

    // 3. RGB ghost — 20% chance now, and very faint.
    if (rand() < 0.2) {
      const ghostShift = -Math.sign(shift || 1) * Math.floor(w * (0.005 + rand() * 0.015));
      ctx.save();
      ctx.globalAlpha = 0.14;
      ctx.globalCompositeOperation = 'lighter';
      ctx.drawImage(snap, 0, y, w, stripH, ghostShift, y, w, stripH);
      ctx.restore();
    }
  }
}

// Paint the zkTruth proof-of-capture overlays (top gradient, chat
// bubble + wordmark + LIVE pill + WORLD CHAIN pill, and the
// timestamp/GPS/chain/hash metadata block) onto a canvas that already
// has the capture frame drawn to it. Sizes and offsets scale off the
// canvas short-edge so the layout looks the same on a portrait 9:16
// canvas and a taller 9:19.5 phone-native canvas. Pulling this into
// a helper lets both the branded share card (finalImage) and the NFT
// capture use identical overlays without duplicating ~150 lines.
function drawZkTruthOverlays(
  ctx: CanvasRenderingContext2D,
  pw: number,
  ph: number,
  data: { timeStr: string; gps: string; hash: string },
) {
  // Scale factor keyed to canvas width — the original layout was
  // designed against a 1080-wide canvas, so `s` is 1.0 at that size
  // and grows/shrinks proportionally elsewhere.
  const s = pw / 1080;
  const padL = 44 * s;
  const topY = 100 * s;
  const bandH = 260 * s;

  // Semi-transparent gradient at top
  const topGrad = ctx.createLinearGradient(0, 0, 0, bandH);
  topGrad.addColorStop(0, 'rgba(0,0,0,0.7)');
  topGrad.addColorStop(1, 'transparent');
  ctx.fillStyle = topGrad;
  ctx.fillRect(0, 0, pw, bandH);

  // Chat-bubble icon (traced by hand — no roundRect on old Safari)
  ctx.globalAlpha = 1.0;
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 3 * s;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(padL + 28 * s, 94 * s);
  ctx.lineTo(padL + 28 * s, 74 * s);
  ctx.arcTo(padL + 28 * s, 66 * s, padL + 20 * s, 66 * s, 4 * s);
  ctx.lineTo(padL + 4 * s, 66 * s);
  ctx.arcTo(padL, 66 * s, padL, 70 * s, 4 * s);
  ctx.lineTo(padL, 90 * s);
  ctx.arcTo(padL, 94 * s, padL + 4 * s, 94 * s, 4 * s);
  ctx.lineTo(padL + 4 * s, 94 * s);
  ctx.lineTo(padL, 100 * s);
  ctx.lineTo(padL + 10 * s, 94 * s);
  ctx.lineTo(padL + 24 * s, 94 * s);
  ctx.arcTo(padL + 28 * s, 94 * s, padL + 28 * s, 90 * s, 4 * s);
  ctx.stroke();
  // Check mark inside the bubble
  ctx.strokeStyle = '#00c864';
  ctx.lineWidth = 3.5 * s;
  ctx.beginPath();
  ctx.moveTo(padL + 8 * s, 80 * s);
  ctx.lineTo(padL + 12 * s, 84 * s);
  ctx.lineTo(padL + 20 * s, 76 * s);
  ctx.stroke();

  // "zkTruth" wordmark
  ctx.globalAlpha = 1.0;
  ctx.font = `italic ${32 * s}px sans-serif`;
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  const zkW = ctx.measureText('zk').width;
  ctx.fillText('zk', padL + 36 * s, topY);
  ctx.font = `italic bold ${32 * s}px sans-serif`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText('Truth', padL + 36 * s + zkW, topY);
  const truthEnd = padL + 36 * s + zkW + ctx.measureText('Truth').width + 12 * s;

  // Rounded-rect helper — inlined here so this helper stays self-contained.
  const drawPill = (
    x: number, y: number, w: number, h: number, r: number,
  ) => {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.arcTo(x + w, y, x + w, y + r, r);
    ctx.lineTo(x + w, y + h - r);
    ctx.arcTo(x + w, y + h, x + w - r, y + h, r);
    ctx.lineTo(x + r, y + h);
    ctx.arcTo(x, y + h, x, y + h - r, r);
    ctx.lineTo(x, y + r);
    ctx.arcTo(x, y, x + r, y, r);
    ctx.closePath();
  };

  // LIVE badge (red pill)
  const liveX = truthEnd + 8 * s;
  const liveY = topY - 18 * s;
  const liveW = 72 * s;
  const liveH = 28 * s;
  ctx.fillStyle = '#ff3b5c';
  drawPill(liveX, liveY, liveW, liveH, 14 * s);
  ctx.fill();
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(liveX + 14 * s, liveY + 14 * s, 4 * s, 0, Math.PI * 2);
  ctx.fill();
  ctx.font = `bold ${14 * s}px monospace`;
  ctx.fillStyle = '#ffffff';
  ctx.fillText('LIVE', liveX + 24 * s, liveY + 19 * s);

  // WORLD CHAIN badge (top-right)
  const chainText = 'WORLD CHAIN';
  ctx.font = `${14 * s}px monospace`;
  const chainW = ctx.measureText(chainText).width + 24 * s;
  const chainX = pw - padL - chainW;
  const chainY = liveY;
  ctx.strokeStyle = 'rgba(0,200,255,0.5)';
  ctx.lineWidth = 1.5 * s;
  drawPill(chainX, chainY, chainW, liveH, 14 * s);
  ctx.stroke();
  ctx.fillStyle = 'rgba(0,200,255,0.1)';
  drawPill(chainX, chainY, chainW, liveH, 14 * s);
  ctx.fill();
  ctx.fillStyle = '#00c8ff';
  ctx.fillText(chainText, chainX + 12 * s, chainY + 19 * s);

  // Metadata rows
  const accentGreen = '#00ff87';
  const fontSize = 22 * s;
  const lineGap = 36 * s;
  const startY = 170 * s;

  ctx.font = `${fontSize}px monospace`;
  ctx.fillStyle = accentGreen;
  ctx.globalAlpha = 0.6;
  ctx.fillText('⏱ ' + data.timeStr, padL, startY);
  ctx.fillText('📍 ' + data.gps, padL, startY + lineGap);
  ctx.fillText('⛓ WORLD CHAIN READY', padL, startY + lineGap * 2);
  ctx.fillText('🔒 SHA-256: ' + data.hash.slice(0, 18) + '...', padL, startY + lineGap * 3);
  ctx.globalAlpha = 1.0;
}

// Grab the first drawable frame of a video Blob and encode it as a
// JPEG. Used to synthesise a static poster for video NFTs so wallets
// that only render `image` (not `animation_url`) still show the
// actual capture instead of the fallback logo. Returns null when the
// browser can't decode the video (e.g. codec unsupported).
// Probe a video Blob for its native pixel dimensions and duration.
// Telegram's sendVideo endpoint infers aspect ratio from the file's
// container header, but iOS Safari's MediaRecorder sometimes omits
// or mislabels the SPS, which makes Telegram fall back to 16:9 and
// vertically squash portrait clips. Passing width/height/duration
// explicitly forces the correct box in the channel preview.
//
// Returns null when the video can't be decoded (e.g. codec unsupported).
async function probeVideoMeta(video: Blob): Promise<{ width: number; height: number; duration: number } | null> {
  const url = URL.createObjectURL(video)
  try {
    return await new Promise<{ width: number; height: number; duration: number } | null>((resolve) => {
      const el = document.createElement('video')
      el.muted = true
      el.playsInline = true
      el.preload = 'metadata'
      el.src = url

      let done = false
      const finish = (v: { width: number; height: number; duration: number } | null) => {
        if (done) return
        done = true
        resolve(v)
      }

      const t = setTimeout(() => finish(null), 6000)
      el.addEventListener('loadedmetadata', () => {
        clearTimeout(t)
        const w = el.videoWidth
        const h = el.videoHeight
        // Duration can be Infinity on iOS for MediaRecorder-produced
        // MP4 headers; clamp to a sane default so Telegram doesn't
        // get a nonsense value.
        const d = Number.isFinite(el.duration) && el.duration > 0
          ? Math.round(el.duration)
          : 0
        if (!w || !h) return finish(null)
        finish({ width: w, height: h, duration: d })
      }, { once: true })
      el.addEventListener('error', () => { clearTimeout(t); finish(null) }, { once: true })
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

/**
 * Kicks off a background Vercel Blob upload for a freshly-captured
 * media file. Returned promise resolves when the upload is done — the
 * mint handler awaits it instead of running its own sync upload, so
 * on slow cellular connections the wallet popup opens near-instantly
 * because the 20-50 MB video was already uploading while the user
 * reviewed the confirm screen.
 *
 * Preheat runs OUTSIDE the mint critical path — errors here are
 * logged and re-thrown so the mint handler can fall back to a fresh
 * sync upload (which surfaces UX errors properly).
 */
async function preheatUploadMedia(
  hash: string,
  mediaBlob: Blob,
  ext: string,
): Promise<void> {
  const pathname = `captures/${hash}.${ext}`
  await upload(pathname, mediaBlob, {
    access: 'public',
    handleUploadUrl: '/api/upload/token',
    contentType: mediaBlob.type || undefined,
  })
}

async function preheatUploadPoster(
  hash: string,
  videoBlob: Blob,
): Promise<void> {
  const posterBlob = await extractFirstFrameJpeg(videoBlob, {
    timeStr: '',
    gps: '',
    hash,
  })
  if (!posterBlob) return
  await upload(`captures/${hash}.jpg`, posterBlob, {
    access: 'public',
    handleUploadUrl: '/api/upload/token',
    contentType: 'image/jpeg',
  })
}

async function extractFirstFrameJpeg(
  video: Blob,
  overlay?: { timeStr: string; gps: string; hash: string },
): Promise<Blob | null> {
  const url = URL.createObjectURL(video)
  try {
    return await new Promise<Blob | null>((resolve) => {
      const el = document.createElement('video')
      el.muted = true
      el.playsInline = true
      el.crossOrigin = 'anonymous'
      el.preload = 'auto'
      el.src = url

      let settled = false
      const done = (b: Blob | null) => {
        if (settled) return
        settled = true
        resolve(b)
      }

      // Bail out after 8s so a stuck decode doesn't wedge the mint UI.
      const timeout = setTimeout(() => done(null), 8000)

      const paintFrame = () => {
        try {
          const w = el.videoWidth
          const h = el.videoHeight
          if (!w || !h) return done(null)
          const canvas = document.createElement('canvas')
          canvas.width = w
          canvas.height = h
          const ctx = canvas.getContext('2d')
          if (!ctx) return done(null)
          ctx.drawImage(el, 0, 0, w, h)
          // Overlays intentionally NOT baked into the poster JPEG —
          // matches the photo NFT which is also unbranded now. The
          // `overlay` argument is retained for API compatibility with
          // older callers but the values are ignored.
          void overlay
          canvas.toBlob(
            (b) => {
              clearTimeout(timeout)
              done(b)
            },
            'image/jpeg',
            0.85,
          )
        } catch {
          clearTimeout(timeout)
          done(null)
        }
      }

      el.addEventListener('error', () => {
        clearTimeout(timeout)
        done(null)
      })
      // `seeked` fires after we jump into the first real frame — many
      // codecs deliver a black/garbage frame at t=0, so nudging a tick
      // forward gives a cleaner poster.
      el.addEventListener('seeked', paintFrame, { once: true })
      el.addEventListener('loadeddata', () => {
        try {
          el.currentTime = Math.min(0.1, (el.duration || 1) * 0.1)
        } catch {
          paintFrame()
        }
      }, { once: true })
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

const MINT_STEPS = [
  { label: "Verifying SHA-256 hash…", progress: 20 },
  { label: "Building metadata…", progress: 45 },
  { label: "Signing transaction…", progress: 65 },
  { label: "Broadcasting to chain…", progress: 85 },
  { label: "NFT minted ✓", progress: 100 },
];

export default function Home() {
  // Initialise the Telegram Mini App runtime: expand to full height,
  // paint the Telegram header background to match our dark canvas,
  // disable accidental swipe-to-close, and request true fullscreen
  // where supported. Fixes the "UI shoved down" difference between
  // OPEN-button vs Menu-Button launches.
  useTelegramExpand();
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const openConnectModal = () => { alert('Wallet connect coming soon'); };
  const [splashPhase, setSplashPhase] = useState(0);
  const [screen, setScreen] = useState("camera");
  const [cameraReady, setCameraReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [flash, setFlash] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  // Trust Score for the currently-connected TON wallet. Fetched on
  // connect + refreshed after every successful mint / poll tick so the
  // sidebar chip always reflects the freshest number.
  const [trustScore, setTrustScore] = useState<{
    score: number
    tier: 'Source' | 'Whistleblower' | 'Muckraker' | 'Investigative Reporter' | 'Truth-Teller'
    emoji: string
    posts: number
    mints: number
    reactionsTotal: number
    hasMinted: boolean
  } | null>(null);
  const [trustRefreshCount, setTrustRefreshCount] = useState(0);
  const [trustProfileOpen, setTrustProfileOpen] = useState(false);
  // Tier-up celebration. When the profile modal opens and the current
  // tier is higher than the last-seen tier saved for this wallet, we
  // show a full-screen animation (PromotionOverlay) once. Persisted
  // per-wallet in localStorage so it never fires twice for the same
  // promotion, even if the user closes and reopens the profile.
  const [promotion, setPromotion] = useState<{ from: TrustTierType; to: TrustTierType } | null>(null);
  // Weekly leaderboard modal: shows top 50 by ranking score + current
  // reward pool + countdown to next payout. Fetched from /api/leaderboard/current
  // on open.
  const [leaderboardOpen, setLeaderboardOpen] = useState(false);
  const [leaderboard, setLeaderboard] = useState<{
    epochId: string
    poolTon: number
    mintCount: number
    nextPayoutMs: number
    rows: Array<{
      rank: number
      wallet: string
      rankingScore: number
      allTimeScore: number
      tier: TrustTierType
      emoji: string
      weeklyPosts: number
      weeklyMints: number
      weeklyReactions: number
      payoutShare: number
      payoutTon: number
      eligibleForPayout?: boolean
      payoutRank?: number | null
    }>
    minMintsForPayout?: number
    payoutSlots?: number
  } | null>(null);
  useEffect(() => {
    if (!leaderboardOpen) return
    let cancelled = false
    ;(async () => {
      try {
        const r = await fetch('/api/leaderboard/current?t=' + Date.now(), { cache: 'no-store' })
        if (!r.ok) return
        const j = await r.json()
        if (!cancelled) setLeaderboard(j)
      } catch { /* offline */ }
    })()
    return () => { cancelled = true }
  }, [leaderboardOpen]);
  const [mintStep, setMintStep] = useState(0);
  const [mintComplete, setMintComplete] = useState(false);
  const [proofData, setProofData] = useState<any>(null);
  const [txHash, setTxHash] = useState<string | null>(null);
  const [now, setNow] = useState("");
  const [simMode, setSimMode] = useState(true);
  const [captureMode, setCaptureMode] = useState<"photo"|"video">("photo");
  const [recording, setRecording] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [worldIdVerifying, setWorldIdVerifying] = useState(false);
  const [worldIdError, setWorldIdError] = useState<string | null>(null);
  const [worldIdVerified, setWorldIdVerified] = useState(false);
  const [worldIdNullifier, setWorldIdNullifier] = useState<string | null>(null);
  const [mintMode, setMintMode] = useState("verified");
  const [snsFromScreen, setSnsFromScreen] = useState("share");
  const [copyStatus, setCopyStatus] = useState("");
  // "POST TO CHANNEL + X" flow status. We show this on the button
  // itself so the user sees why nothing is happening while we wait
  // for the Blob preheat upload to finish — that upload has to be
  // done BEFORE we hand X the /proof URL or the tweet renders a
  // blank card.
  const [xPostingStatus, setXPostingStatus] = useState<'idle' | 'posting'>('idle');
  // Ephemeral toast for the SHARE flow. Renders as a floating message
  // over the wid-share screen so the user knows whether the image
  // attached to the share sheet, whether text landed on the clipboard,
  // or whether we fell through to the download fallback.
  const [shareStatus, setShareStatus] = useState("");
  // In-flight indicator for the share/post-to-channel flow. Drives the
  // full-screen overlay + button spinner so the user gets visible
  // feedback that something is happening — a small toast alone was
  // too easy to miss.
  const [sharing, setSharing] = useState(false);
  // Success state — briefly renders a big green check overlay right
  // after a successful post so the outcome reads as "done!" rather
  // than just the toast fading out.
  const [shareSuccess, setShareSuccess] = useState(false);
  // Privacy notice modal — surfaced by the small "i" button in the
  // camera side-panel so users can review what actually gets shared
  // (public channel, GPS, wallet, etc.) before they hit SHARE.
  const [privacyOpen, setPrivacyOpen] = useState(false);
  // Telegram post URL captured after a successful SIGN THIS HASH
  // channel post — we forward its message_id into the on-chain mint
  // so the NFT record on TON can be traced back to the exact channel
  // message that carries the raw media.
  const [lastTelegramPostUrl, setLastTelegramPostUrl] = useState<string | null>(null);
  // In-flight indicator for the TON Connect mint round-trip so the
  // SIGN & MINT button can show a spinner and disable itself while
  // the wallet is signing.
  const [minting, setMinting] = useState(false);
  // Wall-clock ms when the current mint attempt started. Used to
  // decide when to surface a "Mint sent — continue" escape hatch on
  // the confirm-tx screen. TON Connect's sendTransaction promise can
  // hang indefinitely on iOS if the wallet's return-URL back into
  // the Mini App gets lost (Telegram → Tonkeeper/Gram → Telegram
  // handoff drops the tonconnect response on some carriers), leaving
  // the user stuck on "AWAITING WALLET..." even though the mint is
  // already on-chain. When mintingStartedAt is more than 15s in the
  // past we show a manual continue button so the user can move on
  // to the share screen without reloading.
  const [mintingStartedAt, setMintingStartedAt] = useState<number | null>(null);
  const [mintTakingLong, setMintTakingLong] = useState(false);
  // 15-second timer: once the mint has been in-flight this long
  // without resolving, surface the manual continue escape hatch.
  useEffect(() => {
    if (!minting || !mintingStartedAt) { setMintTakingLong(false); return }
    const remaining = Math.max(0, 15000 - (Date.now() - mintingStartedAt))
    const t = setTimeout(() => setMintTakingLong(true), remaining)
    return () => clearTimeout(t)
  }, [minting, mintingStartedAt]);
  // Blur-brush editor state used inside the replay modal. When
  // blurMode is on, drag gestures on the canvas paint blurred
  // circles over the underlying image (drawn by copying pixels from
  // a pre-blurred hidden canvas). blurDirty tracks whether the user
  // has actually painted anything, so we only offer SAVE when there
  // are changes to commit back to `capturedImage`.
  const [blurMode, setBlurMode] = useState(false);
  const [blurDirty, setBlurDirty] = useState(false);
  const blurCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const blurredSourceRef = useRef<HTMLCanvasElement | null>(null);
  const blurOriginalRef = useRef<HTMLImageElement | null>(null);
  const blurIsDrawingRef = useRef(false);
  // On-screen recorder diagnostics for debugging audio capture on devices
  // where we don't have access to a JS console (e.g., iPhone Safari).
  const [recordDebug, setRecordDebug] = useState<string>("");
  // Replay overlay state — opens the recorded clip with audio in an
  // in-app modal so the user can dismiss back to the worldid screen
  // (the previous "open in new tab" path made iOS Safari swallow the
  // tab and there was no obvious way back to the verify flow).
  const [replayOpen, setReplayOpen] = useState(false);
  // Free-form user comment attached to the capture (displayed on the
  // verify screen as the dominant input above the action buttons).
  const [captureComment, setCaptureComment] = useState("");

  // Snapshot key for localStorage. World App's auto-redirect after
  // verification re-loads the page in a fresh tab, dropping React state.
  // We snapshot enough of the flow's progress to land the user back on
  // the screen they were on, instead of the camera.
  const SNAPSHOT_KEY = 'zktruth_flow_snapshot_v1';
  // Time-to-live for the snapshot, in milliseconds. The snapshot only
  // exists to bridge the few seconds between the World-App auto-redirect
  // and Safari refocusing/reloading our page; if the user comes back via
  // a fresh URL hit hours or days later, the snapshot should be ignored
  // and we should boot into the normal splash → camera flow.
  const SNAPSHOT_TTL_MS = 5 * 60 * 1000; // 5 minutes

  // Restore snapshot on first mount. Uses a one-shot ref so React's strict
  // mode double-invocation doesn't double-restore.
  const restoredRef = useRef(false);
  useEffect(() => {
    if (restoredRef.current) return;
    restoredRef.current = true;
    if (typeof window === 'undefined') return;
    try {
      const raw = localStorage.getItem(SNAPSHOT_KEY);
      if (!raw) return;
      const snap = JSON.parse(raw) as {
        screen?: string;
        proofData?: unknown;
        worldIdVerified?: boolean;
        worldIdNullifier?: string | null;
        mintMode?: string;
        capturedImage?: string | null;
        savedAt?: number;
      };
      // TTL gate — old snapshots are discarded so a stale flow doesn't
      // hijack a brand-new visit.
      if (typeof snap.savedAt !== 'number' || Date.now() - snap.savedAt > SNAPSHOT_TTL_MS) {
        localStorage.removeItem(SNAPSHOT_KEY);
        return;
      }
      if (snap.proofData) setProofData(snap.proofData);
      if (snap.capturedImage) setCapturedImage(snap.capturedImage);
      if (snap.worldIdVerified) setWorldIdVerified(true);
      if (snap.worldIdNullifier) setWorldIdNullifier(snap.worldIdNullifier);
      if (snap.mintMode) setMintMode(snap.mintMode);
      // Drive the user back to the share screen if we got far enough,
      // otherwise the world-id screen so they can re-verify.
      if (snap.worldIdVerified && snap.proofData) {
        setScreen('share');
      } else if (snap.proofData) {
        setScreen('worldid');
      }
    } catch {
      // ignore parse errors; treat as no snapshot
    }
  }, []);

  // Persist the key bits of state every time they change. Skipped on the
  // very first mount because we have nothing meaningful yet.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!proofData && !worldIdVerified) return;
    try {
      const snap = {
        screen,
        proofData,
        worldIdVerified,
        worldIdNullifier,
        mintMode,
        capturedImage,
        // Saved-at so the restore path above can age it out.
        savedAt: Date.now(),
      };
      localStorage.setItem(SNAPSHOT_KEY, JSON.stringify(snap));
    } catch {
      // localStorage may be full or disabled — best-effort
    }
  }, [screen, proofData, worldIdVerified, worldIdNullifier, mintMode, capturedImage]);

  const [facingMode, setFacingMode] = useState<"environment"|"user">("environment");
  const [zoomLevel, setZoomLevel] = useState(0.5);
  const [gpsCoords, setGpsCoords] = useState<string>("Acquiring GPS…");
  const [gpsLocation, setGpsLocation] = useState<string>("");
  // User-facing switch that lets people opt out of location entirely
  // — the geolocation watcher below is gated on this, and downstream
  // capture/share code already treats an "Acquiring GPS…"-style
  // placeholder as "no location" so nothing GPS-derived leaks into
  // the Telegram caption when the toggle is off.
  //
  // Default OFF: previously true, which triggered the browser's
  // location-permission bubble the instant the Mini App opened —
  // startling users who hadn't done anything yet. Now the watcher
  // stays cold until the user explicitly taps the GPS button, and
  // that tap is the same gesture that consents to the permission.
  const [gpsEnabled, setGpsEnabled] = useState<boolean>(false);
  // CRT / broadcast-noise stylisation. Off by default because Proof of
  // Capture's core promise is legibility — evidence you can't read isn't
  // evidence. Users who want the aesthetic can flip it on from the side
  // panel; the choice persists across sessions via localStorage so we
  // don't nag them about it every time the Mini App reloads.
  const [crtMode, setCrtMode] = useState<boolean>(false);
  useEffect(() => {
    try {
      const v = localStorage.getItem('zktruth.crtMode');
      if (v === '1') setCrtMode(true);
    } catch { /* private mode / disabled storage — stay off */ }
  }, []);
  useEffect(() => {
    try { localStorage.setItem('zktruth.crtMode', crtMode ? '1' : '0'); }
    catch { /* ignore */ }
  }, [crtMode]);

  // Gas fee shown as Gram (per Durov's Gram wallet rebrand) — the
  // chain itself is still TON L1, but the native currency label
  // surfaced to users is "Gram". Placeholder until the Tact contract
  // is deployed and we can compute the real fee estimate.
  const TON_GAS_FEE = "0.01 Gram";

  // Smart contract hooks
  // Cast to string so TS doesn't narrow the literal type and complain that the
  // comparison can never be false (Production build via Turbopack is strict).
  const isContractDeployed = (ZKTRUTH_CONTRACT_ADDRESS as string) !== "0x0000000000000000000000000000000000000000";
  const { mint: mintVerified, txHash: verifiedTxHash, isPending: isVerifiedPending, isConfirming: isVerifiedConfirming, isSuccess: isVerifiedSuccess } = useMintVerifiedProof();
  const { mint: mintUnverified, txHash: unverifiedTxHash, isPending: isUnverifiedPending, isConfirming: isUnverifiedConfirming, isSuccess: isUnverifiedSuccess } = useMintUnverifiedProof();
  const [onchainMinting, setOnchainMinting] = useState(false);


  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const recordedChunksRef = useRef<Blob[]>([]);
  const recCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const recAnimFrameRef = useRef<number | null>(null);
  // Overlay metadata snapshot taken at record-start. Used both by the
  // recording drawFrame loop (to paint the badges every tick) and by
  // recorder.onstop (to lock the SAME values into proofData so the
  // NFT metadata matches the on-clip watermark exactly).
  const recOverlayRef = useRef<{
    timestamp: string;
    hash: string;
    gps: string;
    timeStr: string;
  } | null>(null);
  // Preloaded wordmark image used as the centered semi-transparent
  // watermark on every capture. Loaded once on mount so we never pay
  // decode latency inside the draw loops. Kept in a ref (not state)
  // because the load doesn't need to trigger re-renders.
  const wordmarkRef = useRef<HTMLImageElement | null>(null);
  useEffect(() => {
    const img = new window.Image();
    img.src = '/splash-wordmark.png';
    img.onload = () => { wordmarkRef.current = img; };
  }, []);
  // Raw sensor-frame JPEG (data URL) captured at native resolution for
  // NFT upload. Populated on photo capture; cleared on reset. We keep
  // it in a ref rather than state because the mint flow reads it once
  // at click-time and doesn't need to trigger re-renders.
  const rawImageForNftRef = useRef<string | null>(null);
  // Background upload preheater. As soon as a capture finishes, the
  // capture handler kicks off the Blob upload here so it runs in
  // parallel with the user reviewing the confirm screen. When they
  // finally hit MINT, handleConfirmTx awaits this promise instead of
  // starting a fresh upload — huge win on slow cellular where the
  // upload used to sit on the wallet-open critical path.
  const preheatUploadRef = useRef<{
    hash: string
    mediaPromise: Promise<void>
    posterPromise: Promise<void> | null
  } | null>(null);
  const kickPreheatUpload = useCallback((
    hash: string,
    mediaBlob: Blob,
    ext: string,
  ) => {
    if (preheatUploadRef.current?.hash === hash) return
    const isVideo = /^video\//i.test(mediaBlob.type)
    const mediaPromise = preheatUploadMedia(hash, mediaBlob, ext)
    // Silence unhandled-rejection console noise; the mint handler
    // catches errors when it awaits the promise.
    mediaPromise.catch((err) => console.warn('[preheat] media', err))
    const posterPromise = isVideo
      ? preheatUploadPoster(hash, mediaBlob).catch((err) => {
          console.warn('[preheat] poster', err)
        })
      : null
    preheatUploadRef.current = { hash, mediaPromise, posterPromise }
  }, []);
  // AudioContext lives only for the duration of a single recording so it
  // doesn't leak resources or hold the mic open longer than needed.
  const audioCtxRef = useRef<AudioContext | null>(null);
  const [capturedVideo, setCapturedVideo] = useState<Blob | null>(null);
  const [capturedVideoUrl, setCapturedVideoUrl] = useState<string | null>(null);

  useEffect(() => {
    // If we're returning from a World App auto-redirect, the snapshot will
    // restore us to the share screen. The splash animation in that case is
    // pure friction — jump straight to its end state so the user lands on
    // the share screen immediately. Only skips for FRESH snapshots
    // (within SNAPSHOT_TTL_MS) so that returning to the URL hours later
    // shows the normal splash → camera intro again.
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(SNAPSHOT_KEY);
        if (raw) {
          const snap = JSON.parse(raw) as { proofData?: unknown; worldIdVerified?: boolean; savedAt?: number };
          const fresh = typeof snap?.savedAt === 'number' && Date.now() - snap.savedAt <= SNAPSHOT_TTL_MS;
          if (fresh && (snap?.proofData || snap?.worldIdVerified)) {
            setSplashPhase(4);
            return;
          }
        }
      } catch { /* fall through to normal splash */ }
    }
    setSplashPhase(1);
    const t1 = setTimeout(() => setSplashPhase(2), 1700);
    const t2 = setTimeout(() => setSplashPhase(3), 3800);
    const t3 = setTimeout(() => setSplashPhase(4), 4400);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);

  useEffect(() => {
    setNow(new Date().toISOString());
    const t = setInterval(() => setNow(new Date().toISOString()), 1000);
    return () => clearInterval(t);
  }, []);



  useEffect(() => {
    if (!gpsEnabled) {
      // Location disabled by the user — clear any previously-seen
      // reading so the HUD reflects the off state and downstream
      // capture code doesn't attach stale coords to a post.
      setGpsCoords("GPS OFF");
      setGpsLocation("");
      return;
    }
    let reverseGeocodeDone = false;
    if (navigator.geolocation) {
      setGpsCoords("Acquiring GPS…");
      const watchId = navigator.geolocation.watchPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lon = pos.coords.longitude;
          setGpsCoords(`${lat.toFixed(4)}° N, ${lon.toFixed(4)}° E`);
          // Reverse geocode once to get location name
          if (!reverseGeocodeDone) {
            reverseGeocodeDone = true;
            fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json&accept-language=en&zoom=10`)
              .then(r => r.json())
              .then(data => {
                const addr = data?.address;
                if (addr) {
                  const parts: string[] = [];
                  const state = addr.state || addr.province || addr.region || '';
                  const country = addr.country || '';
                  if (state) parts.push(state);
                  if (country) parts.push(country);
                  setGpsLocation(parts.join(', '));
                }
              })
              .catch(() => {});
          }
        },
        () => setGpsCoords("GPS unavailable"),
        { enableHighAccuracy: true, timeout: 10000 }
      );
      return () => navigator.geolocation.clearWatch(watchId);
    } else {
      setGpsCoords("GPS not supported");
    }
  }, [gpsEnabled]);

  // Pick a specific back-camera lens by enumerating devices. iOS Safari exposes
  // labels like "Back Ultra Wide Camera", "Back Camera", "Back Telephoto Camera"
  // once camera permission has been granted at least once. We match by regex.
  const findBackCameraDeviceId = useCallback(async (which: "ultrawide"|"wide"|"tele"): Promise<string | null> => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videos = devices.filter(d => d.kind === "videoinput");
      const matchers: Record<typeof which, RegExp> = {
        ultrawide: /ultra.?wide|0\.5/i,
        wide: /^back(?!.*(ultra|tele))|^rear(?!.*(ultra|tele))|back camera$/i,
        tele: /tele(photo)?|2x|3x/i,
      };
      const hit = videos.find(d => matchers[which].test(d.label));
      return hit?.deviceId ?? null;
    } catch {
      return null;
    }
  }, []);

  // Whether the back camera has been swapped to the ultra-wide device. We track
  // this so we know to swap back to the main lens when the user picks 1x or
  // higher. iOS Safari ≥17 also lets us drive the swap via a unified `zoom`
  // constraint on the composite "Back Camera" device — we try that first.
  const [isUltraWide, setIsUltraWide] = useState(false);
  // Front camera FOV mode. iOS exposes a single front lens but switching the
  // requested aspect ratio coaxes a wider sensor crop out of it.
  const [isFrontWide, setIsFrontWide] = useState(false);

  const startCamera = useCallback(async (facing?: "environment"|"user", opts?: { deviceId?: string; frontWide?: boolean; audio?: boolean }) => {
    try {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(t => t.stop());
      }
      let video: MediaTrackConstraints;
      if (opts?.deviceId) {
        video = { deviceId: { exact: opts.deviceId }, width: { ideal: 1920 }, height: { ideal: 1440 } };
      } else if ((facing || facingMode) === "user" && opts?.frontWide) {
        video = { facingMode: "user", width: { ideal: 1920 }, height: { ideal: 1440 }, aspectRatio: { ideal: 4 / 3 } };
      } else {
        video = { facingMode: facing || facingMode, width: { ideal: 1080 }, height: { ideal: 1920 } };
      }
      // Request the microphone alongside the camera ONLY when the
      // user is in video mode. Photo mode never needs audio, so
      // asking for it on Mini App open triggered a "camera and
      // microphone" permission dialog that scared users off before
      // they'd done anything. Requesting audio only when the user
      // explicitly switches to video mode makes the initial popup
      // camera-only and matches actual usage. Use a bare `audio:
      // true` rather than a constraints object — iOS Safari honours
      // the simpler form more reliably (a constraints object with
      // echoCancellation/noiseSuppression succeeded but the resulting
      // audio track was silently dropped by the mp4 encoder).
      // Audio inclusion: explicit `opts.audio` wins (so callers can
      // force-request it in response to a user gesture like tapping
      // the VIDEO mode tab), otherwise mirror the current capture
      // mode. Photo mode → no audio → camera-only permission dialog
      // on first open.
      const wantAudio = opts?.audio ?? captureMode === 'video';
      const constraints: MediaStreamConstraints = {
        video,
        audio: wantAudio,
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        videoRef.current.setAttribute('webkit-playsinline', 'true');
        // Mute the live preview so the user doesn't hear feedback /
        // echo through the speaker. The audio track stays on the stream
        // and is still picked up by MediaRecorder for the saved clip.
        videoRef.current.muted = true;
        try { await videoRef.current.play(); } catch { /* Safari autoplay policy */ }
        setCameraReady(true);
        setSimMode(false);
      }
    } catch {
      setSimMode(true);
    }
  }, [facingMode]);

  const flipCamera = useCallback(async () => {
    const next = facingMode === "environment" ? "user" : "environment";
    setFacingMode(next);
    setZoomLevel(0.5);
    setIsUltraWide(false);
    setIsFrontWide(false);

    // Whichever camera we land on, immediately apply our single wide mode so
    // the user never has to pick a zoom level. handleZoom's closure has the
    // stale facingMode, so we inline the per-camera logic here.
    if (next === "user") {
      await startCamera("user", { frontWide: true });
      setIsFrontWide(true);
      return;
    }
    await startCamera("environment");
    const track = streamRef.current?.getVideoTracks()[0];
    const caps = (track as any)?.getCapabilities?.();
    if (track && caps?.zoom && (caps.zoom.min ?? 1) < 1) {
      try {
        await track.applyConstraints({ advanced: [{ zoom: caps.zoom.min } as any] });
        return;
      } catch { /* fall through */ }
    }
    const uwId = await findBackCameraDeviceId("ultrawide");
    if (uwId) {
      await startCamera("environment", { deviceId: uwId });
      setIsUltraWide(true);
    }
  }, [facingMode, startCamera, findBackCameraDeviceId]);

  const handleZoom = useCallback(async (level: number) => {
    setZoomLevel(level);

    // -------- FRONT CAMERA --------
    if (facingMode === "user") {
      const wantWide = level < 1;
      if (wantWide !== isFrontWide) {
        await startCamera("user", { frontWide: wantWide });
        setIsFrontWide(wantWide);
      }
      return;
    }

    // -------- BACK CAMERA, WIDE (< 1x) --------
    if (level < 1) {
      // Path A: iOS 17+ unified device — apply zoom < 1 directly.
      const track = streamRef.current?.getVideoTracks()[0];
      const caps = (track as any)?.getCapabilities?.();
      if (track && caps?.zoom && (caps.zoom.min ?? 1) < 1) {
        try {
          await track.applyConstraints({ advanced: [{ zoom: caps.zoom.min } as any] });
          return;
        } catch { /* fall through */ }
      }
      // Path B: explicit ultra-wide deviceId switch (older iOS / split devices).
      if (!isUltraWide) {
        const id = await findBackCameraDeviceId("ultrawide");
        if (id) {
          await startCamera("environment", { deviceId: id });
          setIsUltraWide(true);
        }
      }
      return;
    }

    // -------- BACK CAMERA, 1x AND ABOVE --------
    // Restore the main lens if we'd swapped to ultra-wide.
    if (isUltraWide) {
      const id = await findBackCameraDeviceId("wide");
      if (id) {
        await startCamera("environment", { deviceId: id });
      } else {
        await startCamera("environment");
      }
      setIsUltraWide(false);
    }
    const track = streamRef.current?.getVideoTracks()[0];
    const caps = (track as any)?.getCapabilities?.();
    if (track && caps?.zoom) {
      const min = caps.zoom.min || 1;
      const max = caps.zoom.max || 10;
      const nativeZoom = Math.min(Math.max(level, min), max);
      track.applyConstraints({ advanced: [{ zoom: nativeZoom } as any] }).catch(() => {});
    }
  }, [facingMode, isUltraWide, isFrontWide, findBackCameraDeviceId, startCamera]);

  // CSS scale on the <video> tag. Sub-1x is achieved by the lens/aspect switch
  // above, so the on-screen scale stays at 1 for wide. 1x+ uses CSS as a backup
  // for devices without hardware zoom.
  const displayScale = Math.max(zoomLevel, 1);

  useEffect(() => {
    if (screen === "camera") {
      // Small delay to ensure video element is mounted in DOM
      const timer = setTimeout(async () => {
        if (streamRef.current && videoRef.current) {
          // Reconnect existing stream to new video element
          videoRef.current.srcObject = streamRef.current;
          videoRef.current.setAttribute('playsinline', 'true');
          videoRef.current.play().catch(() => {});
          setCameraReady(true);
          setSimMode(false);
        } else {
          // No existing stream, start fresh — then immediately switch to the
          // ultra-wide lens / 4:3 front-wide mode so the user always opens to
          // the widest available FOV (the only zoom option in the UI now).
          await startCamera(facingMode);
          handleZoom(0.5);
        }
      }, 100);
      return () => clearTimeout(timer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen]);

  // Cleanup stream on unmount
  useEffect(() => {
    return () => { streamRef.current?.getTracks().forEach(t => t.stop()); };
  }, []);

  // Manage video URL lifecycle
  useEffect(() => {
    if (capturedVideo) {
      const url = URL.createObjectURL(capturedVideo);
      setCapturedVideoUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setCapturedVideoUrl(null);
    }
  }, [capturedVideo]);

  const startMinting = useCallback(async () => {
    if (isContractDeployed && proofData && isConnected) {
      // Real on-chain minting
      try {
        setOnchainMinting(true);
        setMintStep(0);
        const contentHash = proofData.hash as `0x${string}`;
        const gpsHash = toBytes32Hash(proofData.gps || "0,0");
        const captureTimestamp = BigInt(Math.floor(new Date(proofData.timestamp).getTime() / 1000));
        const mediaType = proofData.type === "video" ? 1 : 0;

        if (mintMode === "verified" && worldIdNullifier) {
          const nullifierHash = worldIdNullifier as `0x${string}`;
          await mintVerified({ contentHash, gpsHash, nullifierHash, captureTimestamp, mediaType });
        } else {
          await mintUnverified({ contentHash, gpsHash, captureTimestamp, mediaType });
        }
      } catch (e) {
        console.error("Mint error:", e);
        setOnchainMinting(false);
      }
    } else {
      // Simulated minting (contract not deployed yet)
      let step = 0;
      const interval = setInterval(() => {
        step++;
        setMintStep(step);
        if (step >= MINT_STEPS.length - 1) {
          clearInterval(interval);
          setTxHash(generateTxHash());
          setTimeout(() => setMintComplete(true), 500);
        }
      }, 600);
    }
  }, [isContractDeployed, proofData, isConnected, mintMode, worldIdNullifier, mintVerified, mintUnverified]);

  // Watch for on-chain mint confirmation
  useEffect(() => {
    if (onchainMinting) {
      if (isVerifiedPending || isUnverifiedPending) {
        setMintStep(1); // Signing transaction
      }
      if (isVerifiedConfirming || isUnverifiedConfirming) {
        setMintStep(3); // Broadcasting to chain
      }
      if (isVerifiedSuccess || isUnverifiedSuccess) {
        const hash = verifiedTxHash || unverifiedTxHash;
        setTxHash(hash || generateTxHash());
        setMintStep(4); // NFT minted
        setOnchainMinting(false);
        setTimeout(() => setMintComplete(true), 500);
      }
    }
  }, [onchainMinting, isVerifiedPending, isUnverifiedPending, isVerifiedConfirming, isUnverifiedConfirming, isVerifiedSuccess, isUnverifiedSuccess, verifiedTxHash, unverifiedTxHash]);

  const handleCapture = useCallback(async () => {
    if (capturing) return;
    setCapturing(true);
    setFlash(true);
    setTimeout(() => setFlash(false), 150);
    try {
      const ts = getTimestamp();
      const timeStr = ts.replace('T',' ').split('.')[0] + ' UTC';
      const gps = gpsCoords;
      let finalImage: string | null = null;
      // Clean, overlay-free JPEG cropped to match the on-screen
      // preview's aspect ratio. This is what the NFT will carry so
      // the wallet tile shows *exactly* what the user framed — same
      // FOV, same portrait shape, no zkTruth watermark badges.
      let rawImage: string | null = null;
      let hash = generateHash();

      if (cameraReady && videoRef.current) {
        const v = videoRef.current;
        const vw = v.videoWidth || 1080;
        const vh = v.videoHeight || 1920;

        // Create a temporary canvas for raw capture + hash
        const tmpC = document.createElement('canvas');
        tmpC.width = vw; tmpC.height = vh;
        const tmpCtx = tmpC.getContext('2d');
        if (tmpCtx) {
          tmpCtx.drawImage(v, 0, 0, vw, vh);
          const rawData = tmpC.toDataURL('image/jpeg', 0.8);
          hash = await computeSHA256(rawData);
        }

        // ---- NFT-facing capture (SQUARE 1:1) ----
        // The wallet tiles that show NFTs are square, and portrait
        // captures used to letterbox awkwardly next to other people's
        // square art. We now center-crop the source stream into a
        // 1080×1080 canvas — this same square is used for both the
        // NFT upload AND the preview / Telegram share, so everything
        // downstream stays visually consistent with a wallet gallery.
        try {
          const NFT_EDGE = 1080;
          const nftC = document.createElement('canvas');
          nftC.width = NFT_EDGE;
          nftC.height = NFT_EDGE;
          const nftCtx = nftC.getContext('2d');
          if (nftCtx) {
            // Match the preview FOV: the on-screen video reads sensor
            // pixels through object-fit:cover *plus* an optional CSS
            // transform:scale(displayScale). If we ignored those and
            // just cover-cropped the raw sensor to a square (the old
            // behaviour) the NFT would show a WIDER angle than the
            // guide box the user framed against — noticeably wrong
            // once they compare capture vs preview side-by-side.
            //
            // The square guide occupies a `Vw × Vw` box centered in
            // the video element. Back-projecting that through the two
            // scales gives the exact sensor rectangle to sample.
            const rectV = v.getBoundingClientRect();
            const Vw = rectV.width || vw;
            const Vh = rectV.height || vh;
            const baseScale = Math.max(Vw / vw, Vh / vh);
            const totalScale = baseScale * displayScale;
            const sideRaw = Vw / totalScale;
            // Guard: if displayScale is very small the computed side
            // could overshoot the sensor. Clamp to the shorter sensor
            // dimension so we never read outside the frame.
            const side = Math.min(sideRaw, vw, vh);
            const sx = (vw - side) / 2;
            const sy = (vh - side) / 2;
            nftCtx.drawImage(v, sx, sy, side, side, 0, 0, NFT_EDGE, NFT_EDGE);
            if (crtMode) drawCrtOverlay(nftCtx, NFT_EDGE, NFT_EDGE);
            // Keep the semi-transparent centered zkTruth wordmark as a
            // brand mark on the NFT / preview / Telegram share. The
            // detailed proof overlays (timestamp / GPS / hash badges
            // in the corners) were stripped 2026-09 to keep the tile
            // reading as a plain photo — the on-screen viewfinder DOM
            // still shows those values as a shooting aid, and the
            // NFT's attributes JSON continues to carry them off-image.
            drawZkTruthWatermark(nftCtx, NFT_EDGE, NFT_EDGE, wordmarkRef.current);
            rawImage = nftC.toDataURL('image/jpeg', 0.9);
            // Unify: capturedImage (used by preview + Telegram post)
            // becomes the SAME square. This drops the old branded
            // 9:16 share card in favour of one square that reads
            // consistently everywhere.
            finalImage = rawImage;
          }
        } catch {
          // If anything above trips, we leave rawImage null and fall
          // back to the (possibly-still-null) branded card below.
        }

        // Create portrait (9:16) canvas with watermark
        // Legacy branded 9:16 share card removed 2026-09 — the square
        // rawImage above now serves as both the NFT payload and the
        // Telegram share tile, so we no longer generate a separate
        // portrait card. Keeps the flow simpler and prevents wallet
        // tiles from looking off-shape next to other square NFTs.
      }

      // Stash the raw frame in a ref so handleConfirmTx can upload it
      // for the NFT (without the 9:16 crop / overlays baked into
      // finalImage that we use for Telegram sharing).
      rawImageForNftRef.current = rawImage;

      // Kick the Blob upload in the background NOW so it's mostly done
      // by the time the user hits MINT. Convert the data URL to a Blob
      // once here — the sync mint path also decodes it, but preheat
      // beats it to the punch on cellular.
      try {
        const normHash = normaliseHashHex(hash)
        const rawForPreheat = rawImage
        if (normHash && rawForPreheat && rawForPreheat.startsWith('data:')) {
          const commaIdx = rawForPreheat.indexOf(',')
          const mime = /data:([^;]+)/.exec(rawForPreheat.slice(0, commaIdx))?.[1] || 'image/jpeg'
          const bin = atob(rawForPreheat.slice(commaIdx + 1))
          const bytes = new Uint8Array(bin.length)
          for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
          const photoBlob = new Blob([bytes], { type: mime })
          const ext = mime === 'image/png' ? 'png' : 'jpg'
          kickPreheatUpload(normHash, photoBlob, ext)
        }
      } catch (e) {
        console.warn('[preheat] photo kick failed', e)
      }

      const proof = { timestamp: ts, hash, gps, device: 'Device', chain: 'World Chain', tokenId: Math.floor(Math.random() * 999999) + 1 };
      setTimeout(() => {
        setCapturedImage(finalImage); setProofData(proof); setMintStep(0); setMintComplete(false);
        setWorldIdVerified(false); setWorldIdVerifying(false); setScreen('worldid'); setCapturing(false);
      }, 400);
    } catch (e) {
      console.error('Capture error:', e);
      setCapturing(false);
    }
  }, [capturing, cameraReady, gpsCoords, crtMode]);

  // Recording hard-stop. 60s × ~775 KB/s (6 Mbps video + 192 kbps
  // audio) ≈ 46 MB — sits under Telegram Bot API's 50 MB upload
  // ceiling with a few MB of head-room for bitrate spikes on
  // motion-heavy scenes. Kept short so the user always gets the
  // full high-bitrate quality without the upload getting rejected.
  const MAX_REC = 60;

  const handleVideoCapture = useCallback(() => {
    if (recording) {
      // Stop recording
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      if (recAnimFrameRef.current) cancelAnimationFrame(recAnimFrameRef.current);
      recAnimFrameRef.current = null;
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      }
      setRecording(false);
    } else {
      // Start recording — canvas-based for proper 9:16 portrait framing,
      // with audio routed through Web Audio API so iOS Safari actually
      // encodes it.
      //
      // The earlier audio-only "raw camera stream" path worked because the
      // recorder saw a real <track kind=audio> coming from getUserMedia.
      // The problem was that we also lost the portrait crop / mirror,
      // because the iPhone sensor delivers landscape pixels. Going back
      // to the canvas-based composite gets the orientation right.
      //
      // To keep the audio working alongside the canvas video we route the
      // mic through `AudioContext.createMediaStreamDestination()` — this
      // produces an audio track Safari's encoder picks up reliably even
      // when the matched video track originates from `canvas.captureStream()`.
      if (!streamRef.current || !videoRef.current) return;
      recordedChunksRef.current = [];
      setCapturedVideo(null);

      const v = videoRef.current;
      // Square (1:1) recording canvas — matches the on-screen square
      // guide overlay so what the user framed inside the guide is
      // exactly what lands in the NFT + Telegram post. Portrait
      // recording used to leave the wallet tile letterboxed against
      // other square NFTs.
      const pw = 1080;
      const ph = 1080;

      // Create / reuse the offscreen canvas we draw into.
      if (!recCanvasRef.current) {
        recCanvasRef.current = document.createElement('canvas');
      }
      const rc = recCanvasRef.current;
      rc.width = pw;
      rc.height = ph;
      const ctx = rc.getContext('2d');
      if (!ctx) return;

      // Freeze the overlay metadata at recording START — we can't
      // hash video contents in real-time, so we pre-generate the
      // hash here and stash it so recorder.onstop can lock the same
      // value into proofData. This keeps the on-clip watermark and
      // the NFT metadata perfectly in sync.
      const recStartTsIso = getTimestamp();
      const recStartTsStr = recStartTsIso.replace('T', ' ').split('.')[0] + ' UTC';
      const recStartHash = generateHash();
      const recStartGps = gpsCoords;
      recOverlayRef.current = {
        timestamp: recStartTsIso,
        hash: recStartHash,
        gps: recStartGps,
        timeStr: recStartTsStr,
      };

      // Draw loop: video → canvas in cover mode against the PREVIEW
      // aspect. Cover-cropping the source to the same aspect the
      // preview element uses guarantees "what you see is what you
      // save" — same FOV, same framing. After the frame is drawn we
      // paint the proof-of-capture badges on top so the resulting
      // MP4 (which is also what gets posted to the Telegram channel)
      // carries the same overlays as photo captures.
      // Snapshot the on-screen video element size ONCE at record
      // start. We need it to back-project the on-screen 1:1 NFT guide
      // to sensor coordinates so the recorded frame captures the
      // same FOV the user was framing against. Recomputing per frame
      // would be wasteful (rectV doesn't change during a recording)
      // and could drift if a layout thrash mid-record briefly returned
      // a stale rect.
      const rectV = v.getBoundingClientRect();
      const Vw = rectV.width || pw;
      const Vh = rectV.height || ph;

      const drawFrame = () => {
        const vw = v.videoWidth || 1080;
        const vh = v.videoHeight || 1920;
        // Same viewport-aware sensor crop as the photo capture path
        // (see handleCapture) — object-fit:cover baseScale times the
        // CSS transform:scale(displayScale) gives the total mapping
        // from sensor pixels to on-screen pixels. Back-project the
        // Vw × Vw guide box through that to get the sensor square.
        const baseScale = Math.max(Vw / vw, Vh / vh);
        const totalScale = baseScale * displayScale;
        const sideRaw = Vw / totalScale;
        const side = Math.min(sideRaw, vw, vh);
        const sx = (vw - side) / 2;
        const sy = (vh - side) / 2;
        const sw = side;
        const sh = side;

        ctx.save();
        if (facingMode === 'user') {
          ctx.translate(pw, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(v, sx, sy, sw, sh, 0, 0, pw, ph);
        ctx.restore();

        // CRT texture animates every frame (fresh grain each tick) so
        // the recorded video reads as live static rather than a still
        // pattern. Only runs when the user has opted in.
        if (crtMode) drawCrtOverlay(ctx, pw, ph);
        // Keep the centered zkTruth wordmark on every recorded frame
        // as a brand mark. The detailed proof overlays (timestamp /
        // GPS / hash badges) were stripped 2026-09 to keep the video
        // reading as a plain clip; those values still live in the
        // NFT's attributes JSON and the video's poster JPEG.
        drawZkTruthWatermark(ctx, pw, ph, wordmarkRef.current);

        recAnimFrameRef.current = requestAnimationFrame(drawFrame);
      };
      drawFrame();

      const canvasStream = rc.captureStream(30);

      // Route the mic through Web Audio API so the resulting audio track is
      // a freshly emitted track from a MediaStreamDestination — empirically
      // the only form iOS Safari's encoder reliably attaches when the
      // matching video track comes from a canvas captureStream.
      const rawAudioTracks = streamRef.current.getAudioTracks().filter(t => t.readyState === 'live');
      let audioTracksForStream: MediaStreamTrack[] = [];
      let audioCtxForRecording: AudioContext | null = null;
      if (rawAudioTracks.length > 0) {
        try {
          const Ctor: typeof AudioContext =
            window.AudioContext ||
            (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
          audioCtxForRecording = new Ctor();
          if (audioCtxForRecording.state === 'suspended') {
            audioCtxForRecording.resume().catch(() => {});
          }
          const source = audioCtxForRecording.createMediaStreamSource(streamRef.current);
          const destination = audioCtxForRecording.createMediaStreamDestination();
          source.connect(destination);
          audioTracksForStream = destination.stream.getAudioTracks();
        } catch (e) {
          console.warn('[record] AudioContext setup failed', e);
          audioTracksForStream = rawAudioTracks;
        }
      }
      audioCtxRef.current = audioCtxForRecording;

      const recordStream = new MediaStream([
        ...canvasStream.getVideoTracks(),
        ...audioTracksForStream,
      ]);

      // Observability for mid-recording surprises.
      audioTracksForStream.forEach(t => {
        t.onmute = () => setRecordDebug(d => d + ' [muted!]');
        t.onunmute = () => setRecordDebug(d => d + ' [unmuted]');
        t.onended = () => setRecordDebug(d => d + ' [ended]');
      });

      // From the on-screen MIME probe on a recent iOS Safari we now know:
      //   v/mp4=Y, v/mp4;codecs=avc1.42E01E,mp4a.40.2=Y, v/mp4;codecs=avc1,mp4a=Y,
      //   v/webm=Y, v/webm;codecs=vp9,opus=Y
      // and that all of the MP4 variants silently drop the audio track,
      // even though the encoder reports support. Modern iOS Safari has
      // shipped vp9+opus webm support, which DOES carry the audio track
      // through to the saved blob, so we put webm at the top of the
      // priority list. We keep the MP4 variants as a fallback for
      // browsers (e.g. older iOS or Android) that don't take webm.
      // Prefer MP4 (H.264 + AAC) so Telegram renders the upload as an
      // inline playable video instead of a "webm attachment" file
      // card. sendVideo on the Bot API only produces a rich video
      // preview for MP4; anything else falls back to sendDocument
      // which reads as a boring file link in the channel feed.
      // iOS Safari ≥ 17.4 supports these codec strings via
      // MediaRecorder, and modern builds carry the audio track
      // through the mp4 muxer correctly (the audio-drop bug that
      // previously kept us on webm is no longer observable on the
      // versions we now target).
      const mimeTypes = [
        'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
        'video/mp4;codecs=avc1,mp4a',
        'video/mp4',
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm',
      ];
      const mimeSupport = mimeTypes.map(mt => `${mt.replace('video/', 'v/').replace('audio/', 'a/')}=${MediaRecorder.isTypeSupported(mt) ? 'Y' : 'N'}`).join(' ')
      let selectedMime = '';
      for (const mt of mimeTypes) {
        if (MediaRecorder.isTypeSupported(mt)) { selectedMime = mt; break; }
      }

      // Surface diagnostics on-screen so we can see them on iPhone too.
      const audioTracks = recordStream.getAudioTracks();
      const aTrack = audioTracks[0];
      const audioInfo = aTrack
        ? `enabled=${aTrack.enabled} muted=${aTrack.muted} state=${aTrack.readyState} label=${(aTrack.label || '').slice(0, 20)}`
        : 'no-audio-track';
      const liveAudio = audioTracks.filter(t => t.readyState === 'live').length;
      const diag = `mic:${liveAudio}/${audioTracks.length} mode:canvas+ctx mime:${selectedMime || '(default)'}\nA:${audioInfo}\nMIME:${mimeSupport}`
      console.log('[record]', diag)
      setRecordDebug(diag)

      try {
        // Explicit bitrate hints. iOS Safari has been observed to drop
        // the audio track silently when the encoder isn't told to budget
        // for it; setting `audioBitsPerSecond` forces the encoder to
        // allocate space for the mic stream.
        // 6 Mbps video + 192 kbps audio ≈ 775 KB/s. At that rate a
        // 60-second clip weighs ~46 MB — right under Telegram Bot
        // API's 50 MB per-file limit with a small safety margin
        // for bitrate spikes. Picked quality over length per the
        // user's preference: reads as sharp 4K-ish 1080p rather
        // than the muddier 3 Mbps we briefly tried.
        const recorderOpts: MediaRecorderOptions = selectedMime
          ? { mimeType: selectedMime, audioBitsPerSecond: 192000, videoBitsPerSecond: 6_000_000 }
          : { audioBitsPerSecond: 192000, videoBitsPerSecond: 6_000_000 }
        const recorder = new MediaRecorder(recordStream, recorderOpts);
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) recordedChunksRef.current.push(e.data);
        };
        recorder.onstop = () => {
          // Belt-and-braces cleanup for any leftover refs from previous
          // canvas/AudioContext-based recording paths.
          if (recAnimFrameRef.current) cancelAnimationFrame(recAnimFrameRef.current);
          recAnimFrameRef.current = null;
          if (audioCtxRef.current) {
            try { audioCtxRef.current.close() } catch { /* ignore */ }
            audioCtxRef.current = null;
          }
          const chunks = recordedChunksRef.current;
          if (chunks.length === 0) return;
          const blob = new Blob(chunks, { type: chunks[0].type || 'video/mp4' });
          // Record what we actually produced so the diagnostic chip on
          // the next view (or the next recording attempt) shows it.
          console.log('[record] blob', { type: blob.type, size: blob.size, chunks: chunks.length });
          setRecordDebug(`Last blob: type=${blob.type} size=${blob.size} chunks=${chunks.length}`);
          setCapturedVideo(blob);
          // Reuse the timestamp / hash / GPS we baked into the video
          // overlay so the NFT metadata matches the on-screen text
          // exactly. Fall back to fresh values if the ref somehow
          // got cleared between record-start and record-stop.
          const rec = recOverlayRef.current;
          const proof = {
            timestamp: rec?.timestamp ?? getTimestamp(),
            hash: rec?.hash ?? generateHash(),
            gps: rec?.gps ?? gpsCoords,
            device: "Device",
            chain: "World Chain",
            tokenId: Math.floor(Math.random() * 999999) + 1,
            type: "video",
          };
          setCapturedImage(null); setProofData(proof); setMintStep(0); setMintComplete(false);
          setWorldIdVerified(false); setWorldIdVerifying(false); setScreen("worldid");

          // Kick the Blob upload in the background so it's mostly done
          // by the time the user hits MINT. Also runs the video →
          // poster extraction + poster upload in parallel so the NFT
          // metadata endpoint has BOTH the .mp4 and .jpg ready.
          try {
            const normHash = normaliseHashHex(proof.hash)
            if (normHash) {
              const cleanType = (blob.type || 'video/mp4').split(';')[0].trim() || 'video/mp4'
              const cleaned = cleanType === blob.type
                ? blob
                : new Blob([blob], { type: cleanType })
              const ext = /mp4/i.test(cleanType) ? 'mp4'
                : /webm/i.test(cleanType) ? 'webm'
                : 'bin'
              kickPreheatUpload(normHash, cleaned, ext)
            }
          } catch (e) {
            console.warn('[preheat] video kick failed', e)
          }
        };
        mediaRecorderRef.current = recorder;
        // Don't pass a timeslice — iOS Safari has been observed to emit
        // chunks without the audio interleave when the encoder is asked
        // to flush every N ms. Letting it produce one chunk at stop is
        // the safest.
        recorder.start();
      } catch (e) {
        console.error('MediaRecorder error:', e);
        if (recAnimFrameRef.current) cancelAnimationFrame(recAnimFrameRef.current);
        recAnimFrameRef.current = null;
        return;
      }

      setRecording(true); setRecordingTime(0);
      let t = 0;
      recordingTimerRef.current = setInterval(() => {
        t++; setRecordingTime(t);
        if (t >= MAX_REC) {
          if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
          if (recAnimFrameRef.current) cancelAnimationFrame(recAnimFrameRef.current);
          recAnimFrameRef.current = null;
          if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
            mediaRecorderRef.current.stop();
          }
          setRecording(false);
        }
      }, 1000);
    }
  }, [recording, gpsCoords, zoomLevel, facingMode, crtMode]);

  const formatTime = (s: number) => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;

  const handleReset = useCallback(() => {
    setScreen("camera"); setMintComplete(false); setCapturedImage(null); setCapturedVideo(null); setProofData(null); rawImageForNftRef.current = null; preheatUploadRef.current = null;
    setTxHash(null); setRecording(false); setWorldIdVerified(false); setWorldIdVerifying(false);
    setWorldIdNullifier(null); setMintMode("verified");
    // Reset → drop both persisted entries (flow snapshot + signed
    // rp_context) so the next visit starts clean instead of restoring
    // this finished session or auto-reopening the verify widget.
    if (typeof window !== 'undefined') {
      try { localStorage.removeItem(SNAPSHOT_KEY); } catch { /* ignore */ }
      try { localStorage.removeItem('zktruth_rpcontext_v1'); } catch { /* ignore */ }
    }
    if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    if (recAnimFrameRef.current) cancelAnimationFrame(recAnimFrameRef.current);
    recAnimFrameRef.current = null;
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
  }, []);

  // Bind the native Telegram Mini App back button to `handleReset`
  // whenever we're off the initial camera screen. Without this, the
  // only affordance in the top-left of the Telegram header is the
  // built-in Close (✕), which dismisses the entire Mini App instead
  // of just returning to the capture view. Outside Telegram the hook
  // silently does nothing and the in-page ✕ buttons remain the way
  // out.
  // Telegram back button behaviour is context-aware so each tap
  // pops just one level of the flow rather than resetting the
  // entire session. Priority order:
  //  1. Replay modal open → close the modal only.
  //  2. On the confirm-tx (SIGN TO MINT) screen → return to the
  //     verify screen the user came from.
  //  3. On the sns-share screen → return to the underlying share
  //     screen (or minting screen depending on where we came from).
  //  4. On the standalone share screen → back to verify.
  //  5. Otherwise (verify / minting) → full reset to camera.
  const handleTelegramBack = useCallback(() => {
    if (replayOpen) {
      setReplayOpen(false);
      return;
    }
    if (screen === 'confirm-tx') {
      setScreen('worldid');
      return;
    }
    if (screen === 'sns-share') {
      setScreen(snsFromScreen || 'share');
      return;
    }
    if (screen === 'share') {
      setScreen('worldid');
      return;
    }
    handleReset();
  }, [replayOpen, screen, snsFromScreen, handleReset]);
  // Wire the Telegram BackButton to close whichever modal / non-camera
  // screen is currently in focus. Priority: leaderboard > trust profile
  // > screen-level back. Registering the higher-priority overlay first
  // guarantees BackButton dismisses the top layer instead of unwinding
  // straight to camera.
  const handleTelegramBackAll = useCallback(() => {
    if (leaderboardOpen) { setLeaderboardOpen(false); return; }
    if (trustProfileOpen) { setTrustProfileOpen(false); return; }
    handleTelegramBack();
  }, [leaderboardOpen, trustProfileOpen, handleTelegramBack]);
  useTelegramBackButton(
    leaderboardOpen || trustProfileOpen ||
      (screen !== 'camera' && screen !== 'splash'),
    handleTelegramBackAll,
  );

  // TON Connect state. `tonWallet` is null when no wallet is connected,
  // otherwise an object with `account.address` (raw hex form). We drive
  // both the label and the click handler off this so the same button
  // opens the connect modal when disconnected and disconnects when
  // already connected.
  const [tonConnectUI] = useTonConnectUI();
  const tonWallet = useTonWallet();
  const shortTonAddr = tonWallet?.account.address
    ? `${tonWallet.account.address.slice(0, 4)}...${tonWallet.account.address.slice(-4)}`
    : null;

  // Fetch Trust Score whenever the wallet changes, after every successful
  // mint (mintComplete → true), whenever the profile modal opens (manual
  // refresh), and on an explicit refresh trigger (setTrustRefreshCount).
  // Bypasses the CDN cache with a per-request timestamp so a mint that
  // just completed shows up right away instead of after the 30s TTL.
  useEffect(() => {
    const raw = tonWallet?.account.address
    if (!raw) { setTrustScore(null); return }
    let cancelled = false
    const fetchScore = async () => {
      try {
        const r = await fetch(
          `/api/trust/${encodeURIComponent(raw)}?t=${Date.now()}`,
          { cache: 'no-store' },
        )
        if (!r.ok) return
        const j = await r.json()
        if (!cancelled) {
          setTrustScore({
            score: j.score,
            tier: j.tier,
            emoji: j.emoji ?? '🕯',
            posts: j.posts,
            mints: j.mints ?? 0,
            reactionsTotal: j.reactionsTotal,
            hasMinted: j.hasMinted ?? false,
          })
        }
      } catch { /* offline / cold KV — leave as null */ }
    }
    // Initial fetch on any dep change.
    fetchScore()
    // Poll every 20s while wallet is connected so reactions coming
    // in via webhook get surfaced without the user having to re-open
    // the modal. Also refetch immediately when the tab regains focus
    // (user came back from the Telegram channel where they just
    // reacted to a post).
    const interval = setInterval(fetchScore, 20_000)
    const onVisible = () => { if (document.visibilityState === 'visible') fetchScore() }
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      cancelled = true
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [tonWallet?.account.address, mintComplete, trustProfileOpen, trustRefreshCount]);

  // Demo trigger: `?promoDemo=<tier>` on any URL fires the animation
  // immediately. Coexists with the verification trigger above so the
  // Telegram start_param path (t.me/bot/app?startapp=promoDemo=…) can
  // also drive the preview.
  useEffect(() => {
    try {
      const qp = new URLSearchParams(window.location.search).get('promoDemo')
      if (!qp) return
      const target: TrustTierType = TIER_ORDER.includes(qp as TrustTierType)
        ? (qp as TrustTierType)
        : 'Truth-Teller'
      setPromotion({ from: 'Source', to: target })
    } catch { /* SSR */ }
  }, []);

  // Tier-up detection. Runs GLOBALLY on every trustScore update — no
  // longer gated on the profile modal being open. That means:
  //   - App reload with a promoted tier not yet celebrated → fires
  //     the animation on startup.
  //   - Mint completes → trust score refetch → tier up detected →
  //     animation fires immediately, before the user does anything.
  //   - No stored last-seen tier + current > Source → retro-celebrate
  //     once, from Source, so users already promoted before we
  //     shipped tracking still get their moment.
  //   - Query param `?promoTest=<tier>` forces the animation.
  useEffect(() => {
    if (!trustScore || !tonWallet?.account.address) return
    if (!trustScore.hasMinted) return

    try {
      const qp = new URLSearchParams(window.location.search).get('promoTest')
      if (qp && TIER_ORDER.includes(qp as TrustTierType)) {
        setPromotion({ from: 'Source', to: qp as TrustTierType })
        return
      }
    } catch { /* SSR/no window */ }

    const key = `zk-lastSeenTier-v2-${tonWallet.account.address}`
    let prev: TrustTierType | null = null
    try {
      const raw = localStorage.getItem(key)
      if (raw && TIER_ORDER.includes(raw as TrustTierType)) {
        prev = raw as TrustTierType
      }
    } catch { /* private browsing */ }

    const now = trustScore.tier as TrustTierType
    const nowIdx = TIER_ORDER.indexOf(now)

    if (prev) {
      const prevIdx = TIER_ORDER.indexOf(prev)
      if (nowIdx > prevIdx) {
        setPromotion({ from: prev, to: now })
      }
    } else {
      if (nowIdx > 0) {
        setPromotion({ from: 'Source', to: now })
      } else {
        try { localStorage.setItem(key, now) } catch { /* skip */ }
      }
    }
  }, [trustScore, tonWallet?.account.address]);

  // Coordinator callbacks for the real IDKit-backed WorldIdVerifyButton.
  // The widget itself owns the modal + server-verify call; we just react to
  // state transitions to drive the rest of the mint flow.
  const handleWorldIdVerifying = useCallback(() => {
    if (worldIdVerifying || worldIdVerified) return;
    setWorldIdError(null);
    setWorldIdVerifying(true);
  }, [worldIdVerifying, worldIdVerified]);

  const handleWorldIdVerified = useCallback((nullifierHash: `0x${string}`) => {
    setWorldIdNullifier(nullifierHash);
    setWorldIdVerified(true);
    setWorldIdVerifying(false);
    setMintMode("verified");
    setTimeout(() => { setScreen("share"); }, 1200);
  }, []);

  const handleWorldIdError = useCallback((msg: string) => {
    console.error('[WorldID] verification failed:', msg);
    setWorldIdError(msg);
    setWorldIdVerifying(false);
  }, []);

  // Legacy alias kept so any non-button callsite still type-checks. The actual
  // verification is now driven by <WorldIdVerifyButton/> in the JSX below.
  const handleWorldIdVerify = handleWorldIdVerifying;


  const handleUnverifiedMint = useCallback(() => {
    setMintMode("unverified");
    setScreen("confirm-tx");
  }, []);

  const handleConfirmTx = useCallback(async () => {
    // Fire the actual on-chain mint. Builds the MintProof payload
    // from the current capture's metadata, hands it to TON Connect,
    // and lets the connected wallet (Tonkeeper / Wallet in Telegram
    // / etc.) surface the sign prompt. When the wallet returns we
    // advance the flow to the success screen — the actual chain
    // confirmation is asynchronous but the transaction is already
    // on the mempool by then.
    const collectionAddress = process.env.NEXT_PUBLIC_TON_COLLECTION_ADDRESS
    if (!collectionAddress) {
      setShareStatus('TON collection address not configured')
      setTimeout(() => setShareStatus(''), 5000)
      return
    }
    if (!tonWallet) {
      // Ask the user to connect first — opening the modal is the
      // same gesture that produces a wallet handle we can send tx
      // with on the next tap.
      try { await tonConnectUI.openModal() } catch { /* dismissed */ }
      return
    }

    // Validate the content hash BEFORE we ask the wallet to sign — a
    // malformed hash means the NFT metadata endpoint won't be able to
    // find the uploaded image later, and re-minting is expensive.
    const contentHashHex = normaliseHashHex(proofData?.hash)
    if (!contentHashHex) {
      setShareStatus('Missing capture hash — retake the photo and try again')
      setTimeout(() => setShareStatus(''), 5000)
      return
    }

    setMinting(true)
    setMintingStartedAt(Date.now())
    setMintTakingLong(false)

    // 1) Upload the captured media to Vercel Blob under the
    //    deterministic key `captures/<hash>.<ext>` so the NFT metadata
    //    endpoint can construct the image / animation URL from the
    //    same hash. We deliberately BLOCK the mint on this — a Proof
    //    NFT with no media is worse than no NFT at all, and the mint
    //    fee is non-refundable.

    // FAST PATH — the capture handler already kicked off the upload in
    // the background (see kickPreheatUpload). On slow cellular the
    // 20-50 MB video used to sit on the wallet-open critical path,
    // making MINT feel unresponsive. Preheat runs it in parallel with
    // the user reviewing the confirm screen so we usually just await
    // a finished promise here.
    let preheatOk = false
    if (preheatUploadRef.current?.hash === contentHashHex) {
      setShareStatus('FINALIZING UPLOAD...')
      try {
        await preheatUploadRef.current.mediaPromise
        // Poster is best-effort — a failure just means the wallet tile
        // falls back to the logo. Don't block the mint on it.
        if (preheatUploadRef.current.posterPromise) {
          await preheatUploadRef.current.posterPromise.catch(() => {})
        }
        preheatOk = true
        setShareStatus('READY')
      } catch (e) {
        // Preheat failed (network flapped, etc.). Fall through to the
        // synchronous upload path below — it retries with user-visible
        // error surfacing.
        console.warn('[mint] preheat upload failed, falling back to sync', e)
        preheatUploadRef.current = null
      }
    }

    // Two capture paths converge here (only reached if preheat missed):
    //   - PHOTO   : `capturedImage` is a `data:` URL (base64)
    //   - VIDEO   : `capturedVideo` is a raw `Blob` produced by
    //               MediaRecorder (webm or mp4)
    // Both are POSTed to the same endpoint as multipart/form-data.
    let uploadBlob: Blob | null = null
    let uploadName = 'capture.jpg'
    // Prefer the raw sensor frame (native aspect, no crop, no overlays)
    // over the branded 9:16 share card. Falls back to capturedImage
    // when the ref wasn't populated (e.g. capture happened before this
    // code shipped, or the raw path failed).
    const photoDataUrl =
      (rawImageForNftRef.current && rawImageForNftRef.current.startsWith('data:'))
        ? rawImageForNftRef.current
        : (capturedImage && capturedImage.startsWith('data:'))
          ? capturedImage
          : null
    if (photoDataUrl) {
      const dataUrl = photoDataUrl
      const commaIdx = dataUrl.indexOf(',')
      const meta = dataUrl.slice(0, commaIdx)
      const b64 = dataUrl.slice(commaIdx + 1)
      const mime = /data:([^;]+)/.exec(meta)?.[1] || 'image/jpeg'
      const bin = atob(b64)
      const bytes = new Uint8Array(bin.length)
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i)
      uploadBlob = new Blob([bytes], { type: mime })
      uploadName = `capture.${mime === 'image/png' ? 'png' : 'jpg'}`
    } else if (capturedVideo) {
      // MediaRecorder returns blobs with codec params baked into the
      // MIME type (e.g. `video/mp4;codecs=avc1.42000a,mp4a.40.2`).
      // Vercel Blob's content-type allow list only accepts the bare
      // form (`video/mp4`), so we strip everything after the semicolon
      // and re-wrap the underlying bytes with the cleaned MIME. Same
      // trick we already use for the Telegram sendVideo upload.
      const rawType = capturedVideo.type || 'video/mp4'
      const cleanType = rawType.split(';')[0].trim() || 'video/mp4'
      uploadBlob = new Blob([capturedVideo], { type: cleanType })
      const ext = /mp4/i.test(cleanType)
        ? 'mp4'
        : /webm/i.test(cleanType)
          ? 'webm'
          : 'bin'
      uploadName = `capture.${ext}`
    }

    if (preheatOk) {
      // Preheat already put the media (and poster for videos) in Blob
      // storage. Nothing to do here — proceed straight to mint tx.
    } else if (uploadBlob) {
      setShareStatus('UPLOADING CAPTURE TO STORAGE...')
      try {
        // Derive the extension from the filename we picked above so
        // the Blob key matches what the metadata endpoint's head()
        // probes for.
        const extMatch = /\.([a-z0-9]+)$/i.exec(uploadName)
        const ext = (extMatch?.[1] ?? 'jpg').toLowerCase()
        const pathname = `captures/${contentHashHex}.${ext}`
        // Client-side upload bypasses the Vercel Function 4.5 MB body
        // cap — the browser PUTs straight to Blob storage using a
        // token that /api/upload/token signs for this exact pathname.
        // This is what makes 50 MB video mints work.
        const blob = await upload(pathname, uploadBlob, {
          access: 'public',
          handleUploadUrl: '/api/upload/token',
          contentType: uploadBlob.type || undefined,
        })
        setShareStatus(`UPLOADED: ${blob.url.slice(-60)}`)

        // For videos, ALSO upload a first-frame JPEG poster under the
        // same hash. Wallets like Tonkeeper only render `image`, not
        // `animation_url`, so without a static poster the NFT tile
        // falls back to the generic zkTruth logo. The metadata endpoint
        // probes jpg first, then mp4/webm — so a matching .jpg makes
        // `image` resolve to the real thumbnail while `animation_url`
        // still points at the full video.
        if (/^video\//i.test(uploadBlob.type)) {
          try {
            setShareStatus('EXTRACTING VIDEO THUMBNAIL...')
            // Feed the same proof metadata into the poster so its
            // badges match the photo NFT layout — timestamp comes
            // straight from the capture, GPS from the live coords,
            // hash from proofData.
            const overlayTs = (proofData?.timestamp ?? getTimestamp())
              .replace('T', ' ')
              .split('.')[0] + ' UTC'
            const posterBlob = await extractFirstFrameJpeg(uploadBlob, {
              timeStr: overlayTs,
              gps: gpsCoords || '—',
              hash: contentHashHex,
            })
            if (posterBlob) {
              const posterPath = `captures/${contentHashHex}.jpg`
              await upload(posterPath, posterBlob, {
                access: 'public',
                handleUploadUrl: '/api/upload/token',
                contentType: 'image/jpeg',
              })
              setShareStatus('POSTER UPLOADED')
            }
          } catch (posterErr) {
            // Poster is best-effort; a missing thumbnail just means the
            // NFT falls back to the logo tile. Log but keep going —
            // we don't want to block the mint on a thumbnail failure.
            console.warn('poster extraction failed', posterErr)
          }
        }
      } catch (e) {
        setMinting(false)
        const msg = (e as Error)?.message ?? String(e)
        setShareStatus(`Upload failed: ${msg.slice(0, 200)}`)
        setTimeout(() => setShareStatus(''), 10000)
        return
      }
    } else if (!preheatOk) {
      // No preheat AND no sync upload path — bail rather than mint a
      // blank NFT.
      setMinting(false)
      setShareStatus('No capture to mint — retake the photo/video first')
      setTimeout(() => setShareStatus(''), 5000)
      return
    }

    const gpsHexRaw =
      gpsEnabled && gpsLocation ? gpsLocation.trim() : ''
    // GPS hash isn't computed client-side yet; feed 0 unless we're
    // storing a pre-computed hash string somewhere. Phase 5 can turn
    // the raw coord pair into a SHA-256 hash before this point.
    const gpsHash = gpsHexRaw ? hashHexToBigInt(gpsHexRaw) : 0n
    const tx = buildMintTransaction(collectionAddress, {
      contentHashHex,
      gpsHash,
      captureTimestamp: timestampToBigInt(proofData?.timestamp),
      telegramMessageId: messageIdFromPostUrl(lastTelegramPostUrl ?? undefined),
    })

    // ---- Attestation stage (Phase 8) --------------------------------
    // Ask the server to (a) verify our Telegram initData, (b) sign a
    // C2PA-style provenance claim over the capture inputs, and (c)
    // run the anomaly heuristics. The response is persisted server-
    // side under `claim:<hash>` so the NFT metadata endpoint can
    // stamp the attestation state into the on-chain-linked JSON.
    // Fire-and-forget — a failure here degrades the trust attributes
    // but must not block the mint the user just paid gas for.
    try {
      setShareStatus('ATTESTING CAPTURE...')
      const tgInit = (window as unknown as {
        Telegram?: { WebApp?: { initData?: string } }
      }).Telegram?.WebApp?.initData
      // Split "lat,lng" GPS string into a tuple if we have one — the
      // server needs numbers for the IP-vs-GPS distance check.
      let gpsLatLon: [number, number] | undefined
      if (gpsCoords && !gpsCoords.startsWith('Acquiring') && gpsCoords !== 'GPS OFF') {
        const parts = gpsCoords.split(',').map((s) => Number(s.trim()))
        if (parts.length === 2 && parts.every((n) => Number.isFinite(n))) {
          gpsLatLon = [parts[0], parts[1]]
        }
      }
      void fetch('/api/attest/claim', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          contentHashHex,
          gpsHashHex: gpsHexRaw || undefined,
          gpsLatLon,
          captureTimestampIso: proofData?.timestamp,
          wallet: tonWallet.account.address,
          initData: tgInit,
        }),
      }).catch(() => { /* attestation is best-effort */ })
    } catch { /* best-effort */ }

    setShareStatus('SIGN THE MINT IN YOUR WALLET...')
    try {
      await tonConnectUI.sendTransaction(tx)
      setMinting(false)
      setShareStatus('Mint sent to TON — see it on tonviewer soon')
      setTimeout(() => setShareStatus(''), 6000)
      // Mark this capture as minted so the share screen hides its
      // "NFT MINT" button. Without this the user sees a fresh mint
      // button right next to SHARE after they've already paid the
      // 0.15 TON fee, which invites accidental double-mints.
      setMintComplete(true)

      // Credit the mint against the author's Trust Score, then force
      // an immediate score refetch so the sidebar chip and profile
      // modal reflect the +2 post credit without waiting for the next
      // navigation. Fire-and-forget on the network call itself so a
      // Trust API failure doesn't block the share flow.
      try {
        const trustMsgId = Number(messageIdFromPostUrl(lastTelegramPostUrl ?? undefined))
        if (tonWallet?.account.address) {
          // Always credit the mint even if the user hasn't posted to
          // Telegram yet (messageId 0). The endpoint gracefully treats
          // 0 as "no post link" and still records the post event.
          // Phase 5 — also ship the fields /proof/<hash> needs to render
          // a full server-side proof card: capture timestamp (seconds),
          // GPS hash (as decimal string so JSON.stringify doesn't choke
          // on a BigInt), and the Telegram post URL if we have one.
          const captureTsSec = proofData?.timestamp
            ? Math.floor(new Date(proofData.timestamp).getTime() / 1000)
            : Math.floor(Date.now() / 1000)
          fetch('/api/trust/mint', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              wallet: tonWallet.account.address,
              messageId: Number.isFinite(trustMsgId) && trustMsgId > 0 ? trustMsgId : 0,
              contentHashHex,
              // Paid NFT mint path — MUST be explicit so the API
              // weights it ×10 and lifts the score-gate for this wallet.
              kind: 'mint',
              captureTimestampSec: captureTsSec,
              gpsHashDec: gpsHash.toString(),
            }),
          })
            .then(() => setTrustRefreshCount((n) => n + 1))
            .catch(() => { /* non-blocking */ })
        }
      } catch { /* trust hook is best-effort */ }
      // Navigate to the share screen so the user can jump straight
      // to cross-posting / cleanup while the tx confirms in the
      // background (typical TON confirmation ≤ 10 seconds).
      setScreen('share')
    } catch (e) {
      setMinting(false)
      const msg = (e as Error)?.message ?? String(e)
      // TON Connect throws "UserRejectedError" / "TON_CONNECT_SDK_ERROR"
      // when the user cancels — swallow those quietly.
      if (/cancel|reject|dismiss/i.test(msg)) {
        setShareStatus('')
        return
      }
      setShareStatus(`Mint failed: ${msg.slice(0, 160)}`)
      setTimeout(() => setShareStatus(''), 8000)
    }
  }, [
    tonWallet,
    tonConnectUI,
    proofData,
    gpsLocation,
    gpsEnabled,
    lastTelegramPostUrl,
    capturedImage,
    capturedVideo,
    gpsCoords,
  ]);

  const openSnsShare = useCallback((from: string) => {
    setSnsFromScreen(from);
    setScreen("sns-share");
  }, []);

  const buildProofUrl = useCallback(() => {
    // Full 64-char lowercase hex, no 0x prefix — matches the shape the
    // /proof/[hash] route expects for on-chain lookups and OG meta
    // generation. Query params (`?t=` etc.) are no longer read by the
    // server-rendered proof page, so we drop them to keep the URL
    // short and share-friendly.
    const raw = proofData?.hash ?? ''
    const clean = raw.startsWith('0x') || raw.startsWith('0X')
      ? raw.slice(2)
      : raw
    const h = /^[0-9a-fA-F]{64}$/.test(clean) ? clean.toLowerCase() : '0'.repeat(64)
    return `https://zktruth.vercel.app/proof/${h}`;
  }, [proofData]);

  /**
   * "Post to Channel + X" flow. Runs the Telegram channel post FIRST
   * (via handleShareWithImage, resolved through a ref because it's
   * declared LATER in this file) so both surfaces carry the capture,
   * then pops X's tweet composer pre-filled with the /proof URL.
   *
   * The X leg is what forces OUR OG card to appear on the tweet —
   * Telegram's built-in "Share to X" always sends the t.me URL and
   * hands X Telegram's own card. Going through x.com/intent gives us
   * control over which URL X scrapes.
   *
   * If the channel post fails (network flap, quota) we still open X
   * so the user isn't left with nothing shared — the /proof URL is
   * self-contained.
   */
  const shareToChannelRef = useRef<(() => Promise<void>) | null>(null);

  /**
   * Multi-platform channel + external social broadcast.
   *
   * Runs the Telegram channel post first (so the /proof page has a
   * `telegramPostUrl` recorded by the time any scraper hits us), waits
   * for the Blob preheat to land the capture on the CDN (so the
   * og:image tag renders correctly), then opens each requested social
   * composer pre-filled with the /proof URL.
   *
   * Opening multiple composers from one gesture is fine inside the
   * Telegram Mini App WebView (Telegram.WebApp.openLink() bypasses
   * the browser's popup blocker), but in a regular browser only the
   * first `window.open` typically survives. On mobile Telegram this
   * gives us reliable cross-post; on desktop web we may need the
   * user to allow popups — acceptable trade-off for the MVP.
   */
  const openMultiShare = useCallback(async (
    platforms: Array<'x' | 'farcaster' | 'truth'>,
  ) => {
    setXPostingStatus('posting')
    // 1) Channel post.
    const post = shareToChannelRef.current
    if (post) {
      try { await post() } catch { /* keep going */ }
    }
    // 2) Wait for Blob upload — required for og:image.
    try {
      const pre = preheatUploadRef.current
      if (pre) {
        await pre.mediaPromise
        if (pre.posterPromise) { try { await pre.posterPromise } catch {} }
      }
    } catch { /* fallthrough */ }

    // 3) Build the shared text body once — same message across
    //    every platform so screenshots read identically.
    const url = buildProofUrl()
    const parts: string[] = ['✅ Verified Proof of Capture on TON']
    const ts = proofData?.timestamp
      ? proofData.timestamp.replace('T', ' ').replace(/\.\d+/, '').replace('Z', ' UTC')
      : ''
    if (ts) parts.push(`⏱ ${ts}`)
    if (gpsLocation) parts.push(`📍 ${gpsLocation}`)
    parts.push('', 'via @zktruth_channel')
    const baseText = parts.join('\n')
    const hashtagsCsv = 'TON,TONblockchain,journalism'
    // Farcaster / Truth Social don't take a separate hashtags param
    // like X does, so embed them inline in the body for those
    // platforms.
    const textWithHashtags = `${baseText}\n\n#TON #TONblockchain #journalism`

    // 4) Intent URL builders per platform.
    //    Farcaster and Truth Social don't reliably accept a
    //    pre-filled compose intent the way X does — Warpcast's
    //    compose URL works only inside an authenticated session,
    //    and Truth Social has no public share endpoint at all.
    //    Fallback: copy the full message to the clipboard AND open
    //    the site's compose surface, so the user can just paste.
    const intentFor = (p: 'x' | 'farcaster' | 'truth'): {
      url: string
      copyPayload?: string
    } => {
      if (p === 'x') {
        return {
          url: `https://x.com/intent/tweet?text=${encodeURIComponent(baseText)}&url=${encodeURIComponent(url)}&hashtags=${encodeURIComponent(hashtagsCsv)}`,
        }
      }
      if (p === 'farcaster') {
        // Warpcast compose intent (works if the user is signed in
        // to warpcast.com in the browser that opens the link).
        // Provide the same text on the clipboard so the paste
        // path still works when the deep link goes to login.
        return {
          url: `https://warpcast.com/~/compose?text=${encodeURIComponent(textWithHashtags)}&embeds%5B%5D=${encodeURIComponent(url)}`,
          copyPayload: `${textWithHashtags}\n\n${url}`,
        }
      }
      // Truth Social — no share intent, so we send the user to the
      // home feed (which has the composer on top) and rely on
      // clipboard paste for the message body.
      return {
        url: 'https://truthsocial.com/',
        copyPayload: `${textWithHashtags}\n\n${url}`,
      }
    }

    // 5) Open each composer. Small stagger avoids the WebView
    //    coalescing them into one blocked popup.
    const tg = (window as unknown as {
      Telegram?: { WebApp?: { openLink?: (u: string) => void } }
    }).Telegram?.WebApp
    const openOne = (u: string) => {
      if (tg?.openLink) {
        try { tg.openLink(u); return } catch { /* fallthrough */ }
      }
      window.open(u, '_blank', 'noopener,noreferrer')
    }

    // Copy the clipboard payload for the LAST platform in the list —
    // whichever composer opens on top is what the user will paste
    // into. If multiple platforms need pasteable content, we prefer
    // the "richer" one (Truth Social > Farcaster) since X already
    // pre-fills fully via its intent.
    let clipboardPayload: string | undefined
    for (const p of platforms) {
      const { copyPayload } = intentFor(p)
      if (copyPayload) clipboardPayload = copyPayload
    }
    if (clipboardPayload) {
      try {
        await navigator.clipboard.writeText(clipboardPayload)
        setCopyStatus('Post text copied — paste it into the composer')
        setTimeout(() => setCopyStatus(''), 6000)
      } catch { /* clipboard perm denied — user can still type */ }
    }

    for (let i = 0; i < platforms.length; i++) {
      const { url: link } = intentFor(platforms[i])
      setTimeout(() => openOne(link), i * 250)
    }
    setXPostingStatus('idle')
  }, [buildProofUrl, proofData, gpsLocation]);

  // Legacy single-target aliases so existing buttons keep working.
  const openXShare = useCallback(() => openMultiShare(['x']), [openMultiShare])
  const openFarcasterShare = useCallback(() => openMultiShare(['farcaster']), [openMultiShare])
  const openTruthShare = useCallback(() => openMultiShare(['truth']), [openMultiShare])
  const openAllSocials = useCallback(
    () => openMultiShare(['x', 'farcaster', 'truth']),
    [openMultiShare],
  )

  const handleShareWithImage = useCallback(async () => {
    // Post the capture to the public zkTruth Telegram channel.
    //
    // We POST **directly** to `api.telegram.org/bot<TOKEN>/...` from
    // the client instead of round-tripping through our own
    // `/api/telegram/post` Vercel Function. Reason: Vercel
    // Serverless Functions cap the request body at 4.5 MB on the
    // Hobby plan, and any video longer than ~13 seconds at our
    // recording bitrate blows through that limit — the upload gets
    // rejected before it ever reaches the function, so the channel
    // stays empty and the user sees nothing.
    //
    // Talking to Telegram directly means the only ceiling is the
    // Bot API's own 50 MB per-file limit, which is plenty for
    // capture-length clips.
    //
    // Trade-off: the bot token is exposed in the client bundle
    // (NEXT_PUBLIC_TELEGRAM_BOT_TOKEN). The bot has post-only
    // permission on a single public channel, so worst-case abuse is
    // a spam post that admins can delete + a `/revoke` in BotFather
    // to rotate the token. Acceptable for the MVP; can be moved
    // back behind a server proxy once we're on a Vercel plan with
    // larger body limits or once we cache captures in Vercel Blob
    // and pass URLs to Telegram instead of raw uploads.

    let mediaBlob: Blob | null = null
    let mediaName = 'capture.jpg'
    if (capturedVideo) {
      const rawType = capturedVideo.type || 'video/webm'
      const ext = rawType.includes('mp4') ? 'mp4' : 'webm'
      mediaName = `zktruth-proof.${ext}`
      // CRITICAL: strip any codec parameters from the MIME type.
      // MediaRecorder emits Blobs with types like
      // "video/webm;codecs=vp9,opus", and when that gets put into a
      // multipart Content-Type header Telegram's parser sees the
      // "codecs=" bit and silently drops the file attachment while
      // still accepting the caption — the exact symptom the user
      // hit ("metadata posts, video doesn't"). A bare "video/webm"
      // is the only form Telegram reliably keeps.
      const cleanType = (rawType.split(';')[0] || '').trim() ||
        (ext === 'mp4' ? 'video/mp4' : 'video/webm')
      mediaBlob = new File([capturedVideo], mediaName, { type: cleanType })
    } else if (capturedImage) {
      const parts = capturedImage.split(',')
      const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg'
      const bstr = atob(parts[1])
      const arr = new Uint8Array(bstr.length)
      for (let i = 0; i < bstr.length; i++) arr[i] = bstr.charCodeAt(i)
      mediaBlob = new Blob([arr], { type: mime })
      mediaName = 'zktruth-proof.jpg'
    }

    if (!mediaBlob) {
      setShareStatus('メディアが見つかりません')
      setTimeout(() => setShareStatus(''), 3000)
      return
    }

    setSharing(true)
    setShareStatus('チャンネルへ投稿中...')

    const BOT_TOKEN = process.env.NEXT_PUBLIC_TELEGRAM_BOT_TOKEN
    const CHANNEL_ID = process.env.NEXT_PUBLIC_TELEGRAM_CHANNEL_ID || '@zktruth_capture'
    if (!BOT_TOKEN) {
      setSharing(false)
      setShareStatus('Bot token env not set — see README')
      setTimeout(() => setShareStatus(''), 6000)
      return
    }

    // Build the caption client-side (previously done in the server
    // route). Same HTML formatting + zkTruth footer + optional
    // wallet/comment/location fields.
    const shortHash = (h?: string) => {
      if (!h) return ''
      const clean = h.replace(/^0x/, '')
      return `0x${clean.slice(0, 8)}…${clean.slice(-6)}`
    }
    const gpsForCaption = gpsEnabled
      ? gpsLocation ||
        (gpsCoords &&
        !gpsCoords.startsWith('Acquiring') &&
        gpsCoords !== 'GPS OFF' &&
        gpsCoords !== 'GPS unavailable' &&
        gpsCoords !== 'GPS not supported'
          ? gpsCoords
          : undefined)
      : undefined
    // Fetch the caller's live Trust Score right before we build the
    // caption so the badge on top matches what the profile modal shows.
    // Best-effort — if the KV/API is cold we simply omit the badge line
    // (skipping is nicer than showing a stale 0-Source tag).
    let trustBadgeLine: string | null = null
    if (tonWallet?.account.address) {
      try {
        const tr = await fetch(
          `/api/trust/${encodeURIComponent(tonWallet.account.address)}?t=${Date.now()}`,
          { cache: 'no-store' },
        )
        if (tr.ok) {
          const tj = await tr.json() as {
            score?: number; tier?: string; emoji?: string
          }
          if (typeof tj.score === 'number' && tj.tier) {
            // Header line is intentionally short + emphatic so it reads
            // at a glance in the channel feed.
            trustBadgeLine = `${tj.emoji ?? '🕯'} <b>${tj.tier}</b> · <code>${Math.round(tj.score)}</code>`
          }
        }
      } catch { /* offline — no badge, no problem */ }
    }
    const captionLines: string[] = []
    if (trustBadgeLine) {
      captionLines.push(trustBadgeLine, '')
    }
    captionLines.push('✓ <b>Verified Proof of Capture</b>', '')
    if (proofData?.hash) {
      captionLines.push(`<b>Hash</b> · <code>${shortHash(proofData.hash)}</code>`)
    }
    if (proofData?.timestamp) {
      const t = proofData.timestamp
        .replace('T', ' ')
        .replace(/\.\d+/, '')
        .replace('Z', ' UTC')
      captionLines.push(`<b>Time</b> · ${t}`)
    }
    if (gpsForCaption) {
      captionLines.push(`<b>Location</b> · ${gpsForCaption}`)
    }
    if (tonWallet?.account.address) {
      // TON Connect hands us the "raw" address form (0:<hex-hash>) — the
      // one Tonkeeper actually displays is the user-friendly base64
      // encoding (UQ… non-bounceable). Convert here so the caption
      // matches what the user sees in their wallet, otherwise short-
      // hashing the raw form produces "0:8e4a…dbfe" and the user can't
      // reconcile it with their own address.
      const rawAddr = tonWallet.account.address
      let friendlyAddr = rawAddr
      try {
        friendlyAddr = Address.parse(rawAddr).toString({
          urlSafe: true,
          bounceable: false,
          testOnly: false,
        })
      } catch { /* fall back to raw if parsing fails */ }
      // TON addresses shouldn't be dressed up as `0x…` (that's an
      // Ethereum convention) — the caller of the generic `shortHash`
      // helper always prepends `0x`, so we shorten inline here instead
      // to keep the UQ… prefix intact.
      const shortTon =
        friendlyAddr.length > 12
          ? `${friendlyAddr.slice(0, 6)}…${friendlyAddr.slice(-4)}`
          : friendlyAddr
      captionLines.push(`<b>Wallet</b> · <code>${shortTon}</code>`)
    }
    const trimmedComment = captureComment?.trim()
    if (trimmedComment) {
      captionLines.push('', `<i>${trimmedComment}</i>`)
    }
    // Include the /proof/<hash> URL BOTH as a hyperlink on the
    // "zkTruth" wordmark AND as a bare URL on its own line. The bare
    // URL is what matters when someone shares this post to X —
    // Telegram's "Share to X" pre-fills the tweet with the caption
    // text, and X scrapes the last URL in a tweet for its card.
    // Because our /proof/<hash> URL now emits its own rich OG image /
    // video / description, the X card carries our thumbnail and the
    // "About zkTruth" write-up rather than Telegram's generic preview.
    if (proofData?.hash) {
      const proofUrl = `https://zktruth.vercel.app/proof/${proofData.hash.replace(/^0x/, '')}`
      captionLines.push(
        '',
        `Captured with <a href="${proofUrl}">zkTruth</a> · Proof of Capture on TON.`,
        '',
        `🔗 Verify & share: ${proofUrl}`,
      )
    } else {
      captionLines.push(
        '',
        'Captured with <a href="https://zktruth.vercel.app">zkTruth</a> · Proof of Capture on TON.',
      )
    }
    const caption = captionLines.join('\n')

    // Route by real container: MP4 goes through sendVideo so
    // Telegram renders it inline with a thumbnail + playback
    // controls; anything else (webm from older iOS builds) falls
    // back to sendDocument which at least gets the file uploaded.
    const mediaTypeLower = (mediaBlob.type || '').toLowerCase()
    const isMp4Video =
      mediaTypeLower.startsWith('video/mp4') || /\.(mp4|mov|m4v)$/i.test(mediaName)
    const isOtherVideo =
      !isMp4Video &&
      (mediaTypeLower.startsWith('video/') || /\.(webm)$/i.test(mediaName))
    const tgMethod = isMp4Video
      ? 'sendVideo'
      : isOtherVideo
        ? 'sendDocument'
        : 'sendPhoto'
    const tgFileField = isMp4Video
      ? 'video'
      : isOtherVideo
        ? 'document'
        : 'photo'

    // Show file size + method up front so if the request never
    // gets a response the user (and we) can see what was attempted.
    const sizeKB = Math.round((mediaBlob.size || 0) / 1024)
    setShareStatus(`投稿中... ${tgMethod} · ${sizeKB} KB`)

    // Uploader helper used for both the primary attempt and the
    // sendVideo fallback below. Rebuilds the form each time so a
    // consumed body / stale field state can't sabotage retries.
    // For videos, probe native pixel dimensions + duration so Telegram
    // renders the channel preview at the correct aspect ratio. Without
    // these params, iOS-Safari-produced MP4s can be interpreted as 16:9
    // and vertically squashed regardless of the real portrait geometry.
    let videoMeta: { width: number; height: number; duration: number } | null = null
    if (isMp4Video || isOtherVideo) {
      try { videoMeta = await probeVideoMeta(mediaBlob) } catch { videoMeta = null }
    }

    const uploadTo = async (methodName: string, field: string) => {
      const f = new FormData()
      f.set('chat_id', CHANNEL_ID)
      f.set(field, mediaBlob, mediaName)
      f.set('caption', caption)
      f.set('parse_mode', 'HTML')
      if (methodName === 'sendVideo') {
        f.set('supports_streaming', 'true')
        if (videoMeta) {
          f.set('width', String(videoMeta.width))
          f.set('height', String(videoMeta.height))
          if (videoMeta.duration > 0) f.set('duration', String(videoMeta.duration))
        }
      }
      const r = await fetch(`https://api.telegram.org/bot${BOT_TOKEN}/${methodName}`, {
        method: 'POST',
        body: f,
      })
      const txt = await r.text()
      let d: { ok?: boolean; description?: string; result?: { message_id: number; document?: unknown; video?: unknown; photo?: unknown } } = {}
      try { d = JSON.parse(txt) } catch { /* keep raw */ }
      return { r, d, txt }
    }

    try {
      let { r: res, d: data, txt: rawText } = await uploadTo(tgMethod, tgFileField)
      let usedMethod = tgMethod

      // Fallback: sendDocument occasionally 200-OKs while dropping the
      // attached webm silently. In that case we retry via sendVideo,
      // which handles those clips correctly.
      //
      // NOTE: gate this ONLY on the sendDocument path — sendPhoto
      // succeeds with `result.photo` (not `document`/`video`), so the
      // old broad check retried photos as videos and produced the
      // "one normal + one squashed" duplicate the channel was showing.
      const documentMissing =
        tgMethod === 'sendDocument' &&
        res.ok &&
        data.ok &&
        data.result &&
        !data.result.document &&
        !data.result.video
      if (documentMissing) {
        const retry = await uploadTo('sendVideo', 'video')
        res = retry.r
        data = retry.d
        rawText = retry.txt
        usedMethod = 'sendVideo'
      }

      if (!res.ok || !data.ok || !data.result) {
        setSharing(false)
        const msg =
          data.description ||
          (rawText ? rawText.slice(0, 200) : `HTTP ${res.status}`)
        setShareStatus(`失敗 [${res.status}] ${usedMethod}: ${msg}`)
        setTimeout(() => setShareStatus(''), 10000)
        return
      }
      const messageId = data.result.message_id
      const channelPath = CHANNEL_ID.startsWith('@') ? CHANNEL_ID.slice(1) : CHANNEL_ID
      const postUrl = `https://t.me/${channelPath}/${messageId}`
      // Remember the post URL so a subsequent MINT ON TON call can
      // stamp its Telegram message id into the on-chain NFT record.
      setLastTelegramPostUrl(postUrl)

      // Trust Score bookkeeping for the FREE hash-post path — mirror
      // the paid-mint route so reactions and views collected on this
      // message credit back to the author. Without this the message
      // has no msg:<id> → wallet mapping in KV and later webhook
      // events silently 404 as "unknown message". Also gives the
      // wallet a small `post` credit for the participation itself.
      try {
        if (tonWallet?.account.address) {
          const rawContentHash = proofData?.hash as string | undefined
          const normalisedHash = rawContentHash
            ? (rawContentHash.startsWith('0x') || rawContentHash.startsWith('0X')
                ? rawContentHash.slice(2)
                : rawContentHash
              ).toLowerCase()
            : undefined
          fetch('/api/trust/mint', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
              wallet: tonWallet.account.address,
              messageId,
              contentHashHex: normalisedHash,
              // Free hash-only channel post — weight 1, daily-capped.
              // Does NOT lift the score-gate; wallet still needs a paid
              // mint before this credit becomes visible.
              kind: 'free',
            }),
          })
            .then(() => setTrustRefreshCount((n) => n + 1))
            .catch(() => { /* non-blocking */ })
        }
      } catch { /* best-effort */ }
      // Full-screen success burst — swap the "posting..." overlay for
      // a green check that stays for ~1.5s so the outcome reads as a
      // definite "done!" moment.
      setSharing(false)
      setShareSuccess(true)
      setShareStatus('投稿完了! チャンネルを開きます...')
      setTimeout(() => setShareSuccess(false), 1600)
      setTimeout(() => setShareStatus(''), 4000)
      setTimeout(() => {
        window.open(postUrl, '_blank')
      }, 900)
    } catch (e) {
      setSharing(false)
      setShareStatus(`ネットワークエラー: ${(e as Error).message}`)
      setTimeout(() => setShareStatus(''), 6000)
    }
  }, [
    capturedImage,
    capturedVideo,
    proofData,
    gpsLocation,
    gpsCoords,
    gpsEnabled,
    tonWallet,
    captureComment,
  ]);

  // Keep the ref pointing at the latest handleShareWithImage so
  // openXShare (declared earlier in the file for JSX ordering reasons)
  // can call it without a temporal-dead-zone import problem.
  useEffect(() => {
    shareToChannelRef.current = handleShareWithImage
  }, [handleShareWithImage]);

  // === Blur editor plumbing ===================================
  // Whenever the replay modal opens over a photo, prime two canvases:
  //  - the visible working canvas (blurCanvasRef)
  //  - a hidden pre-blurred copy of the same image (blurredSourceRef)
  // Painting is then just a matter of `clip → drawImage(hidden, 0, 0)`
  // for each brush stroke — no per-frame CPU blur, no dependency on
  // browsers that don't support `ctx.filter` (Safari-on-iOS did add
  // support in v14, but caching the blur is nice regardless).
  useEffect(() => {
    if (!replayOpen || !capturedImage || capturedVideoUrl) return;
    const img = new window.Image();
    img.onload = () => {
      blurOriginalRef.current = img;
      const canvas = blurCanvasRef.current;
      const naturalW = img.naturalWidth || img.width;
      const naturalH = img.naturalHeight || img.height;
      if (canvas) {
        // Backing store gets the full pixel resolution so blur brush
        // strokes match the source detail — we'll shrink for display
        // via explicit CSS width/height below.
        canvas.width = naturalW;
        canvas.height = naturalH;
        // Fit-within-viewport aspect-preserving sizing computed in JS.
        // CSS `max-width/max-height` alone doesn't reliably preserve
        // aspect ratio on <canvas> across browsers, so we compute the
        // display box manually and set it inline.
        const vpW = window.innerWidth;
        const vpH = window.innerHeight;
        const imgAR = naturalW / naturalH;
        const vpAR = vpW / vpH;
        let dispW: number;
        let dispH: number;
        if (imgAR > vpAR) {
          // Image is wider than viewport ratio → fit to viewport width
          dispW = vpW;
          dispH = Math.round(vpW / imgAR);
        } else {
          // Image is taller → fit to viewport height
          dispH = vpH;
          dispW = Math.round(vpH * imgAR);
        }
        canvas.style.width = `${dispW}px`;
        canvas.style.height = `${dispH}px`;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0);
      }
      // Downsample-then-upsample blur. Instead of relying on
      // `ctx.filter = 'blur(...)'` — which iOS Safari (both in
      // Telegram's WebView and standalone) frequently fails to apply
      // even on in-DOM canvases — we shrink the image to ~5% of its
      // original size, then paint that tiny copy back up to full size
      // during each brush stroke. The browser's built-in bilinear
      // upsampling produces a soft, uniform blur that reads exactly
      // like a Gaussian blur to the eye and works on every engine.
      const blurred = document.createElement('canvas');
      const blurScale = 0.05;
      blurred.width = Math.max(1, Math.floor(naturalW * blurScale));
      blurred.height = Math.max(1, Math.floor(naturalH * blurScale));
      const bCtx = blurred.getContext('2d');
      if (bCtx) {
        bCtx.imageSmoothingEnabled = true;
        bCtx.imageSmoothingQuality = 'high';
        bCtx.drawImage(img, 0, 0, blurred.width, blurred.height);
      }
      blurredSourceRef.current = blurred;
      setBlurDirty(false);
    };
    img.src = capturedImage;
    // Reset editor state each open so leaving-and-reopening starts
    // fresh (no stale dirty flag or half-drawn strokes).
    setBlurMode(false);
    return () => {
      blurOriginalRef.current = null;
      blurredSourceRef.current = null;
    };
  }, [replayOpen, capturedImage, capturedVideoUrl]);

  const paintBlurAt = useCallback((clientX: number, clientY: number) => {
    const canvas = blurCanvasRef.current;
    const blurred = blurredSourceRef.current;
    if (!canvas || !blurred) return;
    const rect = canvas.getBoundingClientRect();
    if (rect.width === 0 || rect.height === 0) return;
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    const x = (clientX - rect.left) * scaleX;
    const y = (clientY - rect.top) * scaleY;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    // Brush size scales with image so the felt size is consistent
    // across portrait vs landscape captures. Tuned to ~2.8% of the
    // longer edge — fine enough to redact just a face or a license
    // plate without spilling into surrounding detail.
    const radius = Math.max(canvas.width, canvas.height) * 0.028;
    // Clip a circle at the brush position, then paint the tiny
    // downsampled canvas back up to full resolution inside that
    // circle. The upscale is bilinear (via imageSmoothing) so the
    // result is a soft, uniform blur.
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.clip();
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(blurred, 0, 0, canvas.width, canvas.height);
    ctx.restore();
  }, []);

  const handleBlurPointerDown = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!blurMode) return;
    e.stopPropagation();
    // setPointerCapture occasionally throws on iOS Safari for
    // pointerType="touch" — swallow it so we don't lose the whole
    // drag flow to an unrelated capability check.
    try { (e.target as HTMLElement).setPointerCapture(e.pointerId); } catch { /* ignore */ }
    blurIsDrawingRef.current = true;
    paintBlurAt(e.clientX, e.clientY);
    setBlurDirty(true);
  }, [blurMode, paintBlurAt]);

  const handleBlurPointerMove = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!blurMode || !blurIsDrawingRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    paintBlurAt(e.clientX, e.clientY);
  }, [blurMode, paintBlurAt]);

  const handleBlurPointerUp = useCallback((e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!blurMode) return;
    e.stopPropagation();
    blurIsDrawingRef.current = false;
  }, [blurMode]);

  // === Touch-event fallbacks ===================================
  // Some iOS Safari versions running inside Telegram Mini App's
  // WebView have flaky Pointer Events on <canvas> — pointerdown
  // fires but subsequent pointermove doesn't, breaking drag.
  // Wiring the native touch events in parallel gives us a reliable
  // path; `preventDefault()` on touchmove kills the WebView's
  // default pan-to-scroll so the finger stays on the brush.
  const handleBlurTouchStart = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!blurMode) return;
    e.stopPropagation();
    const t = e.touches[0];
    if (!t) return;
    blurIsDrawingRef.current = true;
    paintBlurAt(t.clientX, t.clientY);
    setBlurDirty(true);
  }, [blurMode, paintBlurAt]);

  const handleBlurTouchMove = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!blurMode || !blurIsDrawingRef.current) return;
    e.preventDefault();
    e.stopPropagation();
    const t = e.touches[0];
    if (!t) return;
    paintBlurAt(t.clientX, t.clientY);
  }, [blurMode, paintBlurAt]);

  const handleBlurTouchEnd = useCallback((e: React.TouchEvent<HTMLCanvasElement>) => {
    if (!blurMode) return;
    e.stopPropagation();
    blurIsDrawingRef.current = false;
  }, [blurMode]);

  const handleBlurSave = useCallback(() => {
    const canvas = blurCanvasRef.current;
    if (!canvas) return;
    // Commit the painted result back to `capturedImage` so downstream
    // (share to Telegram, mint on TON) uses the redacted version.
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    setCapturedImage(dataUrl);
    setBlurMode(false);
    setBlurDirty(false);
    setReplayOpen(false);
  }, []);

  const handleBlurReset = useCallback(() => {
    const canvas = blurCanvasRef.current;
    const img = blurOriginalRef.current;
    if (!canvas || !img) return;
    canvas.width = img.naturalWidth || img.width;
    canvas.height = img.naturalHeight || img.height;
    const ctx = canvas.getContext('2d');
    ctx?.drawImage(img, 0, 0);
    setBlurDirty(false);
  }, []);

  const handleCopyLink = useCallback(() => {
    const url = buildProofUrl();
    const text = 'Verified proof of capture via zkTruth\n\n' + url;
    navigator.clipboard.writeText(text).catch(() => {});
    setCopyStatus("COPIED");
    setTimeout(() => setCopyStatus(""), 2000);
  }, [buildProofUrl]);

  const handleSaveMedia = useCallback(() => {
    const a = document.createElement('a');
    if (capturedVideo) {
      const url = URL.createObjectURL(capturedVideo);
      const ext = capturedVideo.type.includes('mp4') ? 'mp4' : 'webm';
      a.href = url;
      a.download = `zktruth-proof-${Date.now()}.${ext}`;
      a.click();
      URL.revokeObjectURL(url);
      setCopyStatus("VIDEO SAVED");
    } else if (capturedImage) {
      a.href = capturedImage;
      a.download = `zktruth-proof-${Date.now()}.jpg`;
      a.click();
      setCopyStatus("IMAGE SAVED");
    }
    setTimeout(() => setCopyStatus(""), 2000);
  }, [capturedVideo, capturedImage]);

  const isVideoProof = !!capturedVideo;

  const currentStep = MINT_STEPS[Math.min(mintStep, MINT_STEPS.length - 1)];

  return (
    <>
      <style>{styles}</style>
      <div className="fullscreen">

        <div className={`splash ${splashPhase >= 1 ? 'phase1' : ''} ${splashPhase >= 2 ? 'phase2' : ''} ${splashPhase >= 3 ? 'fade-out' : ''} ${splashPhase >= 4 ? 'gone' : ''}`}>
          <div className="splash-icon-wrap">
            {/* Direct usage of the brand PNG assets — the bubble is a
                pixel-perfect crop of the zkTruth logo with the green
                check erased, and the check is the same brand asset's
                green mark isolated to a transparent background. This
                avoids any hand-drawn SVG approximations. */}
            <img
              className="splash-bubble"
              src="/splash-bubble.png"
              alt=""
              draggable={false}
            />
            <img
              className="splash-check"
              src="/splash-check.png"
              alt=""
              draggable={false}
            />
          </div>
          <div className="splash-logo-row">
            <img
              className="splash-wordmark"
              src="/splash-wordmark.png"
              alt="zkTruth"
              draggable={false}
            />
          </div>
          <div className="splash-sub">Proof of Reality</div>
          <div className="splash-powered"><div className="splash-pw-dot" />POWERED BY TON</div>
        </div>

        {screen === "camera" && (
          <>
            <video ref={videoRef} className="camera-video" autoPlay playsInline muted style={{display: cameraReady ? 'block' : 'none', transform: `${facingMode === 'user' ? 'scaleX(-1)' : ''} scale(${displayScale})`.trim(), transformOrigin: 'center center'}} />
            {!cameraReady && (
              <div className="simulated-bg">
                <div className="grid-overlay" />
              </div>
            )}
            <canvas ref={canvasRef} style={{display:'none'}} />

            {/*
              Square NFT crop guide. The whole camera surface stays
              full-portrait so the user still gets a big preview, but
              only the centred 1:1 square inside this overlay actually
              becomes the NFT / Telegram post. We dim the letterbox
              strips above and below the square, then draw a thin
              white border + four corner ticks so the crop window
              reads at a glance.
            */}
            {cameraReady && (
              <div className="nft-square-guide" aria-hidden="true">
                <div className="nsg-mask nsg-mask-top" />
                <div className="nsg-mask nsg-mask-bottom" />
                <div className="nsg-frame">
                  <span className="nsg-corner nsg-tl" />
                  <span className="nsg-corner nsg-tr" />
                  <span className="nsg-corner nsg-bl" />
                  <span className="nsg-corner nsg-br" />
                  <span className="nsg-label">NFT · 1:1</span>
                </div>
              </div>
            )}

            <div className="meta-overlay">
              <div className="meta-line">⏱ {now.replace('T',' ').split('.')[0]} UTC</div>
              <div className="meta-line">📍 {gpsCoords}</div>
            </div>

            <div className="top-bar">
              <div className="logo">
                <svg className="logo-icon" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10z" stroke="white"/>
                  <path d="m8 9.5 2.5 2.5 5-5" stroke="#00c864"/>
                </svg>
                <div className="logo-text"><span className="logo-zk">zk</span><span className="logo-truth">Truth</span></div>
                <div className="live-badge"><div className="live-dot" />{recording ? `REC ${formatTime(recordingTime)}` : 'LIVE'}</div>
              </div>
              {/* Top-right network status. Diamond glyph is TON's
                  brand cue, blue neon shadow gives it depth, monospace
                  + :: separator reads as a technical readout. No LIVE
                  suffix per user preference. */}
              <div className="chain-badge chain-badge--ton">
                <span className="net-glyph">◆</span>
                <span className="net-label">TON&nbsp;L1</span>
                <span className="net-sep">::</span>
                <span className="net-state">MAINNET</span>
              </div>
            </div>
            {recordDebug && (
              <div style={{
                position: 'absolute',
                top: 76,
                left: 12,
                right: 12,
                padding: '6px 10px',
                background: 'rgba(0,0,0,0.72)',
                border: '1px solid rgba(255,255,255,0.18)',
                borderRadius: 8,
                color: '#e6e6e6',
                fontFamily: 'Space Mono, monospace',
                fontSize: 9,
                lineHeight: 1.35,
                zIndex: 5,
                whiteSpace: 'pre-line',
                wordBreak: 'break-all',
              }}>
                {recordDebug}
              </div>
            )}

            <div className="side-buttons">
              {/* Privacy notice trigger. Sits above FLIP so users can
                  glance the "what gets shared" briefing before the
                  first capture. Kept on the camera screen (not verify)
                  because expectations should be set BEFORE the shutter
                  fires, not after. */}
              <div>
                <button className="side-btn" onClick={() => setPrivacyOpen(true)} aria-label="Privacy notice">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:22,height:22}} strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="12" cy="12" r="10" />
                    <path d="M12 16v-4" />
                    <path d="M12 8h.01" />
                  </svg>
                </button>
                <div className="side-btn-label">INFO</div>
              </div>
              {/* GPS toggle. Location is enabled by default (Proof of
                  Capture's whole point is verifiable spatial context),
                  but users need a fast opt-out for private venues. A
                  diagonal slash overlays the pin when off so the state
                  reads clearly at a glance even without the label. */}
              <div>
                <button
                  className="side-btn"
                  onClick={() => setGpsEnabled((v) => !v)}
                  aria-label={gpsEnabled ? 'Turn location off' : 'Turn location on'}
                  aria-pressed={gpsEnabled}
                  style={{
                    color: gpsEnabled ? '#fff' : '#ff5a6a',
                    borderColor: gpsEnabled ? undefined : 'rgba(255,90,106,0.6)',
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:22,height:22}} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 22s-8-7-8-13a8 8 0 1 1 16 0c0 6-8 13-8 13z" />
                    <circle cx="12" cy="9" r="2.5" />
                    {!gpsEnabled && <line x1="4" y1="4" x2="20" y2="20" />}
                  </svg>
                </button>
                <div
                  className="side-btn-label"
                  style={{ color: gpsEnabled ? undefined : '#ff5a6a' }}
                >
                  {gpsEnabled ? 'GPS' : 'GPS OFF'}
                </div>
              </div>
              <div>
                <button className="side-btn" onClick={flipCamera}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:22,height:22}}><path d="M1 4v6h6"/><path d="M23 20v-6h-6"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15"/></svg></button>
                <div className="side-btn-label">FLIP</div>
              </div>
              {/* Trust Score chip. Shows the connected wallet's tier
                  emoji + current score. Tap to open the profile modal
                  with the full breakdown (posts / reactions / shares).
                  Colour ramps from grey (Source) → cyan (Whistleblower)
                  → gold (Muckraker) → orange (Investigator) → green
                  (Truth-Teller) so higher tiers stand out at a glance. */}
              {tonWallet && (() => {
                const tier: TrustTierType = (trustScore?.tier as TrustTierType) ?? 'Source'
                const tierColor = trustScore
                  ? (trustScore.tier === 'Truth-Teller' ? '#00ff87'
                    : trustScore.tier === 'Investigative Reporter' ? '#ff7a4d'
                    : trustScore.tier === 'Muckraker' ? '#ffcf5c'
                    : trustScore.tier === 'Whistleblower' ? '#4dd4ff'
                    : '#8b8b8b')
                  : '#666'
                return (
                  <div>
                    <button
                      className="side-btn"
                      onClick={() => setTrustProfileOpen(true)}
                      aria-label="Open Trust Score profile"
                      style={{
                        color: tierColor,
                        borderColor: trustScore && trustScore.tier !== 'Source'
                          ? `${tierColor}77`
                          : undefined,
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        overflow: 'hidden',
                      }}
                    >
                      <TrustBadge tier={tier} size={40} />
                    </button>
                    <div
                      className="side-btn-label"
                      style={{
                        color: tierColor,
                        fontFamily: 'monospace',
                        fontWeight: 700,
                        fontSize: 10,
                        letterSpacing: 0.4,
                      }}
                    >
                      {trustScore ? Math.round(trustScore.score) : '—'}
                    </div>
                  </div>
                )
              })()}
              {/* Weekly Leaderboard button. Opens a modal with top-50
                  ranking + current TON reward pool + payout countdown. */}
              {tonWallet && (
                <div>
                  <button
                    className="side-btn"
                    onClick={() => setLeaderboardOpen(true)}
                    aria-label="Open weekly leaderboard"
                    style={{ color: '#ffd700', borderColor: 'rgba(255,215,0,0.4)' }}
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:22,height:22}} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M6 9V5a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v4" />
                      <path d="M6 9a4 4 0 0 0 4 4h4a4 4 0 0 0 4-4" />
                      <path d="M3 5h3v4a3 3 0 0 1-3-3V5z" />
                      <path d="M21 5h-3v4a3 3 0 0 0 3-3V5z" />
                      <path d="M9 18h6" />
                      <path d="M10 22h4" />
                      <path d="M12 13v9" />
                    </svg>
                  </button>
                  <div className="side-btn-label" style={{ color: '#ffd700' }}>
                    RANK
                  </div>
                </div>
              )}
              {/* CRT / broadcast-noise toggle. Off by default (evidence
                  first); flipping it on adds scanlines + grain +
                  vignette to captures for a retro TV aesthetic. Choice
                  persists across sessions via localStorage. */}
              <div>
                <button
                  className="side-btn"
                  onClick={() => setCrtMode((v) => !v)}
                  aria-label={crtMode ? 'Disable CRT effect (proof mode)' : 'Enable CRT effect'}
                  aria-pressed={crtMode}
                  style={{
                    color: crtMode ? '#00ff87' : '#fff',
                    borderColor: crtMode ? 'rgba(0,255,135,0.6)' : undefined,
                  }}
                >
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:22,height:22}} strokeLinecap="round" strokeLinejoin="round">
                    <rect x="2" y="4" width="20" height="14" rx="2" />
                    <path d="M8 20h8" />
                    <path d="M12 18v2" />
                    <path d="M4 8h16" strokeDasharray="2 2" />
                    <path d="M4 12h16" strokeDasharray="2 2" />
                  </svg>
                </button>
                <div
                  className="side-btn-label"
                  style={{ color: crtMode ? '#00ff87' : undefined }}
                >
                  {crtMode ? 'CRT ON' : 'CRT'}
                </div>
              </div>
            </div>

            <div className="bottom-controls">
              {/* Zoom controls removed — app always opens to the widest FOV
                  (back ultra-wide / front 4:3) and lets the user flip cameras
                  with the FLIP button. */}
              <div className="mode-tabs">
                <button className={`mode-tab ${captureMode === 'photo' ? 'active' : ''}`} onClick={() => !recording && setCaptureMode('photo')}>PHOTO</button>
                <button
                  className={`mode-tab ${captureMode === 'video' ? 'active' : ''}`}
                  onClick={async () => {
                    if (recording) return;
                    setCaptureMode('video');
                    // Photo mode uses a video-only stream (no mic
                    // permission requested on Mini App open). When
                    // the user switches into video mode we need to
                    // re-negotiate the stream to include audio so
                    // MediaRecorder can lay down a real audio track.
                    // The re-request also is the user gesture that
                    // consents to the mic permission dialog.
                    const currentStream = streamRef.current;
                    const hasAudio = currentStream?.getAudioTracks().length ?? 0;
                    if (!hasAudio) {
                      // Reinitialise the stream with audio, then
                      // apply the SAME lens/zoom pipeline that the
                      // initial mount uses so the FOV matches PHOTO
                      // mode exactly. Previously we jumped straight
                      // to the discrete ultra-wide device, but on
                      // iOS 17+ the composite "Back Camera" honours
                      // `applyConstraints({ zoom: min })` which
                      // gives a slightly wider crop than the
                      // discrete Ultra Wide device — that's the
                      // FOV the user was seeing in PHOTO mode.
                      if (facingMode === 'user') {
                        await startCamera('user', { frontWide: true, audio: true });
                      } else {
                        await startCamera('environment', { audio: true });
                        const track = streamRef.current?.getVideoTracks()[0];
                        const caps = (track as unknown as { getCapabilities?: () => { zoom?: { min?: number } } })?.getCapabilities?.();
                        let usedZoomConstraint = false;
                        if (track && caps?.zoom && (caps.zoom.min ?? 1) < 1) {
                          try {
                            await (track as unknown as { applyConstraints: (c: unknown) => Promise<void> })
                              .applyConstraints({ advanced: [{ zoom: caps.zoom.min }] });
                            usedZoomConstraint = true;
                          } catch { /* fall through to ultrawide device swap */ }
                        }
                        if (!usedZoomConstraint) {
                          const uwId = await findBackCameraDeviceId('ultrawide');
                          if (uwId) {
                            await startCamera('environment', { deviceId: uwId, audio: true });
                            setIsUltraWide(true);
                          }
                        }
                      }
                    }
                  }}
                >VIDEO</button>
              </div>
              <button className={`btn-capture ${captureMode === 'video' ? 'video-mode' : ''} ${recording ? 'recording' : ''}`} onClick={captureMode === 'photo' ? handleCapture : handleVideoCapture} />
            </div>

            <div className={`flash-overlay ${flash ? 'active' : ''}`} />
            {recording && <div className="rec-progress"><div className="rec-progress-fill" style={{width: `${(recordingTime / MAX_REC) * 100}%`}} /></div>}


          </>
        )}

        {screen === "worldid" && proofData && (
          <div className="wid-screen">
            {(capturedImage || capturedVideoUrl) ? (
              // Plain white card. The captured photo/video lives behind
              // the Replay/View modal — here the background is just clean
              // canvas for the comment input and button stack.
              <div className="wid-bg" style={{ background: '#fff' }} />
            ) : (
              <div className="wid-bg" style={{background:'#111'}} />
            )}
            <div className="wid-overlay">
              <div className="wid-top">
                {(capturedImage || capturedVideoUrl) ? (
                  // White-card variant: ditch the zkTruth logo / LIVE
                  // pill / CAPTURED chip so the centered brand icon and
                  // the button stack read as the whole composition.
                  // Only the close button stays so the user can still
                  // back out of the verify screen.
                  <button
                    className="wid-back"
                    onClick={handleReset}
                    style={{ background: 'rgba(0,0,0,0.08)', color: '#111' }}
                  >✕</button>
                ) : (
                  <>
                    <div style={{display:'flex',alignItems:'center',gap:10}}>
                      <button className="wid-back" onClick={handleReset}>✕</button>
                      <svg className="logo-icon" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10z" stroke="white" />
                        <path d="m8 9.5 2.5 2.5 5-5" stroke="#00c864" />
                      </svg>
                      <div className="logo-text">
                        <span className="logo-zk">zk</span>
                        <span className="logo-truth">Truth</span>
                      </div>
                      <div className="live-badge"><div className="live-dot" />LIVE</div>
                    </div>
                    <div className="wid-badge">CAPTURED</div>
                  </>
                )}
              </div>
              {(capturedImage || capturedVideoUrl) && (
                // Free-form comment input sits in the top half of the
                // white card. The user types whatever caption they want
                // attached to this capture; the button stack at the
                // bottom is where the mint actions live.
                <textarea
                  value={captureComment}
                  onChange={(e) => setCaptureComment(e.target.value)}
                  placeholder="Add a comment about this capture..."
                  style={{
                    position: 'absolute',
                    top: 80,
                    left: 16,
                    right: 16,
                    height: '42%',
                    padding: '14px 16px',
                    border: '1.5px solid #111',
                    borderRadius: 14,
                    background: '#fff',
                    color: '#111',
                    fontFamily: 'Space Mono, monospace',
                    fontSize: 14,
                    lineHeight: 1.45,
                    resize: 'none',
                    outline: 'none',
                    boxShadow: '0 4px 18px rgba(0,0,0,0.06)',
                    boxSizing: 'border-box',
                    WebkitAppearance: 'none',
                    zIndex: 4,
                  }}
                />
              )}
              <div className="wid-bottom">
                {!(capturedImage || capturedVideoUrl) && (
                  // The hash + timestamp belong on the cinematic
                  // photo/video preview backgrounds — they overlap the
                  // centered icon awkwardly on the white card, so we
                  // omit them in that variant.
                  <>
                    <div className="wid-hash">{proofData.hash.slice(0,22)}...</div>
                    <div className="wid-time">{proofData.timestamp.split('T')[1]?.split('.')[0]} UTC • TON</div>
                  </>
                )}
                {(capturedImage || capturedVideoUrl) && (
                  // Preview button sits directly above VERIFY at matching
                  // size. Tap opens an in-app modal that shows the
                  // captured video (with audio + controls) or the photo
                  // full-screen, and closes with the × / backdrop tap.
                  // Label flips between REPLAY (video) and VIEW (photo)
                  // so the affordance still reads correctly for stills.
                  <button
                    type="button"
                    className="wid-verify-btn"
                    onClick={() => setReplayOpen(true)}
                    style={{
                      background: '#fff',
                      border: '1.5px solid #111',
                      color: '#111',
                      boxShadow: 'none',
                      marginBottom: 10,
                    }}
                  >
                    {capturedVideoUrl ? '▶ REPLAY' : '🖼 VIEW'}
                  </button>
                )}
                {/* Phase 2: World ID verification button has been retired.
                    The zkTruth pivot to Telegram Mini App + TON drops the
                    World ID gate entirely — humanity is inferred from the
                    Telegram account (phone-number-verified by construction).
                    The old <WorldIdVerifyButton /> and the wagmi/IDKit
                    handlers it depended on are no longer rendered; their
                    supporting code will be deleted in a follow-up commit
                    once Phase 4 (TON Tact contract) lands. */}
                {/* SIGN THIS HASH is the quick-share path: it posts
                    the captured media + hash straight to the public
                    Telegram channel via our Bot API relay — no wallet,
                    no on-chain transaction. If the user happens to
                    have a wallet linked already, `handleShareWithImage`
                    picks it up automatically and includes the address
                    in the caption as attribution; otherwise the post
                    lands anonymously. Wallet connection is deferred
                    to the MINT ON TON flow where it's actually needed
                    for signing the on-chain mint. */}
                <button
                  type="button"
                  className="wid-verify-btn"
                  onClick={handleShareWithImage}
                  disabled={sharing}
                  style={{
                    marginTop: 10,
                    background: '#0098ea',
                    backgroundImage: 'none',
                    color: '#fff',
                    boxShadow: '0 4px 18px rgba(0,152,234,0.32)',
                    opacity: sharing ? 0.6 : 1,
                    cursor: sharing ? 'wait' : 'pointer',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 2,
                    lineHeight: 1.2,
                    padding: '12px 16px',
                  }}
                >
                  {sharing ? (
                    <span style={{ fontWeight: 700 }}>POSTING...</span>
                  ) : (
                    <>
                      <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: 0.5 }}>
                        📢 POST HASH TO CHANNEL · FREE
                      </span>
                      <span
                        style={{
                          fontSize: 10,
                          opacity: 0.85,
                          fontWeight: 500,
                          letterSpacing: 0.3,
                        }}
                      >
                        {shortTonAddr
                          ? `no gas · signed as ${shortTonAddr}`
                          : 'no gas · no wallet needed'}
                      </span>
                    </>
                  )}
                </button>

                {/* Placeholder mint button — routes into the existing
                    confirm-tx flow but the actual chain call is stubbed
                    until the TON contract is deployed. Once that's done,
                    onPress will submit through TON Connect. Rendered
                    in a neutral grey — `backgroundImage: none` is
                    required because `.wid-verify-btn` defaults to a
                    linear-gradient which would otherwise mask the flat
                    grey we want here. */}
                <button
                  type="button"
                  className="wid-verify-btn"
                  onClick={() => { setMintMode('verified'); setScreen('confirm-tx'); }}
                  style={{
                    marginTop: 10,
                    background: '#a8a8a8',
                    backgroundImage: 'none',
                    color: '#fff',
                    boxShadow: 'none',
                  }}
                >
                  MINT ON TON
                </button>
                {/* MINT :: PAY GAS removed — the NFT MINT button above
                    is now the single mint affordance, going active once
                    World ID verification completes. */}
              </div>
            </div>
            {worldIdVerified && (
              <div className="wid-verified">
                <div className="wid-verified-icon"><svg viewBox="0 0 24 24" fill="none" stroke="#00ff87" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5L20 7"/></svg></div>
                <div className="wid-verified-title">Proof Accepted</div>
                <div className="wid-verified-sub">Zero-knowledge proof validated · Initiating on-chain mint</div>
              </div>
            )}
            {replayOpen && (capturedImage || capturedVideoUrl) && (
              // Fullscreen in-app preview. For photos this doubles as
              // a lightweight blur editor: tap BLUR to enable brush
              // mode, then finger-drag over faces/plates/etc. The
              // brush paints from a pre-blurred hidden canvas so the
              // result is a natural-looking gaussian-blur mask baked
              // into the same JPEG that gets shared/minted.
              // For videos we fall back to the plain <video> player —
              // editing video frames is out of scope for the MVP.
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  background: '#000',
                  zIndex: 50,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
                // Backdrop dismiss is disabled while the user is
                // actively editing so accidental taps don't discard
                // their work. They can still close via the × button.
                onClick={() => { if (!blurMode) setReplayOpen(false); }}
              >
                {capturedVideoUrl ? (
                  <video
                    src={capturedVideoUrl}
                    controls
                    autoPlay
                    playsInline
                    style={{
                      maxWidth: '100%',
                      maxHeight: '100%',
                      background: '#000',
                    }}
                    onClick={(e) => e.stopPropagation()}
                  />
                ) : (
                  capturedImage && (
                    <canvas
                      ref={blurCanvasRef}
                      onClick={(e) => e.stopPropagation()}
                      onPointerDown={handleBlurPointerDown}
                      onPointerMove={handleBlurPointerMove}
                      onPointerUp={handleBlurPointerUp}
                      onPointerCancel={handleBlurPointerUp}
                      onPointerLeave={handleBlurPointerUp}
                      onTouchStart={handleBlurTouchStart}
                      onTouchMove={handleBlurTouchMove}
                      onTouchEnd={handleBlurTouchEnd}
                      onTouchCancel={handleBlurTouchEnd}
                      style={{
                        display: 'block',
                        // Explicit width/height set in the load
                        // handler above — leaving these undefined so
                        // the canvas renders at the JS-computed
                        // display box instead of its intrinsic
                        // pixel dimensions (which would overflow the
                        // viewport into black).
                        touchAction: blurMode ? 'none' : 'auto',
                        cursor: blurMode ? 'crosshair' : 'default',
                        userSelect: 'none',
                      }}
                    />
                  )
                )}

                {/* Editor toolbar — only shown for photos (video edit
                    is out of scope for MVP). Bottom-left placement
                    keeps it out of the way of both the top-right ×
                    and the middle of the image where the user is
                    painting. */}
                {!capturedVideoUrl && capturedImage && (
                  <div
                    style={{
                      position: 'absolute',
                      bottom: 24,
                      left: 14,
                      display: 'flex',
                      gap: 8,
                      zIndex: 2,
                      flexWrap: 'wrap',
                    }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => setBlurMode((b) => !b)}
                      style={{
                        height: 44,
                        padding: '0 16px',
                        borderRadius: 22,
                        border: 'none',
                        background: blurMode ? '#00c864' : 'rgba(255,255,255,0.95)',
                        color: blurMode ? '#000' : '#111',
                        fontFamily: 'Space Mono, monospace',
                        fontSize: 12,
                        fontWeight: 800,
                        letterSpacing: 1.5,
                        cursor: 'pointer',
                        boxShadow: '0 4px 18px rgba(0,0,0,0.4)',
                      }}
                    >
                      {blurMode ? 'BLUR :: ON' : 'BLUR :: OFF'}
                    </button>
                    {blurDirty && (
                      <>
                        <button
                          type="button"
                          onClick={handleBlurReset}
                          style={{
                            height: 44,
                            padding: '0 14px',
                            borderRadius: 22,
                            border: 'none',
                            background: 'rgba(0,0,0,0.75)',
                            color: '#fff',
                            fontFamily: 'Space Mono, monospace',
                            fontSize: 12,
                            fontWeight: 800,
                            letterSpacing: 1,
                            cursor: 'pointer',
                            boxShadow: '0 4px 18px rgba(0,0,0,0.4)',
                          }}
                        >
                          RESET
                        </button>
                        <button
                          type="button"
                          onClick={handleBlurSave}
                          style={{
                            height: 44,
                            padding: '0 16px',
                            borderRadius: 22,
                            border: 'none',
                            background: '#111',
                            color: '#fff',
                            fontFamily: 'Space Mono, monospace',
                            fontSize: 12,
                            fontWeight: 800,
                            letterSpacing: 1.5,
                            cursor: 'pointer',
                            boxShadow: '0 4px 18px rgba(0,0,0,0.4)',
                          }}
                        >
                          SAVE
                        </button>
                      </>
                    )}
                  </div>
                )}

                {/* Top-right ✕ removed per user request. Dismissal is
                    handled by the Telegram system back arrow (see
                    useTelegramBackButton — it closes the replay modal
                    first before returning to the verify screen) and
                    by tapping the backdrop when not in BLUR mode. */}
              </div>
            )}
          </div>
        )}

        {screen === "confirm-tx" && proofData && (
          <div className="overlay-screen">
            <div className="overlay-header">
              <div style={{display:'flex',alignItems:'center',gap:10}}>
                <svg className="logo-icon" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10z" stroke="white"/><path d="m8 9.5 2.5 2.5 5-5" stroke="#00c864"/></svg>
                <div className="logo-text"><span className="logo-zk">zk</span><span className="logo-truth">Truth</span></div>
                <div className="live-badge"><div className="live-dot" />LIVE</div>
              </div>
              {/* The in-page BACK button was removed to avoid a
                  duplicate affordance next to Telegram's own back
                  arrow in the Mini App header. See useTelegramBackButton
                  wiring — the system arrow now routes back to the
                  verify screen instead of the camera. */}
            </div>
            <div className="confirm-tx-body">
              {/* Official TON logo — pixel-perfect crop of the user's
                  reference image (a light-blue rounded square with the
                  stylized T mark). Using a PNG keeps the mark exactly
                  as the network's design system defines it instead of
                  approximating it in code. */}
              <div className="tx-icon tx-icon--ton">
                <img
                  src="/ton-logo.png"
                  alt="TON"
                  draggable={false}
                />
              </div>
              <div className="tx-title">SIGN TO MINT</div>
              <div className="tx-desc">Confirm the transaction in your Gram wallet to stamp this capture as a Proof of Capture on chain.</div>
              <div className="tx-details">
                <div className="tx-detail-row">
                  <span className="tx-detail-key">NETWORK</span>
                  <span className="tx-detail-value">TON L1 · Mainnet</span>
                </div>
                <div className="tx-detail-row">
                  <span className="tx-detail-key">ACTION</span>
                  <span className="tx-detail-value">MINT :: PROOF NFT</span>
                </div>
                <div className="tx-detail-row">
                  <span className="tx-detail-key">FEE</span>
                  <span className="tx-detail-value highlight">~ {TON_GAS_FEE}</span>
                </div>
                <div className="tx-detail-row">
                  <span className="tx-detail-key">WALLET</span>
                  <span className="tx-detail-value">{shortTonAddr ?? 'Not connected'}</span>
                </div>
              </div>
              <div className="tx-warning">Gram fees on TON are typically fractions of a cent. Your wallet will display the exact amount before signing.</div>
              <button
                className="btn-confirm-tx"
                onClick={handleConfirmTx}
                disabled={minting}
                style={{ opacity: minting ? 0.6 : 1, cursor: minting ? 'wait' : 'pointer' }}
              >
                {minting ? 'AWAITING WALLET...' : `SIGN & MINT · ${TON_GAS_FEE}`}
              </button>
              <button className="btn-cancel-tx" onClick={() => { setMinting(false); setMintingStartedAt(null); setScreen("worldid") }}>CANCEL</button>
              {/* Escape hatch: if the wallet handoff dropped the
                  tonconnect response (Telegram → wallet app → Telegram
                  return can lose the callback on some carriers), the
                  mint is already on-chain but the app is still stuck
                  on AWAITING WALLET. This button lets the user advance
                  to the share screen once the wallet has signed. Only
                  appears after 15s so it doesn't tempt people into
                  bailing before actually signing. */}
              {minting && mintTakingLong && (
                <button
                  className="btn-cancel-tx"
                  style={{
                    marginTop: 8,
                    background: 'rgba(0,200,100,0.12)',
                    border: '1px solid rgba(0,200,100,0.35)',
                    color: '#00c864',
                  }}
                  onClick={() => {
                    setMinting(false)
                    setMintingStartedAt(null)
                    setMintComplete(true)
                    setShareStatus('Mint sent to TON — see it on tonviewer soon')
                    setTimeout(() => setShareStatus(''), 6000)
                    setScreen('share')
                  }}
                >
                  ALREADY SIGNED? CONTINUE →
                </button>
              )}
            </div>
          </div>
        )}

        {screen === "minting" && proofData && (
          <div className="wid-screen">
            {capturedImage ? <img src={capturedImage} alt="" className="wid-bg" /> : capturedVideoUrl ? <video src={capturedVideoUrl} className="wid-bg" autoPlay loop muted playsInline /> : <div className="wid-bg" style={{background:'#111'}} />}
            <div className="wid-overlay">
              <div className="wid-top">
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <button className="wid-back" onClick={handleReset}>✕</button>
                  <svg className="logo-icon" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10z" stroke="white"/><path d="m8 9.5 2.5 2.5 5-5" stroke="#00c864"/></svg>
                  <div className="logo-text"><span className="logo-zk">zk</span><span className="logo-truth">Truth</span></div>
                  <div className="live-badge"><div className="live-dot" />LIVE</div>
                </div>
                <div className="wid-badge">MINTING</div>
              </div>
              <div className="wid-bottom">
                <div className="mint-status" style={{margin:0}}>
                  <div className="status-bar-bg"><div className="status-bar-fill" style={{width: `${currentStep.progress}%`}} /></div>
                  <div className="status-text"><span className="current">{currentStep.label}</span><span>{currentStep.progress}%</span></div>
                </div>
                <button className="wid-verify-btn" onClick={() => openSnsShare("minting")}>SHARE</button>
              </div>
            </div>
            {mintComplete && (
              <div className="wid-verified">
                <div className="wid-verified-icon"><svg viewBox="0 0 24 24" fill="none" stroke="#00ff87" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5L20 7"/></svg></div>
                <div className="wid-verified-title">Minted On-Chain</div>
                <div className="wid-verified-sub">Immutable proof stored on World Chain · Publicly verifiable</div>
                <div style={{fontSize:10,color:'#00c8ff',background:'rgba(0,200,255,0.1)',border:'1px solid rgba(0,200,255,0.2)',padding:'8px 16px',borderRadius:12,maxWidth:300,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{txHash}</div>
                <div style={{display:'flex',gap:8,width:'100%',maxWidth:300}}>
                  <button className="wid-verify-btn" style={{flex:1}} onClick={handleShareWithImage}>SHARE</button>
                  <button className="wid-verify-btn" style={{flex:1,background:'linear-gradient(135deg, #00ff87, #00cc66)',color:'#000'}} onClick={handleReset}>NEW CAPTURE</button>
                </div>
              </div>
            )}
          </div>
        )}

        {screen === "share" && proofData && (
          <div className="wid-screen">
            <div className="wid-bg" style={{ background: '#fff' }} />
            <div className="wid-overlay">
              <div className="wid-top">
                <button
                  className="wid-back"
                  onClick={handleReset}
                  style={{ background: 'rgba(0,0,0,0.08)', color: '#111' }}
                >✕</button>
                <div
                  className="wid-badge"
                  style={{ background: '#111', color: '#fff', border: 'none' }}
                >{mintMode === "verified" ? "ZKP VERIFIED" : "UNVERIFIED"}</div>
              </div>
              <div className="wid-bottom">
                <div className="wid-hash" style={{ color: '#444' }}>SHA-256: {proofData.hash.slice(0,22)}...</div>
                <div className="wid-time" style={{ color: '#777' }}>{proofData.timestamp.split('T')[1]?.split('.')[0]} UTC • {proofData.chain} • #{proofData.tokenId.toString().padStart(6,'0')}</div>
                <div style={{display:'flex',gap:10}}>
                  <button
                    className="wid-verify-btn"
                    onClick={() => openSnsShare("share")}
                    style={{
                      flex: mintComplete ? undefined : 1,
                      width: mintComplete ? '100%' : undefined,
                      background: '#fff',
                      border: '1.5px solid #111',
                      color: '#111',
                      boxShadow: 'none',
                    }}
                  >SHARE</button>
                  {/* Hide the NFT MINT button once this capture has already
                      been minted — otherwise the user gets tempted into a
                      duplicate mint that would cost another 0.15 TON for
                      the same content. */}
                  {!mintComplete && (
                    <button
                      className="wid-verify-btn"
                      onClick={() => { setScreen("minting"); startMinting(); }}
                      style={{
                        flex: 1,
                        background: '#111',
                        color: '#fff',
                        boxShadow: '0 4px 18px rgba(0,0,0,0.18)',
                      }}
                    >NFT MINT</button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {screen === "sns-share" && proofData && (
          <div className="wid-screen">
            {capturedImage ? <img src={capturedImage} alt="" className="wid-bg" /> : capturedVideoUrl ? <video src={capturedVideoUrl} className="wid-bg" autoPlay loop muted playsInline /> : <div className="wid-bg" style={{background:'#111'}} />}
            <div className="wid-overlay">
              <div className="wid-top">
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <button className="wid-back" onClick={() => setScreen(snsFromScreen)}>✕</button>
                  <svg className="logo-icon" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10z" stroke="white"/><path d="m8 9.5 2.5 2.5 5-5" stroke="#00c864"/></svg>
                  <div className="logo-text"><span className="logo-zk">zk</span><span className="logo-truth">Truth</span></div>
                  <div className="live-badge"><div className="live-dot" />LIVE</div>
                </div>
                <div className="wid-badge">SHARE PROOF</div>
              </div>
              <div className="wid-bottom">
                {/* Telegram-only share flow. The primary action posts
                    the capture into the public zkTruth channel via the
                    Bot API; the secondary action copies the resulting
                    channel URL so the user can paste it into X/other
                    apps later if they want cross-posting. The old
                    POST TO X + FARCASTER buttons were removed as part
                    of the TON pivot — the channel post is now the
                    canonical shareable proof URL. */}
                <button
                  className="wid-verify-btn"
                  onClick={handleShareWithImage}
                  style={{
                    background: '#229ED9',
                    backgroundImage: 'none',
                    color: '#fff',
                    boxShadow: '0 4px 18px rgba(34,158,217,0.32)',
                  }}
                >
                  POST TO CHANNEL
                </button>
                {/* Dedicated X share button. This one bypasses Telegram's
                    built-in Share-to-X (which always sends the t.me URL
                    and hands X Telegram's own OG card) by pre-filling
                    the tweet composer directly with our /proof URL —
                    X then scrapes that URL and shows the zkTruth
                    thumbnail + about section as the card. */}
                <button
                  className="wid-verify-btn"
                  onClick={openXShare}
                  disabled={xPostingStatus === 'posting'}
                  style={{
                    background: '#000',
                    backgroundImage: 'none',
                    color: '#fff',
                    boxShadow: '0 4px 18px rgba(0,0,0,0.35)',
                    border: '1px solid rgba(255,255,255,0.18)',
                    opacity: xPostingStatus === 'posting' ? 0.6 : 1,
                    cursor: xPostingStatus === 'posting' ? 'wait' : 'pointer',
                  }}
                >
                  {xPostingStatus === 'posting' ? 'POSTING...' : 'POST TO CHANNEL + X'}
                </button>
                {/* Farcaster (Warpcast) broadcast. Purple mirrors the
                    Warpcast brand so users recognise the destination
                    at a glance. */}
                <button
                  className="wid-verify-btn"
                  onClick={openFarcasterShare}
                  disabled={xPostingStatus === 'posting'}
                  style={{
                    background: '#7C65C1',
                    backgroundImage: 'none',
                    color: '#fff',
                    boxShadow: '0 4px 18px rgba(124,101,193,0.4)',
                    border: '1px solid rgba(255,255,255,0.18)',
                    opacity: xPostingStatus === 'posting' ? 0.6 : 1,
                    cursor: xPostingStatus === 'posting' ? 'wait' : 'pointer',
                  }}
                >
                  {xPostingStatus === 'posting' ? 'POSTING...' : 'POST TO CHANNEL + FARCASTER'}
                </button>
                {/* Truth Social broadcast. Uses the platform's red
                    accent. */}
                <button
                  className="wid-verify-btn"
                  onClick={openTruthShare}
                  disabled={xPostingStatus === 'posting'}
                  style={{
                    background: '#B02F2F',
                    backgroundImage: 'none',
                    color: '#fff',
                    boxShadow: '0 4px 18px rgba(176,47,47,0.4)',
                    border: '1px solid rgba(255,255,255,0.18)',
                    opacity: xPostingStatus === 'posting' ? 0.6 : 1,
                    cursor: xPostingStatus === 'posting' ? 'wait' : 'pointer',
                  }}
                >
                  {xPostingStatus === 'posting' ? 'POSTING...' : 'POST TO CHANNEL + TRUTH SOCIAL'}
                </button>
                {/* Fan-out to all three externals in one gesture.
                    Gold gradient so it visually pops as the "power"
                    action. Composer windows open in sequence with a
                    250 ms stagger so mobile WebViews don't coalesce
                    them into a single blocked popup. */}
                <button
                  className="wid-verify-btn"
                  onClick={openAllSocials}
                  disabled={xPostingStatus === 'posting'}
                  style={{
                    background: 'linear-gradient(135deg,#ffcf5c 0%,#ff7a4d 50%,#B02F2F 100%)',
                    backgroundImage: 'linear-gradient(135deg,#ffcf5c 0%,#ff7a4d 50%,#B02F2F 100%)',
                    color: '#fff',
                    boxShadow: '0 4px 22px rgba(255,207,92,0.45)',
                    border: '1px solid rgba(255,255,255,0.28)',
                    opacity: xPostingStatus === 'posting' ? 0.6 : 1,
                    cursor: xPostingStatus === 'posting' ? 'wait' : 'pointer',
                    fontWeight: 900,
                  }}
                >
                  {xPostingStatus === 'posting' ? 'POSTING...' : '🚀 POST TO ALL (X + FARCASTER + TRUTH)'}
                </button>
                <button className="wid-gas-btn" onClick={handleCopyLink}>
                  <span>🔗</span> COPY LINK
                </button>
                <div className="sns-copy-status">{copyStatus}</div>
              </div>
            </div>
          </div>
        )}

        {/* Weekly Leaderboard modal. Ranks the top 50 wallets by the
            hybrid ranking score (weekly-heavy) and shows the projected
            TON payout each would receive if the epoch closed now. */}
        {leaderboardOpen && (
          <div
            className="privacy-modal-backdrop"
            onClick={() => setLeaderboardOpen(false)}
            style={{ padding: 0 }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                // Full-screen sheet on mobile so the leaderboard uses
                // every pixel available. Was a 420-wide modal — too
                // cramped for scanning 100 rows.
                position: 'fixed',
                inset: 0,
                background: '#0a0a0a',
                display: 'flex',
                flexDirection: 'column',
                zIndex: 1000,
              }}
            >
              {/* Close is via Telegram's native BackButton — the ← arrow
                  in the header, wired through useTelegramBackButton
                  above. No in-app close button needed. */}
              <div style={{
                // Nudge the whole header block down so the "WEEKLY
                // LEADERBOARD" caption clears Telegram's own header
                // area and the composition feels less top-heavy.
                padding: 'calc(env(safe-area-inset-top, 0px) + 60px) 24px 20px',
                textAlign: 'center',
                flexShrink: 0,
              }}>
                <div style={{
                  fontFamily: 'monospace',
                  fontSize: 14,
                  fontWeight: 700,
                  letterSpacing: 2,
                  color: '#e0e0e0',
                  marginBottom: 10,
                }}>
                  WEEKLY LEADERBOARD
                </div>
                <div style={{
                  fontFamily: 'monospace',
                  fontSize: 64,
                  fontWeight: 800,
                  color: '#ffd700',
                  lineHeight: 1,
                  textShadow: '0 0 24px rgba(255,215,0,0.5)',
                }}>
                  {leaderboard ? leaderboard.poolTon.toFixed(3) : '—'} <span style={{ fontSize: 28 }}>TON</span>
                </div>
                <div style={{ fontSize: 14, color: '#ccc', marginTop: 10, fontWeight: 500 }}>
                  Prize pool · {leaderboard?.mintCount ?? 0} mints this week
                </div>
                {leaderboard?.nextPayoutMs && (() => {
                  const msLeft = Math.max(0, leaderboard.nextPayoutMs - Date.now())
                  const days = Math.floor(msLeft / 86_400_000)
                  const hours = Math.floor((msLeft % 86_400_000) / 3_600_000)
                  return (
                    <div style={{ fontSize: 13, color: '#bbb', marginTop: 6, fontFamily: 'monospace', fontWeight: 600 }}>
                      Payout in {days}d {hours}h · Epoch {leaderboard.epochId}
                    </div>
                  )
                })()}
                {/* Rules banner. Explicit so users understand why some
                    high-ranked wallets aren't getting paid — the mint
                    gate is intentional and visible. */}
                <div style={{
                  marginTop: 14,
                  padding: '10px 14px',
                  background: 'rgba(255,215,0,0.08)',
                  border: '1px solid rgba(255,215,0,0.28)',
                  borderRadius: 10,
                  fontSize: 12,
                  color: '#e6d78a',
                  lineHeight: 1.5,
                  fontFamily: 'monospace',
                  fontWeight: 600,
                  letterSpacing: 0.5,
                }}>
                  TOP 3 SPLIT · 60% / 30% / 10%
                  <br />
                  Requires ≥ {leaderboard?.minMintsForPayout ?? 3} verified mints this week
                </div>
              </div>
              <div style={{
                overflowY: 'auto',
                padding: '4px 16px calc(env(safe-area-inset-bottom, 0px) + 20px)',
                flex: 1,
                minHeight: 0,
                WebkitOverflowScrolling: 'touch',
              }}>
                {leaderboard && leaderboard.rows.length === 0 && (
                  <div style={{ color: '#ccc', fontSize: 16, textAlign: 'center', padding: '40px 24px', lineHeight: 1.6 }}>
                    No qualifying wallets this epoch yet.
                    <br />Be first — mint and get reactions to jump on the board.
                  </div>
                )}
                {leaderboard?.rows.map((row) => {
                  const isMe = tonWallet?.account.address &&
                    row.wallet.toLowerCase() === (() => {
                      try {
                        return Address.parse(tonWallet.account.address).toString({
                          urlSafe: true, bounceable: false, testOnly: false,
                        }).toLowerCase()
                      } catch { return '' }
                    })()
                  // Medal is now tied to the PAYOUT rank (top-3 among
                  // wallets that clear the mint quality gate), not the
                  // raw display rank. A wallet at overall #4 that
                  // qualifies while wallets ahead of them didn't can
                  // still hold a medal.
                  const pRank = row.payoutRank ?? null
                  const medal = pRank === 1 ? '🥇' : pRank === 2 ? '🥈' : pRank === 3 ? '🥉' : null
                  const paid = row.eligibleForPayout && row.payoutTon > 0
                  const gateShort = leaderboard?.minMintsForPayout ?? 3
                  return (
                    <div
                      key={row.wallet}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: 14,
                        padding: '14px 12px',
                        borderRadius: 12,
                        background: isMe ? 'rgba(255,215,0,0.14)' : 'rgba(255,255,255,0.05)',
                        border: isMe ? '1.5px solid rgba(255,215,0,0.5)' : '1px solid rgba(255,255,255,0.08)',
                        marginBottom: 8,
                        opacity: !row.eligibleForPayout ? 0.72 : 1,
                      }}
                    >
                      <div style={{
                        width: 44,
                        textAlign: 'center',
                        fontFamily: 'monospace',
                        fontWeight: 800,
                        color: medal ? '#ffd700' : '#e0e0e0',
                        fontSize: medal ? 26 : 18,
                      }}>
                        {medal ?? `#${row.rank}`}
                      </div>
                      <TrustBadge tier={row.tier} size={40} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{
                          fontFamily: 'monospace',
                          fontSize: 13,
                          color: '#fff',
                          fontWeight: 600,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {row.wallet.slice(0, 6)}…{row.wallet.slice(-4)}
                          {isMe && <span style={{ color: '#ffd700', marginLeft: 8, fontWeight: 800 }}>(YOU)</span>}
                        </div>
                        <div style={{ fontSize: 12, color: '#bbb', marginTop: 4, fontFamily: 'monospace' }}>
                          <span style={{ color: row.weeklyMints >= gateShort ? '#ffd700' : '#ff8080' }}>
                            {row.weeklyMints}m
                          </span>
                          {' · '}
                          <span style={{ color: '#e0e0e0' }}>{row.weeklyReactions}r</span>
                          {' · '}
                          <span style={{ color: '#aaa' }}>{row.weeklyPosts}p</span>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        {paid ? (
                          <>
                            <div style={{
                              fontFamily: 'monospace',
                              fontSize: 18,
                              fontWeight: 800,
                              color: '#00ff87',
                              textShadow: '0 0 8px rgba(0,255,135,0.3)',
                            }}>
                              {row.payoutTon.toFixed(3)}
                            </div>
                            <div style={{ fontSize: 11, color: '#aaa', fontFamily: 'monospace', fontWeight: 600, marginTop: 2 }}>
                              TON · score {Math.round(row.rankingScore)}
                            </div>
                          </>
                        ) : (
                          <>
                            <div style={{
                              fontFamily: 'monospace',
                              fontSize: 12,
                              fontWeight: 700,
                              color: '#ff8080',
                              lineHeight: 1.3,
                              maxWidth: 110,
                            }}>
                              NEED {gateShort - row.weeklyMints} MORE MINT{(gateShort - row.weeklyMints) === 1 ? '' : 'S'}
                            </div>
                            <div style={{ fontSize: 11, color: '#777', fontFamily: 'monospace', fontWeight: 600, marginTop: 4 }}>
                              score {Math.round(row.rankingScore)}
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
              <div style={{
                fontSize: 13,
                lineHeight: 1.55,
                color: '#ccc',
                padding: '14px 20px 20px',
                borderTop: '1px solid rgba(255,255,255,0.08)',
                flexShrink: 0,
                background: 'rgba(0,0,0,0.4)',
              }}>
                <div style={{ marginBottom: 4 }}>
                  <span style={{ color: '#e0e0e0', fontWeight: 700 }}>Ranking:</span>{' '}
                  weekly (mints×10 + reactions×5 + posts×1) × 70% + all-time Trust × 30%.
                </div>
                <div>
                  <span style={{ color: '#e0e0e0', fontWeight: 700 }}>Payout:</span>{' '}
                  Top 100 share 85% of mint fees. Every Monday 00:00 UTC.
                </div>
              </div>
            </div>
          </div>
        )}
        {/* Trust Score profile modal. Tapping the sidebar chip opens
            this — shows the full breakdown (posts / reactions / shares)
            plus the current tier badge. Data is fetched from the KV-
            backed /api/trust/<wallet> endpoint whenever the wallet or
            mintComplete flag changes. */}
        {/* Only fire the overlay on the main camera screen, after
            splash has finished, and never over the profile/leaderboard
            modals. That way a tier-up detected while the profile is
            open queues the animation for the next time the user is
            on the camera screen — matches the "one moment of glory,
            in the right place" spec, not "spam every screen". */}
        {promotion && screen === 'camera' && splashPhase >= 4
          && !trustProfileOpen && !leaderboardOpen && (
          <PromotionOverlay
            fromTier={promotion.from}
            toTier={promotion.to}
            score={trustScore ? Math.round(trustScore.score) : 0}
            onDone={() => {
              // Persist the destination tier so the same promotion
              // (or retro-celebrate) never fires again for this
              // wallet. Manual REPLAY from the profile will just
              // rewrite the same value it already stores, so no
              // harm done.
              try {
                const addr = tonWallet?.account.address
                if (addr) {
                  localStorage.setItem(`zk-lastSeenTier-v2-${addr}`, promotion.to)
                }
              } catch { /* private browsing */ }
              setPromotion(null)
            }}
          />
        )}
        {trustProfileOpen && (
          <div
            className="privacy-modal-backdrop"
            onClick={() => setTrustProfileOpen(false)}
            style={{ padding: 0 }}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: 'fixed',
                inset: 0,
                background: '#0a0a0a',
                display: 'flex',
                flexDirection: 'column',
                zIndex: 1000,
                overflowY: 'auto',
                WebkitOverflowScrolling: 'touch',
              }}
            >
              {/* Close is via Telegram's native BackButton (← in header). */}
              <div style={{
                padding: 'calc(env(safe-area-inset-top, 0px) + 60px) 24px 16px',
                textAlign: 'center',
                flexShrink: 0,
              }}>
                <div style={{
                  fontFamily: 'monospace',
                  fontSize: 16,
                  fontWeight: 800,
                  letterSpacing: 3,
                  color: '#ffffff',
                  marginBottom: 12,
                }}>
                  TRUST SCORE
                </div>
                {(() => {
                  const tier: TrustTierType = (trustScore?.tier as TrustTierType) ?? 'Source'
                  const tierColor = trustScore
                    ? (trustScore.tier === 'Truth-Teller' ? '#00ff87'
                      : trustScore.tier === 'Investigative Reporter' ? '#ff7a4d'
                      : trustScore.tier === 'Muckraker' ? '#ffcf5c'
                      : trustScore.tier === 'Whistleblower' ? '#4dd4ff'
                      : '#8b8b8b')
                    : '#8b8b8b'
                  return (
                    <>
                      <div style={{
                        display: 'flex',
                        justifyContent: 'center',
                        marginBottom: 16,
                        filter: trustScore && trustScore.tier !== 'Source'
                          ? `drop-shadow(0 0 16px ${tierColor}88)`
                          : undefined,
                      }}>
                        <TrustBadge tier={tier} size={140} />
                      </div>
                      <div style={{
                        fontFamily: 'monospace',
                        fontSize: 72,
                        fontWeight: 800,
                        lineHeight: 1,
                        color: tierColor,
                        textShadow: trustScore && trustScore.tier !== 'Source'
                          ? `0 0 24px ${tierColor}88`
                          : undefined,
                      }}>
                        {trustScore ? Math.round(trustScore.score) : '—'}
                      </div>
                      <div style={{
                        fontSize: 18,
                        fontWeight: 800,
                        letterSpacing: 3,
                        marginTop: 14,
                        color: tierColor,
                        textTransform: 'uppercase',
                      }}>
                        {trustScore?.tier ?? 'Source'}
                      </div>
                      {/* Manual replay of the promotion animation.
                          Hidden by design (small, subdued) so it feels
                          like an easter egg, but always available —
                          users who missed the auto-play (baseline was
                          recorded before the feature shipped, or they
                          just want to see it again) can trigger it. */}
                      {/* ALWAYS render — even for Source tier — with
                          a fallback demo target of Truth-Teller so we
                          have a reliable way to preview the animation.
                          Previously gated on hasMinted + non-Source
                          which hid the button for users still on the
                          baseline tier. */}
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          const target = tier !== 'Source' ? tier : ('Truth-Teller' as TrustTierType)
                          setPromotion({ from: 'Source', to: target })
                        }}
                        style={{
                          marginTop: 18,
                          padding: '10px 24px',
                          background: `${tierColor}22`,
                          border: `1.5px solid ${tierColor}`,
                          borderRadius: 999,
                          color: tierColor,
                          fontFamily: 'monospace',
                          fontSize: 12,
                          fontWeight: 800,
                          letterSpacing: 3,
                          cursor: 'pointer',
                          textTransform: 'uppercase',
                          boxShadow: `0 0 20px ${tierColor}55`,
                        }}
                      >
                        ▶ Play Promotion Animation
                      </button>
                    </>
                  )
                })()}
                {shortTonAddr && (
                  <div style={{ fontFamily: 'monospace', fontSize: 15, color: '#ffffff', marginTop: 12, fontWeight: 700 }}>
                    {shortTonAddr}
                  </div>
                )}
              </div>
              <div style={{ padding: '20px 24px calc(env(safe-area-inset-bottom, 0px) + 24px)', flexShrink: 0 }}>
                {/* Locked banner when the wallet hasn't minted yet —
                    events are still recorded so nothing is lost, but
                    score/tier/payout are all gated behind the first mint. */}
                {trustScore && !trustScore.hasMinted && (
                  <div style={{
                    background: 'rgba(255,207,92,0.12)',
                    border: '1px solid rgba(255,207,92,0.4)',
                    borderRadius: 12,
                    padding: '14px 16px',
                    marginBottom: 14,
                    fontSize: 14,
                    lineHeight: 1.5,
                    color: '#ffcf5c',
                    fontWeight: 700,
                  }}>
                    🔒 Mint 1 NFT to unlock Trust Score, tier badge, and
                    the weekly payout. Your posts + reactions ARE being
                    recorded — they retro-credit the moment you mint.
                  </div>
                )}
                <div style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(3, 1fr)',
                  gap: 10,
                  marginBottom: 18,
                }}>
                  {[
                    { label: 'POSTS',     value: trustScore?.posts ?? 0,          weight: 1 },
                    { label: 'MINTS',     value: trustScore?.mints ?? 0,          weight: 10 },
                    { label: 'REACTIONS', value: trustScore?.reactionsTotal ?? 0, weight: 5 },
                  ].map((it) => (
                    <div key={it.label} style={{
                      background: 'rgba(255,255,255,0.09)',
                      border: '1px solid rgba(255,255,255,0.2)',
                      borderRadius: 12,
                      padding: '16px 6px',
                      textAlign: 'center',
                    }}>
                      <div style={{ fontFamily: 'monospace', fontSize: 36, fontWeight: 800, color: '#00ff87', textShadow: '0 0 8px rgba(0,255,135,0.3)' }}>
                        {it.value}
                      </div>
                      <div style={{ fontSize: 13, letterSpacing: 1.5, color: '#ffffff', marginTop: 8, fontWeight: 800 }}>
                        {it.label}
                      </div>
                      <div style={{ fontSize: 13, color: '#cccccc', marginTop: 4, fontFamily: 'monospace', fontWeight: 700 }}>
                        ×{it.weight}
                      </div>
                    </div>
                  ))}
                </div>
                <div style={{
                  fontSize: 14,
                  lineHeight: 1.6,
                  color: '#ffffff',
                  padding: '14px 16px',
                  background: 'rgba(255,255,255,0.08)',
                  borderRadius: 10,
                  fontWeight: 600,
                }}>
                  Score = posts × 1 + mints × 10 + reactions × 5, with
                  time decay. Requires ≥1 mint to unlock — free posts
                  alone won&apos;t accrue.
                  <div style={{ marginTop: 10, display: 'grid', gap: 6 }}>
                    {([
                      { tier: 'Source' as const,                 range: '0–99',       col: '#8b8b8b' },
                      { tier: 'Whistleblower' as const,          range: '100–499',    col: '#4dd4ff' },
                      { tier: 'Muckraker' as const,              range: '500–2499',   col: '#ffcf5c' },
                      { tier: 'Investigative Reporter' as const, range: '2500–9999',  col: '#ff7a4d' },
                      { tier: 'Truth-Teller' as const,           range: '10000+',     col: '#00ff87' },
                    ]).map((t) => {
                      const isCurrent = trustScore?.tier === t.tier
                      return (
                        <div
                          key={t.tier}
                          style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 12,
                            padding: '10px 12px',
                            borderRadius: 10,
                            background: isCurrent ? `${t.col}30` : 'rgba(255,255,255,0.05)',
                            border: isCurrent ? `1.5px solid ${t.col}` : '1px solid rgba(255,255,255,0.12)',
                          }}
                        >
                          <TrustBadge
                            tier={t.tier}
                            size={40}
                            style={isCurrent ? undefined : { opacity: 0.85 }}
                          />
                          <span style={{
                            color: isCurrent ? t.col : '#ffffff',
                            fontWeight: isCurrent ? 800 : 700,
                            fontSize: 15,
                            flex: 1,
                          }}>
                            {t.tier}
                          </span>
                          <span style={{
                            color: isCurrent ? t.col : '#dddddd',
                            fontFamily: 'monospace',
                            fontSize: 14,
                            fontWeight: 700,
                          }}>{t.range}</span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Privacy notice modal. Explains what a "capture" actually
            publishes so users don't post GPS/media without knowing.
            Rendered at the app root so it works from any screen. */}
        {privacyOpen && (
          <div
            className="privacy-modal-backdrop"
            onClick={() => setPrivacyOpen(false)}
          >
            <div className="privacy-modal" onClick={(e) => e.stopPropagation()}>
              <button
                className="privacy-modal-close"
                onClick={() => setPrivacyOpen(false)}
                aria-label="Close"
              >
                ✕
              </button>
              <div className="privacy-modal-title">PRIVACY NOTICE</div>
              <div className="privacy-modal-body">
                <p>
                  zkTruth posts your captures to the public Telegram channel <b>@zktruth_capture</b>. Please review the following before capturing or posting.
                </p>
                <ul>
                  <li>
                    <b>Public post</b> — Photos and videos are posted to a publicly visible Telegram channel. Posts cannot be revoked except by channel admin removal.
                  </li>
                  <li>
                    <b>Faces &amp; portraits</b> — If a person&apos;s face is captured, you must obtain their <b>prior consent</b>. Posting without consent may violate portrait rights.
                  </li>
                  <li>
                    <b>Bystanders</b> — In public places, please blur bystanders&apos; faces when necessary before posting.
                  </li>
                  <li>
                    <b>Video mode has no blur editor</b> — The blur tool works on photos only. If your capture needs to redact faces, license plates, or any sensitive detail, <b>use Photo mode</b>. Videos are posted to the channel as recorded, without any masking.
                  </li>
                  <li>
                    <b>Minors</b> — Capturing or posting media of minors requires <b>parental consent</b>. Prioritize child safety.
                  </li>
                  <li>
                    <b>Private property &amp; venues</b> — Follow the rules of any location that restricts or prohibits photography (stores, museums, private venues, etc.).
                  </li>
                  <li>
                    <b>Location data</b> — If GPS is enabled, the capture location (coordinates or nearest place name) will be included in the post caption. Turn off location before capturing in private places.
                  </li>
                  <li>
                    <b>Timestamp</b> — The capture time (UTC) is included in the caption.
                  </li>
                  <li>
                    <b>Content hash</b> — The SHA-256 hash of the media is included in the caption. It lets others verify identical content but cannot reveal the media itself.
                  </li>
                  <li>
                    <b>Wallet address</b> — If a TON wallet is connected when posting, its address appears as the &ldquo;author&rdquo; in the caption. To post anonymously, tap SIGN THIS HASH without connecting a wallet.
                  </li>
                  <li>
                    <b>Data storage</b> — Media is hosted on Telegram&apos;s CDN; zkTruth servers do not store your media. Telegram&apos;s privacy policy applies.
                  </li>
                  <li>
                    <b>MINT ON TON</b> — If you choose on-chain minting, the hash and timestamp are written <b>permanently</b> to the TON blockchain. On-chain records cannot be deleted.
                  </li>
                </ul>
                <p className="privacy-modal-final">
                  Content that violates others&apos; privacy, portrait rights, or copyright, or that is violent, discriminatory, or illegal, is prohibited. Violating posts will be removed by channel admins, and repeat offenders may have their access restricted.
                </p>
              </div>
              <button
                className="privacy-modal-ok"
                onClick={() => setPrivacyOpen(false)}
              >
                UNDERSTOOD
              </button>
            </div>
          </div>
        )}

        {/* Full-screen posting spinner overlay. Blocks input, shows a
            spinning ring + progress label so the user has an
            unambiguous "something is happening" signal beyond just
            the small toast at the top of the screen. */}
        {sharing && (
          <div className="posting-overlay">
            <div className="posting-spinner" />
            <div className="posting-label">POSTING TO CHANNEL</div>
            <div className="posting-sub">@zktruth_capture · Telegram</div>
          </div>
        )}

        {/* Success burst — replaces the spinner overlay for ~1.5s
            after the Bot API confirms the post landed, then fades
            out just as the target tab opens. */}
        {shareSuccess && (
          <div className="posting-success">
            <div className="posting-success-check">
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4 12l5 5L20 6" />
              </svg>
            </div>
            <div className="posting-success-label">POSTED</div>
          </div>
        )}

        {/* Global share-flow toast. Renders on top of everything while
            the SHARE handler is briefly reporting status back to the
            user — "image shared, text copied", "download fallback", etc.
            Positioned near the top so it doesn't cover the compose
            button on native share sheets. */}
        {shareStatus && (
          <div
            style={{
              position: 'fixed',
              top: 24,
              left: '50%',
              transform: 'translateX(-50%)',
              background: 'rgba(0,0,0,0.88)',
              color: '#fff',
              padding: '10px 18px',
              borderRadius: 12,
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: '0.02em',
              zIndex: 10000,
              maxWidth: '86%',
              textAlign: 'center',
              boxShadow: '0 6px 24px rgba(0,0,0,0.35)',
              backdropFilter: 'blur(8px)',
              pointerEvents: 'none',
            }}
          >
            {shareStatus}
          </div>
        )}
      </div>
    </>
  );
}
