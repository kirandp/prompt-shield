# PromptShield — AI-Native Data Loss Prevention

**Intercept, detect, and mask sensitive data before it reaches any AI tool.**

PromptShield is an enterprise-grade data loss prevention solution built specifically for the AI age. It's a Chrome extension that sits between your employees and public AI services (ChatGPT, Claude, Gemini, Copilot), detecting sensitive data in real time and giving you three protection modes:

- **Shadow Mode**: Silent logging for compliance assessment
- **Fix Mode**: Automatic masking for frictionless protection
- **Warn Mode**: User alerts with explicit consent workflows

## Features

✅ **Real-Time Detection** – Regex + semantic AI-powered scanning for PII, PHI, secrets, and financial data
✅ **Three Protection Modes** – Shadow (log), Fix (auto-mask), Warn (user choice)
✅ **Custom Rules** – User and org-level rules with session consistency
✅ **Reversible Anonymization** – Tokens replace data client-side; AI never sees raw values
✅ **Audit Trail** – All events logged to Supabase without raw prompt exposure
✅ **Enterprise Dashboard** – Real-time audit, rules management, analytics, compliance tracking
✅ **HIPAA / GDPR / PCI-Ready** – Built for regulated environments

## Project Structure

```
promptshield/
├── extension/                           # Chrome Extension (Manifest V3)
│   ├── manifest.json                    # MV3 configuration
│   ├── background.js                    # Service worker
│   ├── content-script.js                # Injected into AI tool pages
│   ├── src/
│   │   ├── detection/
│   │   │   ├── patterns.js              # Regex patterns for all data types
│   │   │   └── engine.js                # Scan, mask, highlight logic
│   │   ├── rules/
│   │   │   └── engine.js                # Custom rules with priority
│   │   ├── modes/                       # Shadow, Fix, Warn handlers
│   │   └── utils/
│   │       ├── tokenMap.js              # Session token consistency
│   │       └── audit.js                 # Event logging to Supabase
│   ├── popup/
│   │   ├── popup.html                   # Mode switcher UI
│   │   ├── popup.css                    # Styling
│   │   └── popup.js                     # Popup logic
│   └── overlay/                         # Warn mode overlay
│
├── dashboard/                           # Next.js Admin Dashboard
│   ├── src/
│   │   ├── app/
│   │   │   ├── shield/                  # Demo interface
│   │   │   ├── rules/                   # Rules management
│   │   │   ├── audit/                   # Audit log
│   │   │   ├── dashboard/               # Analytics
│   │   │   └── settings/                # Configuration
│   │   ├── components/
│   │   ├── lib/
│   │   └── types/
│   └── package.json
│
├── supabase/
│   └── schema.sql                       # Database schema + RLS
│
└── README.md
```

## Quick Start

### 1. Clone and Setup

```bash
git clone https://github.com/your-org/promptshield.git
cd promptshield
```

### 2. Load Chrome Extension

1. Open `chrome://extensions`
2. Enable **Developer mode**
3. Click **Load unpacked**
4. Select the `extension/` folder

The PromptShield icon should appear in your toolbar.

### 3. Set Up Supabase

```bash
# Create a Supabase project at https://supabase.com
# Get your URL and anon key

# Initialize database
psql -h db.supabase.co -U postgres -d postgres -f supabase/schema.sql

# Set environment variables in extension and dashboard
```

### 4. Run Dashboard (Development)

```bash
cd dashboard
npm install
npm run dev
# Opens at http://localhost:3000
```

### 5. Test Detection

1. Go to https://chat.openai.com
2. Paste: `Patient: John Smith, SSN: 428-55-9021, ICD-10: E11.9`
3. PromptShield should intercept and show the warn overlay
4. Choose to mask and send, or edit manually

## Detection Coverage

| Category | Patterns | Count |
|----------|----------|-------|
| **PHI** (HIPAA) | SSN, MRN, Insurance ID, ICD-10, Medication, NPI, Treatment Date | 8 |
| **PII** (GDPR) | Email, Phone, Credit Card, CVV, Bank Account, Passport, DoB, Address | 8 |
| **Secrets** | API Keys, GitHub tokens, AWS keys, DB strings, Private keys, JWT | 10 |
| **Financial** | IBAN, SWIFT, Card expiry, Transaction ID, Salary | 5 |

**Plus:** Custom rules with exact match, regex, category override, and keyword context.

## Three Modes Explained

### Shadow Mode
- ✅ Zero user interruption
- ✅ Full audit trail for compliance
- ✅ Best for: Assessment phase, risk profiling
- ❌ No protection (data passes through unmodified)

### Fix Mode (Auto-Shield)
- ✅ Seamless protection — paste works normally, masked before AI sees it
- ✅ Token map stored locally — AI responses de-anonymized before user sees them
- ✅ Best for: Production use, maximum convenience
- ⚠️ Requires trust in detection accuracy

### Warn Mode (Guard)
- ✅ Explicit user consent — user sees detections and chooses action
- ✅ Three options: Auto-mask & send / Edit manually / Block & report
- ✅ Best for: Regulated environments, training, high-risk data
- ⚠️ Increases user friction

