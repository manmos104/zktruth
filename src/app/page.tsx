'use client'

import { useState, useRef, useEffect, useCallback } from "react";
import { useAccount, useDisconnect } from 'wagmi';
import { useMintVerifiedProof, useMintUnverifiedProof, toBytes32Hash, hashGps } from '@/lib/useZkTruth';
import { ZKTRUTH_CONTRACT_ADDRESS } from '@/lib/contract';
import { WorldIdVerifyButton } from '@/lib/worldid';


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
  padding: max(44px, env(safe-area-inset-top, 44px)) 20px 16px;
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
  top: 90px;
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
.meta-line {
  font-size: 10px;
  color: var(--accent);
  opacity: 0.6;
  letter-spacing: 0.5px;
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
  padding: 44px 20px 12px;
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
  object-fit: cover;
  background: #000;
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
  width: 72px; height: 72px;
  border-radius: 50%;
  background: rgba(0,200,255,0.06);
  border: 2px solid rgba(0,200,255,0.2);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
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
  width: 180px; height: 180px;
  position: relative;
  margin-bottom: 28px;
}
.splash-bubble {
  width: 180px; height: 180px;
  opacity: 0;
}
.splash.phase1 .splash-bubble {
  animation: bubbleIn 0.6s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
}
@keyframes bubbleIn {
  from { opacity: 0; transform: scale(0.3); }
  to { opacity: 1; transform: scale(1); }
}

.splash-check {
  position: absolute;
  top: 44%; left: 50%;
  transform: translate(-50%, -50%);
  width: 95px; height: 95px;
  opacity: 0;
}
.splash.phase1 .splash-check {
  animation: checkSpin 1.2s cubic-bezier(0.2, 0, 0.2, 1) 0.4s forwards;
}
.splash.phase1 .splash-check path {
  stroke-dasharray: 100;
  stroke-dashoffset: 0;
}
@keyframes checkSpin {
  0% { opacity: 0; transform: translate(-50%, -50%) scale(0) rotate(0deg); }
  20% { opacity: 1; transform: translate(-50%, -50%) scale(1) rotate(180deg); }
  50% { transform: translate(-50%, -50%) scale(1.1) rotate(540deg); }
  75% { transform: translate(-50%, -50%) scale(1) rotate(680deg); }
  90% { transform: translate(-50%, -50%) scale(0.98) rotate(715deg); }
  100% { opacity: 1; transform: translate(-50%, -50%) scale(1) rotate(720deg); }
}
.splash.phase2 .splash-check {
  animation: checkBounce 0.35s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
  opacity: 1;
  transform: translate(-50%, -50%) scale(1) rotate(720deg);
}
@keyframes checkBounce {
  0% { transform: translate(-50%, -50%) scale(1) rotate(720deg); }
  50% { transform: translate(-50%, -50%) scale(1.25) rotate(720deg); }
  100% { transform: translate(-50%, -50%) scale(1) rotate(720deg); }
}

