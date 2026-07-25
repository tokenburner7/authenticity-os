/**
 * @auth/widget — Embeddable authenticity verification badge
 *
 * A self-contained, zero-dependency browser widget that verifies a
 * SignedCredential entirely client-side (Ed25519 signature check via
 * @noble/ed25519) and renders a compact, themeable badge.
 *
 * Usage:
 *   import { renderBadge } from "@auth/widget";
 *   renderBadge(document.getElementById("badge")!, credential, { theme: "dark" });
 *
 * Or via the IIFE build:
 *   <script src="auth-badge.js"></script>
 *   <script>AuthBadge.renderBadge(el, credential);</script>
 */

import type {
  SignedCredential,
  AIAssistanceLevel,
} from "@auth/protocol";
import { verifyCredentialSignature, isExpired } from "@auth/protocol";

// ── Public types ────────────────────────────────────────────────────────────

export interface BadgeOptions {
  /** Colour scheme. Defaults to "light". */
  theme?: "light" | "dark";
  /** Compact one-line variant. Defaults to false. */
  compact?: boolean;
  /** Start with the details panel expanded. Defaults to false. */
  showDetails?: boolean;
}

export type BadgeStatus = "verified" | "invalid" | "unknown";

// ── Status logic ────────────────────────────────────────────────────────────

function computeStatus(credential: SignedCredential): BadgeStatus {
  try {
    if (!verifyCredentialSignature(credential)) return "invalid";
    if (isExpired(credential)) return "invalid";
    return "verified";
  } catch {
    return "unknown";
  }
}

function aiAssistanceLabel(level: AIAssistanceLevel): string {
  switch (level) {
    case "none":
      return "Human-made";
    case "partial":
      return "AI-assisted";
    case "ai-assisted":
      return "AI-assisted";
    case "fully-ai":
      return "Fully AI";
    default:
      return "Unknown";
  }
}

function truncateId(id: string, len = 10): string {
  if (id.length <= len) return id;
  return `${id.slice(0, len)}…`;
}

// ── SVG icons (inline) ──────────────────────────────────────────────────────

function shieldCheckIcon(): string {
  return `<svg class="auth-badge-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M12 2L4 6v6c0 5 3.5 9 8 10 4.5-1 8-5 8-10V6l-8-4z"/>
    <path d="M9 12l2 2 4-4"/>
  </svg>`;
}

function shieldAlertIcon(): string {
  return `<svg class="auth-badge-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M12 2L4 6v6c0 5 3.5 9 8 10 4.5-1 8-5 8-10V6l-8-4z"/>
    <path d="M12 8v4"/>
    <path d="M12 16h.01"/>
  </svg>`;
}

function shieldQuestionIcon(): string {
  return `<svg class="auth-badge-icon" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
    <path d="M12 2L4 6v6c0 5 3.5 9 8 10 4.5-1 8-5 8-10V6l-8-4z"/>
    <path d="M9.1 9a3 3 0 0 1 5.8 1c0 2-3 3-3 3"/>
    <path d="M12 17h.01"/>
  </svg>`;
}

function statusIcon(status: BadgeStatus): string {
  switch (status) {
    case "verified":
      return shieldCheckIcon();
    case "invalid":
      return shieldAlertIcon();
    case "unknown":
      return shieldQuestionIcon();
  }
}

function statusLabel(status: BadgeStatus): string {
  switch (status) {
    case "verified":
      return "Verified";
    case "invalid":
      return "Invalid";
    case "unknown":
      return "Unknown";
  }
}

// ── Styles ──────────────────────────────────────────────────────────────────