## Custom Rules

Define rules to override default masking behavior:

```javascript
// Exact match rule
{
  name: "Client substitution",
  type: "exact",
  match: "Acme Corporation",
  replacement: "Sample Corp",
  scope: "session"
}

// Regex pattern rule
{
  name: "SSN format-preserving",
  type: "regex",
  pattern: "\\d{3}-\\d{2}-\\d{4}",
  replacement: "000-00-0000"
}

// Category override
{
  name: "Person names to pseudonyms",
  type: "category",
  category: "PERSON",
  replacement: "sequential", // Person A, Person B, C...
}
```

Rules are stored per-user (personal) or org-wide (admin) with priority ordering:
1. Org exact rules
2. Personal exact rules
3. Org category rules
4. Personal category rules
5. Org pattern rules
6. Personal pattern rules

Session consistency guaranteed: same original value = same token within a session.

## API Reference

### Background Service Worker Messages

```javascript
// Get current state
chrome.runtime.sendMessage({ type: 'GET_STATE' }, (response) => {
  console.log(response.state); // { mode, policy, isPaused, sessionId }
});

// Set mode
chrome.runtime.sendMessage({ type: 'SET_MODE', mode: 'fix' });

// Toggle pause
chrome.runtime.sendMessage({ type: 'TOGGLE_PAUSE' });

// Log event
chrome.runtime.sendMessage({
  type: 'LOG_EVENT',
  eventType: 'detection',
  detectionCount: 3,
  categories: ['PHI', 'PII'],
  maxSeverity: 'high',
  aiTool: 'chatgpt',
  actionTaken: 'masked'
});
```

### Detection Engine

```javascript
import { regexScan, applyRules, buildMasked, buildHighlighted } from './src/detection/engine.js';

// Scan for detections
const detections = regexScan(text);

// Apply custom rules
const withRules = applyRules(text, detections, rules);

// Build masked version
const { masked, tokenMap } = buildMasked(text, detections);

// Build highlighted HTML
const { highlighted } = buildHighlighted(text, detections);
```

## Environment Variables

### Extension (`.env`)
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
ANTHROPIC_API_KEY=sk-ant-...
```

### Dashboard (`dashboard/.env.local`)
```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
ANTHROPIC_API_KEY=sk-ant-...
```

## Deployment

### Extension
1. Package as `.zip` from the `extension/` folder
2. Submit to [Chrome Web Store](https://chromewebstore.google.com/)
3. Or distribute via enterprise policies

### Dashboard
```bash
npm run build
# Deploy to Vercel, AWS, etc.
```

### Supabase
- Database schema already initialized
- Enable RLS policies for multi-tenant security
- Set up webhooks for SIEM integration

## Compliance

- ✅ **HIPAA** – PHI detection, audit trail, encryption ready
- ✅ **GDPR** – PII detection, consent workflows, data export
- ✅ **PCI-DSS** – Payment data masking, key protection
- ✅ **SOC 2** – Audit logging, access controls, encryption

## Architecture Decisions

### 1. Reversible Anonymization
Raw data never leaves the device. Sensitive spans are replaced with typed tokens (`[PHI_1]`, `[PII_2]`, etc.) before the AI sees them. A local token map lets us restore the original values in responses before showing them to users.

### 2. Client-Side Detection
All detection runs in the browser extension, not on remote servers. No prompts are sent to PromptShield infrastructure. This eliminates the "I'm giving my data to another company" concern.

### 3. Session Consistency
Within a single session (one conversation), if "John Smith" maps to "Person A", every subsequent mention of "John Smith" uses the same token. This lets AI reason coherently about entities without knowing their real names.

### 4. Audit Without Raw Data
Audit events store only metadata: count, categories, severity, timestamp, mode, action. Never the original text or sensitive values. Secure by design.

## Roadmap

**Phase 2 (In Progress)**
- [ ] Response guard (blur AI outputs containing sensitive data)
- [ ] File upload scanner (PDF, DOCX, images)
- [ ] Semantic detection (spaCy NER + WASM)

**Phase 3**
- [ ] Agent action interceptor (hook AI tool calls)
- [ ] Cross-tool data movement detection
- [ ] Role-based policy engine (AD/SCIM sync)
- [ ] De-anonymization attack blocker

**Phase 4**
- [ ] Response watermarking (forensic traceability)
- [ ] SIEM webhooks (Splunk, Datadog, Sentinel)
- [ ] Compliance report generation (HIPAA, GDPR, PCI)
- [ ] Browser history scrubbing

## Contributing

1. Fork the repo
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

MIT License — See `LICENSE` file for details

## Support

- 📧 support@promptshield.io
- 💬 [Discord Community](https://discord.gg/promptshield)
- 📚 [Documentation](https://docs.promptshield.io)
- 🐛 [Report a Bug](https://github.com/your-org/promptshield/issues)

---

**Made with ❤️ for enterprise security teams.**
