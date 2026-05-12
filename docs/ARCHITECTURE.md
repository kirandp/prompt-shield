# PromptShield — Architecture & Usage Guide

End-to-end reference for the PromptShield system: a Chrome extension that intercepts pastes into AI tools (ChatGPT, Claude, Gemini, Copilot), detects sensitive data (PHI/PII/secrets/financial), masks it before it leaves the browser, and ships audit metadata to Supabase. A Next.js dashboard surfaces logs, rules, and analytics for admins.

> All diagrams are standalone SVG files in [docs/diagrams/](docs/diagrams/) — open them directly in a browser or click any image below for a full-size view.

---

## 1. System Architecture (High-Level)

Three independent components communicate over HTTPS. Raw sensitive text **never leaves the user's browser** — only masked text reaches AI providers, and only metadata reaches Supabase.

![System Architecture](docs/diagrams/01-system-architecture.svg)

**Trust boundaries**

| Boundary | Crosses with | Notes |
|----------|--------------|-------|
| Browser → AI provider | Masked text only | `[PHI_1]`, `[PII_2]` tokens replace raw values |
| Browser → Supabase | Audit metadata | counts, categories, severity, timestamps — never raw text |
| Dashboard → Supabase | Authenticated reads/writes | RLS scoped by `org_id` |
| Token map | Stays in `chrome.storage.local` | Used to de-anonymize AI responses client-side |

---

## 2. Extension Internal Architecture

The extension is a Manifest V3 package. The content script is loaded as an ES module via a tiny loader to bypass MV3's classic-script limitation, which lets it `import` the detection engine directly.

![Extension Internals](docs/diagrams/02-extension-internals.svg)

**Why a loader file?** Manifest V3 content scripts can't be ES modules directly; `content-script-loader.js` is the registered classic script that does `await import(chrome.runtime.getURL('content-script.js'))`, which then loads the rest as modules. Every imported file must be in `web_accessible_resources`.

---

## 3. Paste Detection & Masking Flow

Sequence of what happens when a user pastes into a monitored textarea.

![Paste Flow](docs/diagrams/03-paste-flow.svg)

**Key contracts**

| Function | Input | Output |
|---|---|---|
| `regexScan(text)` | raw string | `Detection[]` (sorted, non-overlapping) |
| `applyRules(text, dets, rules)` | text + base detections + rule list | merged `Detection[]` |
| `buildMasked(text, dets)` | text + detections | `{ masked, tokenMap, replacements }` |
| `buildHighlighted(text, dets)` | text + detections | HTML string with `<mark>` spans |
| `deanonymizeResponse(resp, tokenMap)` | AI response + map | response with originals restored |

A `Detection` is `{ id, text, start, end, patternId, category, severity, type, isAI }`.

---

## 4. Three Protection Modes — Branching Flow

The same detection result produces wildly different UX depending on the active mode. The mode is held in `chrome.storage.local` and toggled from the popup.

![Three Modes](docs/diagrams/04-three-modes.svg)

**Warn-mode overlay shows three panels:** detection list (category + type + value), highlighted text (original with marks), and "what AI would see" (masked preview). Three actions: Auto-Mask & Send, Edit Manually, Block & Report.

---

## 5. Audit Logging Flow

Audit events are append-only and contain **no raw text**. They flow from the content script through the background service worker to Supabase.

![Audit Flow](docs/diagrams/05-audit-flow.svg)

---

## 6. Technology Stack

![Tech Stack](docs/diagrams/06-tech-stack.svg)

---

## 7. Detection Coverage

| Category | Examples | Severity floor |
|----------|----------|----------------|
| **PHI** (HIPAA) | SSN, MRN, Insurance ID, ICD-10, NPI, Medication, Treatment Date | medium → critical |
| **PII** (GDPR) | Email, Phone, Credit Card, CVV, Bank Account, Passport, DoB, Address | medium → high |
| **Secrets** | OpenAI/Anthropic API keys, GitHub tokens, AWS access keys, DB connection strings, private keys, JWT | critical |
| **Financial** | IBAN, SWIFT, Card expiry, Transaction ID, Salary | high |
| **Custom** | User- or org-defined exact strings, regex patterns, category overrides | configurable |

Patterns live in [extension/src/detection/patterns.js](extension/src/detection/patterns.js). Every detection includes `id`, `category`, `severity`, and a human-readable `description`.

---

## 8. Custom Rules

Three rule types, evaluated in priority order:

```js
// 1. EXACT — replace literal strings
{ type: 'exact', match: 'Acme Corporation', replacement: 'Sample Corp', caseSensitive: false }

// 2. REGEX — pattern-based replacement
{ type: 'regex', pattern: '\\b\\d{3}-\\d{2}-\\d{4}\\b', replacement: '000-00-0000' }

// 3. CATEGORY — override default behavior for a whole category
{ type: 'category', category: 'PERSON', replacement: 'sequential' }  // Person A, B, C...
```

**Priority resolution** (highest first):

1. Org exact rules
2. Personal exact rules
3. Org category rules
4. Personal category rules
5. Org pattern rules
6. Personal pattern rules

**Session consistency**: within one session, the same original value always maps to the same token (`John Smith → [PII_1]` consistently), so AI can reason coherently across the conversation. The map is held in `chrome.storage.local` keyed by `sessionId`.

---

## 9. Detailed Usage

### 9.1 Install & run locally

```bash
# 1. Clone
git clone https://github.com/your-org/promptshield.git
cd promptshield

# 2. Set up Supabase
#    Create a project at https://supabase.com, then:
psql "$SUPABASE_DB_URL" -f supabase/schema.sql

# 3. Configure env
cat > extension/.env <<'EOF'
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
ANTHROPIC_API_KEY=sk-ant-...   # optional, for semantic detection
EOF

cat > dashboard/.env.local <<'EOF'
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
EOF

# 4. Load extension
#    chrome://extensions → Developer mode → Load unpacked → select extension/

# 5. Run dashboard
cd dashboard && npm install && npm run dev
#    → http://localhost:3000
```