const STYLES = `
.auth-badge {
  --ab-verified: #16a34a;
  --ab-verified-bg: #dcfce7;
  --ab-invalid: #dc2626;
  --ab-invalid-bg: #fee2e2;
  --ab-unknown: #d97706;
  --ab-unknown-bg: #fef3c7;
  --ab-text: #1f2937;
  --ab-muted: #6b7280;
  --ab-border: #e5e7eb;
  --ab-bg: #ffffff;
  --ab-panel-bg: #f9fafb;
  --ab-radius: 8px;
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
  font-size: 13px;
  line-height: 1.4;
  display: inline-flex;
  flex-direction: column;
  border: 1px solid var(--ab-border);
  border-radius: var(--ab-radius);
  background: var(--ab-bg);
  color: var(--ab-text);
  overflow: hidden;
  max-width: 340px;
  user-select: none;
}
.auth-badge.auth-badge-dark {
  --ab-text: #f3f4f6;
  --ab-muted: #9ca3af;
  --ab-border: #374151;
  --ab-bg: #1f2937;
  --ab-panel-bg: #111827;
  --ab-verified-bg: #064e3b;
  --ab-invalid-bg: #7f1d1d;
  --ab-unknown-bg: #78350f;
}
.auth-badge-button {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 10px;
  background: transparent;
  border: none;
  cursor: pointer;
  color: inherit;
  font: inherit;
  text-align: left;
  width: 100%;
}
.auth-badge-button:focus-visible {
  outline: 2px solid var(--ab-muted);
  outline-offset: -2px;
}
.auth-badge-icon { flex-shrink: 0; }
.auth-badge-verified { color: var(--ab-verified); }
.auth-badge-invalid { color: var(--ab-invalid); }
.auth-badge-unknown { color: var(--ab-unknown); }
.auth-badge-label { font-weight: 600; flex-shrink: 0; }
.auth-badge-sep { color: var(--ab-muted); }
.auth-badge-ai { color: var(--ab-muted); font-size: 12px; }
.auth-badge-issuer {
  color: var(--ab-muted);
  font-family: ui-monospace, "SF Mono", monospace;
  font-size: 11px;
}
.auth-badge-details {
  display: none;
  border-top: 1px solid var(--ab-border);
  background: var(--ab-panel-bg);
  padding: 10px 12px;
  max-height: 280px;
  overflow-y: auto;
}
.auth-badge-details.auth-badge-open { display: block; }
.auth-badge-details pre {
  margin: 0;
  font-family: ui-monospace, "SF Mono", monospace;
  font-size: 11px;
  white-space: pre-wrap;
  word-break: break-all;
  color: var(--ab-text);
}
.auth-badge-compact { max-width: 100%; }
.auth-badge-compact .auth-badge-issuer { display: none; }
`;

let styleInjected = false;

function injectStyles(): void {
  if (styleInjected) return;
  if (typeof document === "undefined") return;
  const style = document.createElement("style");
  style.setAttribute("data-auth-badge", "");
  style.textContent = STYLES;
  document.head.appendChild(style);
  styleInjected = true;
}

// ── Render ──────────────────────────────────────────────────────────────────

/**
 * Render an authenticity verification badge into `container`.
 *
 * The badge verifies the credential's Ed25519 signature entirely client-side
 * (no network calls) and displays:
 *   - A shield icon (green ✓ verified / red ! invalid / amber ? unknown)
 *   - The verification status ("Verified" / "Invalid" / "Unknown")
 *   - The AI assistance level ("Human-made" / "AI-assisted" / "Fully AI")
 *   - The issuer's truncated public key
 *   - Click to expand: the full credential JSON
 */
export function renderBadge(
  container: HTMLElement,
  credential: SignedCredential,
  options: BadgeOptions = {},
): void {
  const { theme = "light", compact = false, showDetails = false } = options;

  injectStyles();

  const status = computeStatus(credential);
  const aiLabel = aiAssistanceLabel(credential.payload.subject.aiAssistance);
  const issuerShort = truncateId(credential.signer);
  const label = statusLabel(status);
  const iconSvg = statusIcon(status);
  const statusClass =
    status === "verified"
      ? "auth-badge-verified"
      : status === "invalid"
        ? "auth-badge-invalid"
        : "auth-badge-unknown";

  // Build the root element
  container.innerHTML = "";

  const root = document.createElement("div");
  root.className = `auth-badge${theme === "dark" ? " auth-badge-dark" : ""}${compact ? " auth-badge-compact" : ""}`;

  // Button (clickable header)
  const button = document.createElement("button");
  button.className = "auth-badge-button";
  button.type = "button";
  button.setAttribute("aria-label", `Authenticity badge: ${label}. Click to toggle details.`);
  button.innerHTML = `
    <span class="${statusClass}">${iconSvg}</span>
    <span class="auth-badge-label ${statusClass}">${label}</span>
    <span class="auth-badge-sep">·</span>
    <span class="auth-badge-ai">${aiLabel}</span>
    <span class="auth-badge-sep">·</span>
    <span class="auth-badge-issuer">${issuerShort}</span>
  `;

  // Details panel
  const details = document.createElement("div");
  details.className = `auth-badge-details${showDetails ? " auth-badge-open" : ""}`;
  const pre = document.createElement("pre");
  pre.textContent = JSON.stringify(credential, null, 2);
  details.appendChild(pre);

  // Toggle behaviour
  button.addEventListener("click", () => {
    details.classList.toggle("auth-badge-open");
  });

  root.appendChild(button);
  root.appendChild(details);
  container.appendChild(root);
}

export default { renderBadge };
