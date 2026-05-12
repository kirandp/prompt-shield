# PromptShield — Presentation Deck (10 Slides)

---

## Slide 1 — Title

# PromptShield
### Data Loss Prevention Built for the AI Era

Stop sensitive data from reaching ChatGPT, Claude, Gemini, and Copilot — and scan files for hidden prompt-injection attacks.

**Live demo:** https://prompt-shield-weij-d6r7o2x4t-kiran-p-s-projects.vercel.app/

---

## Slide 2 — The Problem

**AI is now a daily-driver tool at work.**
More than half of knowledge workers use a public AI weekly — often without security teams knowing.

**Every prompt ships data to a third-party server.**
- Salesperson pastes a customer roster
- Developer pastes a config with API keys
- Clinician pastes patient notes

The convenience is huge. The data leak surface is just as big.

---

## Slide 3 — Five Risks Security Teams Face

1. **Sensitive data exposure** — PHI, PII, credentials, trade secrets sent to providers you don't control
2. **Compliance breaches** — HIPAA, GDPR, PCI-DSS don't grant "I didn't realize" exceptions
3. **Prompt-injection attacks** — hidden instructions inside PDFs, resumes, invoices, screenshots
4. **Training-data retention** — pasted data may train future models; you can't take it back
5. **No audit trail** — zero visibility into what employees sent and when

---

## Slide 4 — What is PromptShield?

A security layer that sits **between the user and the AI**, in the browser, **before any data hits the network**.

**Two parts:**
- **Chrome Extension** — watches every prompt typed into AI tools; logs, masks, or warns
- **Web Dashboard** — admins set policy, view audit trail, add custom rules, scan files

**Five core capabilities:**
Detection · Masking · File Scanning · Policy & Rules · Real-time Audit

---

## Slide 5 — Detection & Masking (Shield Demo)

**Three protection modes:**
- **Shadow** — detect-only, log silently (great for tuning)
- **Fix** — auto-replace sensitive data with reversible tokens
- **Warn** — pop a confirmation before sending

**Built-in categories:** PHI · PII · PCI · Secrets · Corporate Data

**Demo flow:**
Load Patient Record → Detect → Switch to Fix → Detect → Send to AI
Only the masked version ever reaches the LLM.

---

## Slide 6 — File Scanner: Hidden Threats in Files

PDFs, Word docs, and images can carry hidden instructions that hijack AI assistants.

**20+ attack patterns detected across 6 categories:**
- Prompt Injection · System Prompt Leak · Jailbreak
- Role Manipulation · Data Exfiltration · Policy Bypass

**Multi-Vector Attack sample:** chains 5 techniques → ~90/100 risk score

**Privacy-first:** Images are OCR'd **in the browser** with Tesseract.js — only extracted text is scored server-side.

---

## Slide 7 — Custom Rules & Policy Profiles

**Custom Rules** — security admins define company-specific patterns without writing code:
- Exact Match · Regex Pattern · Category Override
- Rules sync to every Chrome extension in real time via Supabase

**Policy Profiles** — pick the regulation that fits:
- **HIPAA** · **GDPR** · **PCI-DSS** · **Strict** (everything)

---

## Slide 8 — Audit Log: The Compliance Receipt

Every detection, mask, block, and file scan lands in one searchable feed.

**Filters:** Mode · Severity · Date range
**Columns:** Timestamp · User · Mode · Detections · Categories · Severity · Action · AI Tool
**Export:** One-click CSV for auditors

**Real-time:** New rows appear within a second via Supabase WebSocket — no refresh needed.

---

## Slide 9 — Analytics & Enterprise Integration

**Analytics Dashboard (CISO view):**
- Totals: detections, masks, blocks, active rules
- Detections by Data Type · Events by Mode · 7-day trend
- Compliance Status panel

**Enterprise Integrations:**
- **Slack** — critical detections post to a channel
- **SIEM** — forward all events to Splunk, Datadog, Azure Sentinel, or Elastic

We feed your existing security stack — we don't replace it.

---

## Slide 10 — Why It Matters

**For employees:** keep the productivity boost from AI.
**For the organization:** keep your data, compliance posture, and incident-response visibility.

**Built for regulated industries:** HIPAA · GDPR · PCI-DSS
**Real-time everywhere:** extension, dashboard, audit, alerts

**Try it now:** https://prompt-shield-weij-d6r7o2x4t-kiran-p-s-projects.vercel.app/settings

> Detection. Masking. File scanning. Audit. One platform.