### 9.2 Day-one configuration (recommended order)

1. **Start in Shadow mode** for 1–2 weeks. Collect baseline detection volume in `/audit` without disrupting users.
2. **Review hot patterns** in `/dashboard`. If you see false-positive-heavy patterns (e.g., ICD-10 over-firing), tune via custom rules or disable the pattern in `patterns.js`.
3. **Add org-level rules** in `/rules` for tenant-specific identifiers (client names, internal project codes).
4. **Roll out Fix mode** to a pilot group via the popup. Watch for user-reported correctness issues.
5. **Reserve Warn mode** for high-risk teams (legal, healthcare, finance) where explicit consent matters.

### 9.3 Testing detections

Open any monitored AI tool tab and paste:

```
Patient: John Smith
SSN: 428-55-9021
MRN: 100123456
Email: john.smith@hospital.com
Treatment Date: 2025-11-04
```

Expected: 5 detections (1 PII patient name, 1 PHI SSN, 1 PHI MRN, 1 PII email, 1 PHI treatment date). In Warn mode, the overlay shows each with its description badge and severity. In Fix mode, the textarea silently becomes:

```
Patient: [PII_1]
SSN: [PHI_1]
MRN: [PHI_2]
Email: [PII_2]
Treatment Date: [PHI_3]
```

### 9.4 Background service worker API

```js
// From popup or content script:
chrome.runtime.sendMessage({ type: 'GET_STATE' }, ({ state }) => {
  // state = { mode, isPaused, sessionId, policy }
});

chrome.runtime.sendMessage({ type: 'SET_MODE', mode: 'fix' });   // shadow | fix | warn
chrome.runtime.sendMessage({ type: 'TOGGLE_PAUSE' });

chrome.runtime.sendMessage({
  type: 'LOG_EVENT',
  eventType: 'detection',                // detection | masked | blocked | allowed | alert
  detectionCount: 3,
  categories: ['PHI', 'PII'],
  maxSeverity: 'critical',
  aiTool: 'chatgpt',
  actionTaken: 'masked',
});
```

### 9.5 Detection engine API

```js
import {
  regexScan, applyRules, buildMasked, buildHighlighted, deanonymizeResponse
} from './src/detection/engine.js';

const detections = regexScan(text);
const merged     = applyRules(text, detections, userRules);
const { masked, tokenMap } = buildMasked(text, merged);
const html       = buildHighlighted(text, merged);

// Later, on AI response:
const restored = deanonymizeResponse(aiResponse, tokenMap);
```

### 9.6 Dashboard routes

| Route | Purpose |
|-------|---------|
| `/dashboard` | KPIs (events/day, top categories, severity mix), trend charts |
| `/audit` | Searchable event log with filters (org, user, type, date, AI tool) |
| `/rules` | CRUD for personal + org rules; drag to reorder priority |
| `/shield` | Live demo: paste text, see detections, masked output, highlighted preview |
| `/settings` | Org config, retention policy, SIEM webhook URLs |

### 9.7 Deployment

**Extension** — Package via `zip -r promptshield.zip extension/` and submit to the Chrome Web Store, or push via Chrome enterprise policies (`ExtensionInstallForcelist`).

**Dashboard** — Standard Next.js deploy:

```bash
cd dashboard
npm run build
# → deploy out/ or .next/ to Vercel / Netlify / Docker
```

**Supabase** — Already initialized via `schema.sql`. Enable RLS in production, configure retention with a scheduled function, and (optionally) wire `audit_events` inserts to a SIEM webhook for real-time forwarding.

---

## 10. Security & Compliance Posture

| Control | Where it lives | Notes |
|---------|----------------|-------|
| Raw data residency | Browser only | Detection runs client-side; raw text never transmitted |
| Reversible anonymization | `tokenMap` in `chrome.storage.local` | Tokens replace values pre-AI, restored on response |
| Audit append-only | `audit_events` (Postgres) | No `UPDATE`/`DELETE` grants in RLS policy |
| Multi-tenant isolation | RLS on `org_id` | Every read/write scoped via `auth.jwt()->>'org_id'` |
| Compliance fit | HIPAA · GDPR · PCI-DSS · SOC 2 | PHI/PII detection, consent flows, encryption at rest, audit |
| Secrets handling | API key patterns flagged at `critical` | Default behavior: block in Warn, mask in Fix |

---

## 11. Roadmap

- **Phase 2** — Response guard (blur AI outputs containing sensitive data), file upload scanning (PDF/DOCX), spaCy NER via WASM
- **Phase 3** — Agent action interceptor (hook AI tool calls), cross-tool data movement detection, role-based policy engine, de-anonymization attack blocker
- **Phase 4** — Response watermarking (forensic traceability), SIEM webhook integrations (Splunk, Datadog, Sentinel), automated compliance report generation

---

## Diagram Source Files

If you want to edit the diagrams, source SVGs are in [docs/diagrams/](docs/diagrams/):

- [01-system-architecture.svg](docs/diagrams/01-system-architecture.svg)
- [02-extension-internals.svg](docs/diagrams/02-extension-internals.svg)
- [03-paste-flow.svg](docs/diagrams/03-paste-flow.svg)
- [04-three-modes.svg](docs/diagrams/04-three-modes.svg)
- [05-audit-flow.svg](docs/diagrams/05-audit-flow.svg)
- [06-tech-stack.svg](docs/diagrams/06-tech-stack.svg)

Open any of them directly in a browser or in your editor's SVG preview.