.splash-logo-row {
  display: flex;
  align-items: center;
  gap: 0;
  opacity: 0;
  transform: translateX(-40px);
  font-family: 'Syne', sans-serif;
  font-style: italic;
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
.splash-text-zk {
  font-weight: 800;
  font-size: 44px;
  background: linear-gradient(
    180deg,
    #1a1a2e 0%,
    #2d2d44 25%,
    #555577 40%,
    #f0f0ff 48%,
    #ffffff 50%,
    #f0f0ff 52%,
    #555577 60%,
    #2d2d44 75%,
    #1a1a2e 100%
  );
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  filter: drop-shadow(0 2px 3px rgba(0,0,0,0.4)) drop-shadow(0 0 1px rgba(0,0,0,0.3));
  position: relative;
}
.splash-text-truth {
  font-weight: 900;
  font-size: 44px;
  background: linear-gradient(
    180deg,
    #0a0a1a 0%,
    #1a1a33 20%,
    #444466 38%,
    #e8e8ff 47%,
    #ffffff 50%,
    #e8e8ff 53%,
    #444466 62%,
    #1a1a33 80%,
    #0a0a1a 100%
  );
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  filter: drop-shadow(0 2px 3px rgba(0,0,0,0.5)) drop-shadow(0 0 1px rgba(0,0,0,0.3));
  position: relative;
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

const MINT_STEPS = [
  { label: "Verifying SHA-256 hash…", progress: 20 },
  { label: "Building metadata…", progress: 45 },
  { label: "Signing transaction…", progress: 65 },
  { label: "Broadcasting to chain…", progress: 85 },
  { label: "NFT minted ✓", progress: 100 },
];

export default function Home() {
  const { address, isConnected } = useAccount();
  const { disconnect } = useDisconnect();
  const openConnectModal = () => { alert('Wallet connect coming soon'); };
  const [splashPhase, setSplashPhase] = useState(0);
  const [screen, setScreen] = useState("camera");
  const [cameraReady, setCameraReady] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [flash, setFlash] = useState(false);
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
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
  // On-screen recorder diagnostics for debugging audio capture on devices
  // where we don't have access to a JS console (e.g., iPhone Safari).
  const [recordDebug, setRecordDebug] = useState<string>("");

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

  const WLD_GAS_FEE = "0.05 WLD";

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
    let reverseGeocodeDone = false;
    if (navigator.geolocation) {
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
  }, []);

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

  const startCamera = useCallback(async (facing?: "environment"|"user", opts?: { deviceId?: string; frontWide?: boolean }) => {
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
      // Request the microphone alongside the camera so MediaRecorder can
      // pick up the audio track when the user records a video. Use a
      // bare `audio: true` rather than a constraints object — iOS Safari
      // appears to honour the simpler form more reliably in our tests
      // (a constraints object with echoCancellation/noiseSuppression
      // succeeded but the resulting audio track was silently dropped by
      // the mp4 encoder).
      const constraints: MediaStreamConstraints = {
        video,
        audio: true,
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

        // Create portrait (9:16) canvas with watermark
        const pw = 1080, ph = 1920;
        const shareC = document.createElement('canvas');
        shareC.width = pw; shareC.height = ph;
        const ctx = shareC.getContext('2d');
        if (ctx) {
          // Black background
          ctx.fillStyle = '#000';
          ctx.fillRect(0, 0, pw, ph);

          // Draw video in cover mode (fill entire portrait canvas)
          const vr = vw / vh;
          const cr = pw / ph;
          let sx = 0, sy = 0, sw = vw, sh = vh;
          if (vr > cr) { sw = vh * cr; sx = (vw - sw) / 2; }
          else { sh = vw / cr; sy = (vh - sh) / 2; }
          ctx.drawImage(v, sx, sy, sw, sh, 0, 0, pw, ph);

          // Helper: draw rounded rect (Safari-safe, no roundRect)
          function drawPill(c: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
            c.beginPath();
            c.moveTo(x + r, y);
            c.lineTo(x + w - r, y);
            c.arcTo(x + w, y, x + w, y + r, r);
            c.lineTo(x + w, y + h - r);
            c.arcTo(x + w, y + h, x + w - r, y + h, r);
            c.lineTo(x + r, y + h);
            c.arcTo(x, y + h, x, y + h - r, r);
            c.lineTo(x, y + r);
            c.arcTo(x, y, x + r, y, r);
            c.closePath();
          }

          // ===== TOP BAR: Logo + LIVE + WORLD CHAIN =====
          const padL = 44;
          const topY = 100;

          // Semi-transparent gradient at top
          const topGrad = ctx.createLinearGradient(0, 0, 0, 260);
          topGrad.addColorStop(0, 'rgba(0,0,0,0.7)');
          topGrad.addColorStop(1, 'transparent');
          ctx.fillStyle = topGrad;
          ctx.fillRect(0, 0, pw, 260);

          // Chat bubble icon (simplified)
          ctx.globalAlpha = 1.0;
          ctx.strokeStyle = '#ffffff';
          ctx.lineWidth = 3;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          ctx.beginPath();
          ctx.moveTo(padL + 28, 94);
          ctx.lineTo(padL + 28, 74);
          ctx.arcTo(padL + 28, 66, padL + 20, 66, 4);
          ctx.lineTo(padL + 4, 66);
          ctx.arcTo(padL, 66, padL, 70, 4);
          ctx.lineTo(padL, 90);
          ctx.arcTo(padL, 94, padL + 4, 94, 4);
          ctx.lineTo(padL + 4, 94);
          ctx.lineTo(padL, 100);
          ctx.lineTo(padL + 10, 94);
          ctx.lineTo(padL + 24, 94);
          ctx.arcTo(padL + 28, 94, padL + 28, 90, 4);
          ctx.stroke();
          // Check mark inside bubble
          ctx.strokeStyle = '#00c864';
          ctx.lineWidth = 3.5;
          ctx.beginPath();
          ctx.moveTo(padL + 8, 80);
          ctx.lineTo(padL + 12, 84);
          ctx.lineTo(padL + 20, 76);
          ctx.stroke();

          // "zkTruth" text
          ctx.globalAlpha = 1.0;
          ctx.font = 'italic 32px sans-serif';
          ctx.fillStyle = 'rgba(255,255,255,0.75)';
          const zkW = ctx.measureText('zk').width;
          ctx.fillText('zk', padL + 36, topY);
          ctx.font = 'italic bold 32px sans-serif';
          ctx.fillStyle = '#ffffff';
          ctx.fillText('Truth', padL + 36 + zkW, topY);
          const truthEnd = padL + 36 + zkW + ctx.measureText('Truth').width + 12;

          // LIVE badge (red pill)
          const liveX = truthEnd + 8;
          const liveY = topY - 18;
          const liveW = 72;
          const liveH = 28;
          ctx.fillStyle = '#ff3b5c';
          drawPill(ctx, liveX, liveY, liveW, liveH, 14);
          ctx.fill();
          // Live dot
          ctx.fillStyle = '#ffffff';
          ctx.beginPath();
          ctx.arc(liveX + 14, liveY + 14, 4, 0, Math.PI * 2);
          ctx.fill();
          // LIVE text
          ctx.font = 'bold 14px monospace';
          ctx.fillStyle = '#ffffff';
          ctx.fillText('LIVE', liveX + 24, liveY + 19);

          // WORLD CHAIN badge (top right)
          const chainText = 'WORLD CHAIN';
          ctx.font = '14px monospace';
          const chainW = ctx.measureText(chainText).width + 24;
          const chainX = pw - padL - chainW;
          const chainY = liveY;
          ctx.strokeStyle = 'rgba(0,200,255,0.5)';
          ctx.lineWidth = 1.5;
          drawPill(ctx, chainX, chainY, chainW, liveH, 14);
          ctx.stroke();
          ctx.fillStyle = 'rgba(0,200,255,0.1)';
          drawPill(ctx, chainX, chainY, chainW, liveH, 14);
          ctx.fill();
          ctx.fillStyle = '#00c8ff';
          ctx.fillText(chainText, chainX + 12, chainY + 19);

          // ===== METADATA TEXT =====
          const accentGreen = '#00ff87';
          const fontSize = 22;
          const lineGap = 36;
          const startY = 170;

          ctx.font = fontSize + 'px monospace';
          ctx.fillStyle = accentGreen;
          ctx.globalAlpha = 0.6;
          ctx.fillText('⏱ ' + timeStr, padL, startY);
          ctx.fillText('📍 ' + gps, padL, startY + lineGap);
          ctx.fillText('⛓ WORLD CHAIN READY', padL, startY + lineGap * 2);
          ctx.fillText('🔒 SHA-256: ' + hash.slice(0, 18) + '...', padL, startY + lineGap * 3);
          ctx.globalAlpha = 1.0;
          finalImage = shareC.toDataURL('image/jpeg', 0.92);
        }
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
  }, [capturing, cameraReady, gpsCoords]);

  const MAX_REC = 180;

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
      const pw = 1080, ph = 1920; // 9:16 portrait

      // Create / reuse the offscreen canvas we draw into.
      if (!recCanvasRef.current) {
        recCanvasRef.current = document.createElement('canvas');
      }
      const rc = recCanvasRef.current;
      rc.width = pw;
      rc.height = ph;
      const ctx = rc.getContext('2d');
      if (!ctx) return;

      // Draw loop: video → canvas in cover mode.
      const drawFrame = () => {
        const vw = v.videoWidth || 1080;
        const vh = v.videoHeight || 1920;
        const vr = vw / vh;
        const cr = pw / ph;
        let sx = 0, sy = 0, sw = vw, sh = vh;
        if (vr > cr) { sw = vh * cr; sx = (vw - sw) / 2; }
        else { sh = vw / cr; sy = (vh - sh) / 2; }

        // Match the preview's displayScale so the captured clip frames
        // exactly what the user saw.
        const z = displayScale;
        if (z > 1) {
          const zw = sw / z, zh = sh / z;
          sx += (sw - zw) / 2; sy += (sh - zh) / 2;
          sw = zw; sh = zh;
        }

        ctx.save();
        if (facingMode === 'user') {
          ctx.translate(pw, 0);
          ctx.scale(-1, 1);
        }
        ctx.drawImage(v, sx, sy, sw, sh, 0, 0, pw, ph);
        ctx.restore();

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
      const mimeTypes = [
        'video/webm;codecs=vp9,opus',
        'video/webm;codecs=vp8,opus',
        'video/webm',
        'video/mp4;codecs=avc1.42E01E,mp4a.40.2',
        'video/mp4;codecs=avc1,mp4a',
        'video/mp4',
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
        const recorderOpts: MediaRecorderOptions = selectedMime
          ? { mimeType: selectedMime, audioBitsPerSecond: 128000, videoBitsPerSecond: 2_500_000 }
          : { audioBitsPerSecond: 128000, videoBitsPerSecond: 2_500_000 }
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
          const proof = { timestamp: getTimestamp(), hash: generateHash(), gps: gpsCoords, device: "Device", chain: "World Chain", tokenId: Math.floor(Math.random() * 999999) + 1, type: "video" };
          setCapturedImage(null); setProofData(proof); setMintStep(0); setMintComplete(false);
          setWorldIdVerified(false); setWorldIdVerifying(false); setScreen("worldid");
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
  }, [recording, gpsCoords, zoomLevel, facingMode]);

  const formatTime = (s: number) => `${String(Math.floor(s/60)).padStart(2,'0')}:${String(s%60).padStart(2,'0')}`;

  const handleReset = useCallback(() => {
    setScreen("camera"); setMintComplete(false); setCapturedImage(null); setCapturedVideo(null); setProofData(null);
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

  const handleConfirmTx = useCallback(() => {
    setScreen("share");
  }, []);

  const openSnsShare = useCallback((from: string) => {
    setSnsFromScreen(from);
    setScreen("sns-share");
  }, []);

  const buildProofUrl = useCallback(() => {
    const h = proofData?.hash?.slice(0,16) || '0x0000';
    const t = proofData?.timestamp ? Math.floor(new Date(proofData.timestamp).getTime() / 1000) : '';
    const l = gpsLocation || '';
    const p = new URLSearchParams();
    if (t) p.set('t', String(t));
    if (l) p.set('l', l);
    const qs = p.toString();
    return `https://zktruth.vercel.app/proof/${h}${qs ? '?' + qs : ''}`;
  }, [proofData, gpsLocation]);

  const handleShareWithImage = useCallback(async () => {
    const proofUrl = buildProofUrl();
    const shareText = 'Verified proof of capture via zkTruth\n\n' + proofUrl;

    // Build file
    let file: File | null = null;
    if (capturedVideo) {
      const ext = capturedVideo.type.includes('mp4') ? 'mp4' : 'webm';
      file = new File([capturedVideo], `zktruth-proof.${ext}`, { type: capturedVideo.type });
    } else if (capturedImage) {
      const parts = capturedImage.split(',');
      const mime = parts[0].match(/:(.*?);/)?.[1] || 'image/jpeg';
      const bstr = atob(parts[1]);
      const arr = new Uint8Array(bstr.length);
      for (let i = 0; i < bstr.length; i++) arr[i] = bstr.charCodeAt(i);
      const blob = new Blob([arr], { type: mime });
      file = new File([blob], 'zktruth-proof.jpg', { type: mime });
    }

    if (typeof navigator.share === 'function') {
      try {
        // Try: file + text (text includes URL)
        if (file) {
          const data: ShareData = { text: shareText, files: [file] };
          if (navigator.canShare?.(data)) {
            await navigator.share(data);
            return;
          }
        }
        // Try: text only (includes URL as plain text link)
        await navigator.share({ text: shareText });
        return;
      } catch (e) {
        if ((e as Error)?.name === 'AbortError') return;
      }
    }

    // Fallback: open X
    window.open(`https://x.com/intent/tweet?text=${encodeURIComponent('Verified proof of capture via zkTruth')}&url=${encodeURIComponent(proofUrl)}`, '_blank');
  }, [capturedImage, capturedVideo, buildProofUrl]);

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
            <svg className="splash-bubble" viewBox="0 0 24 24" fill="none" stroke="#000000" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10z"/>
            </svg>
            <svg className="splash-check" viewBox="0 0 24 24" fill="none" stroke="#00c864" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="m8 12.5 2.5 2.5 5-5"/>
            </svg>
          </div>
          <div className="splash-logo-row">
            <span className="splash-text-zk">zk</span><span className="splash-text-truth">Truth</span>
          </div>
          <div className="splash-sub">Proof of Reality</div>
          <div className="splash-powered"><div className="splash-pw-dot" />POWERED BY WORLD CHAIN</div>
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

            <div className="meta-overlay">
              <div className="meta-line">⏱ {now.replace('T',' ').split('.')[0]} UTC</div>
              <div className="meta-line">📍 {gpsCoords}</div>
              <div className="meta-line">⛓ WORLD CHAIN READY</div>
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
              <div className="chain-badge">WORLD CHAIN</div>
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
              <div>
                <button className="side-btn" onClick={flipCamera}><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:22,height:22}}><path d="M1 4v6h6"/><path d="M23 20v-6h-6"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4-4.64 4.36A9 9 0 0 1 3.51 15"/></svg></button>
                <div className="side-btn-label">FLIP</div>
              </div>
              <div>
                <button className="side-btn" onClick={isConnected ? () => disconnect() : openConnectModal}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:22,height:22}}><rect x="2" y="5" width="20" height="14" rx="3"/><circle cx="17" cy="12" r="1" fill="currentColor" stroke="none"/><path d="M2 9h20"/></svg>
                </button>
                <div className="side-btn-label">{isConnected ? (address?.slice(0,4) + '..' + address?.slice(-3)) : 'WALLET'}</div>
              </div>
            </div>

            <div className="bottom-controls">
              {/* Zoom controls removed — app always opens to the widest FOV
                  (back ultra-wide / front 4:3) and lets the user flip cameras
                  with the FLIP button. */}
              <div className="mode-tabs">
                <button className={`mode-tab ${captureMode === 'photo' ? 'active' : ''}`} onClick={() => !recording && setCaptureMode('photo')}>PHOTO</button>
                <button className={`mode-tab ${captureMode === 'video' ? 'active' : ''}`} onClick={() => !recording && setCaptureMode('video')}>VIDEO</button>
              </div>
              <button className={`btn-capture ${captureMode === 'video' ? 'video-mode' : ''} ${recording ? 'recording' : ''}`} onClick={captureMode === 'photo' ? handleCapture : handleVideoCapture} />
            </div>

            <div className={`flash-overlay ${flash ? 'active' : ''}`} />
            {recording && <div className="rec-progress"><div className="rec-progress-fill" style={{width: `${(recordingTime / MAX_REC) * 100}%`}} /></div>}


          </>
        )}

        {screen === "worldid" && proofData && (
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
                <div className="wid-badge">CAPTURED</div>
              </div>
              {capturedVideoUrl && (
                // Opens the recorded blob in a new tab so iOS Safari's
                // native video player handles playback (with audio, scrubbing,
                // and AirPlay) — the inline `<video class="wid-bg">` is
                // hard-muted for autoplay and can't be used to verify sound.
                <a
                  href={capturedVideoUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    position: 'absolute',
                    top: 76,
                    right: 12,
                    padding: '6px 10px',
                    background: 'rgba(0,0,0,0.6)',
                    border: '1px solid rgba(255,255,255,0.25)',
                    borderRadius: 20,
                    color: '#e6e6e6',
                    fontFamily: 'Space Mono, monospace',
                    fontSize: 11,
                    textDecoration: 'none',
                    zIndex: 6,
                  }}
                >
                  ▶ PLAY WITH AUDIO
                </a>
              )}
              <div className="wid-bottom">
                <div className="wid-hash">{proofData.hash.slice(0,22)}...</div>
                <div className="wid-time">{proofData.timestamp.split('T')[1]?.split('.')[0]} UTC • World Chain</div>
                <WorldIdVerifyButton
                  signal={proofData?.hash ?? ''}
                  verifying={worldIdVerifying}
                  verified={worldIdVerified}
                  onVerifying={handleWorldIdVerifying}
                  onVerified={handleWorldIdVerified}
                  onError={handleWorldIdError}
                />
                {worldIdError && (
                  <div style={{
                    marginTop: 8,
                    padding: '8px 12px',
                    background: 'rgba(255,59,92,0.12)',
                    border: '1px solid rgba(255,59,92,0.4)',
                    borderRadius: 6,
                    color: '#ff3b5c',
                    fontFamily: 'Space Mono, monospace',
                    fontSize: 11,
                    lineHeight: 1.4,
                    wordBreak: 'break-word',
                  }}>
                    <div style={{ opacity: 0.7, marginBottom: 2 }}>WORLD ID ERROR</div>
                    <div>{worldIdError}</div>
                  </div>
                )}
                <button className="wid-gas-btn" onClick={handleUnverifiedMint} disabled={worldIdVerifying || worldIdVerified}>
                  MINT :: PAY GAS <span className="wld-gas-tag">{WLD_GAS_FEE}</span>
                </button>
              </div>
            </div>
            {worldIdVerified && (
              <div className="wid-verified">
                <div className="wid-verified-icon"><svg viewBox="0 0 24 24" fill="none" stroke="#00ff87" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5L20 7"/></svg></div>
                <div className="wid-verified-title">Proof Accepted</div>
                <div className="wid-verified-sub">Zero-knowledge proof validated · Initiating on-chain mint</div>
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
              <button className="btn-back" onClick={() => setScreen("worldid")}>BACK</button>
            </div>
            <div className="confirm-tx-body">
              <div className="tx-icon">⛽</div>
              <div className="tx-title">GAS FEE REQUIRED</div>
              <div className="tx-desc">Without World ID verification, a WLD gas fee is required to mint your proof on-chain.</div>
              <div className="tx-details">
                <div className="tx-detail-row">
                  <span className="tx-detail-key">NETWORK</span>
                  <span className="tx-detail-value">World Chain</span>
                </div>
                <div className="tx-detail-row">
                  <span className="tx-detail-key">ACTION</span>
                  <span className="tx-detail-value">MINT :: PROOF NFT</span>
                </div>
                <div className="tx-detail-row">
                  <span className="tx-detail-key">GAS FEE</span>
                  <span className="tx-detail-value highlight">{WLD_GAS_FEE}</span>
                </div>
                <div className="tx-detail-row">
                  <span className="tx-detail-key">WALLET</span>
                  <span className="tx-detail-value">{address ? address.slice(0,6) + '...' + address.slice(-4) : 'Not connected'}</span>
                </div>
                <div className="tx-detail-row">
                  <span className="tx-detail-key">BALANCE</span>
                  <span className="tx-detail-value">-- WLD</span>
                </div>
              </div>
              <div className="tx-warning">Verified users (World ID) mint for free. Gas fee only applies to unverified captures.</div>
              <button className="btn-confirm-tx" onClick={handleConfirmTx}>CONFIRM :: PAY {WLD_GAS_FEE}</button>
              <button className="btn-cancel-tx" onClick={() => setScreen("worldid")}>CANCEL</button>
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
            {capturedImage ? <img src={capturedImage} alt="" className="wid-bg" /> : capturedVideoUrl ? <video src={capturedVideoUrl} className="wid-bg" autoPlay loop muted playsInline /> : <div className="wid-bg" style={{background:'#111'}} />}
            <div className="wid-overlay">
              <div className="wid-top">
                <div style={{display:'flex',alignItems:'center',gap:10}}>
                  <button className="wid-back" onClick={handleReset}>✕</button>
                  <svg className="logo-icon" viewBox="0 0 24 24" fill="none" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v10z" stroke="white"/><path d="m8 9.5 2.5 2.5 5-5" stroke="#00c864"/></svg>
                  <div className="logo-text"><span className="logo-zk">zk</span><span className="logo-truth">Truth</span></div>
                  <div className="live-badge"><div className="live-dot" />LIVE</div>
                </div>
                <div className="wid-badge">{mintMode === "verified" ? "ZKP VERIFIED" : "UNVERIFIED"}</div>
              </div>
              <div className="wid-bottom">
                <div className="wid-hash">SHA-256: {proofData.hash.slice(0,22)}...</div>
                <div className="wid-time">{proofData.timestamp.split('T')[1]?.split('.')[0]} UTC • {proofData.chain} • #{proofData.tokenId.toString().padStart(6,'0')}</div>
                <div style={{display:'flex',gap:8}}>
                  <button className="wid-verify-btn" style={{flex:1}} onClick={() => openSnsShare("share")}>SHARE</button>
                  <button className="wid-verify-btn" style={{flex:1,background:'linear-gradient(135deg, #00ff87, #00cc66)',color:'#000'}} onClick={() => { setScreen("minting"); startMinting(); }}>NFT MINT</button>
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
                <button className="wid-verify-btn" onClick={() => {
                  // URL-only X intent so the timeline renders our Twitter Card
                  // (frame + thumbnail) instead of uploading the raw video.
                  const url = buildProofUrl();
                  const text = 'Verified proof of capture via zkTruth';
                  window.open(`https://x.com/intent/tweet?text=${encodeURIComponent(text)}&url=${encodeURIComponent(url)}`, '_blank');
                }}>
                  POST TO X
                </button>
                <button className="wid-gas-btn" onClick={() => { const url = buildProofUrl(); window.open(`https://warpcast.com/~/compose?text=${encodeURIComponent('Verified proof of capture via zkTruth\n\n' + url)}&embeds[]=${encodeURIComponent(url)}`, '_blank'); }}>
                  <span style={{fontSize:16}}>🟣</span> FARCASTER
                </button>
                <button className="wid-gas-btn" onClick={handleCopyLink}>
                  <span>🔗</span> COPY LINK
                </button>
                <button className="wid-gas-btn" onClick={handleShareWithImage}>
                  <span>💾</span> SAVE / OTHER
                </button>
                <div className="sns-copy-status">{copyStatus}</div>
              </div>
            </div>
          </div>
        )}

      </div>
    </>
  );
}
