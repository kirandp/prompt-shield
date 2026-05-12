# PromptShield Setup Guide

Complete step-by-step guide to get PromptShield running.

## Prerequisites

- Node.js >= 18
- npm or yarn
- Chrome browser
- Supabase account (free at https://supabase.com)
- Anthropic API key (for semantic detection)

## Step 1: Supabase Setup

1. **Create a Supabase Project**
   - Go to https://supabase.com and sign up
   - Create a new project
   - Wait for the project to provision

2. **Initialize Database Schema**
   - Go to the SQL Editor in Supabase
   - Open `supabase/schema.sql` from this project
   - Copy all SQL and paste into the Supabase SQL editor
   - Run the query to create all tables, indexes, and policies

3. **Get Your Credentials**
   - Go to Settings → API
   - Copy your `Project URL` and `Anon Key`
   - Save these for later steps

## Step 2: Extension Setup

1. **Create Environment File**
   ```bash
   cd extension
   cp .env.example .env
   ```

2. **Update `.env` with Your Credentials**
   ```
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-anon-key
   ANTHROPIC_API_KEY=sk-ant-your-api-key
   ```

3. **Load the Extension**
   - Open `chrome://extensions` in Chrome
   - Enable **Developer mode** (top right toggle)
   - Click **Load unpacked**
   - Select the `extension/` folder from this project
   - The PromptShield icon should appear in your toolbar

4. **Test Basic Functionality**
   - Click the PromptShield icon to open the popup
   - Try different modes (Shadow, Fix, Warn)
   - Verify the status badge updates

## Step 3: Dashboard Setup

1. **Install Dependencies**
   ```bash
   cd dashboard
   npm install
   ```

2. **Create Environment File**
   ```bash
   cp .env.local.example .env.local
   ```

3. **Update `.env.local` with Your Credentials**
   ```
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   ANTHROPIC_API_KEY=sk-ant-your-api-key
   ```

4. **Start Development Server**
   ```bash
   npm run dev
   ```

5. **Access the Dashboard**
   - Open http://localhost:3000 in your browser
   - You should see the PromptShield dashboard
   - Navigate to different pages (Shield, Rules, Audit, Dashboard, Settings)

## Step 4: End-to-End Testing

### Test Detection (Shadow Mode)

1. Go to https://chat.openai.com (or any AI tool)
2. Set extension to **Shadow** mode
3. Paste this test text:
   ```
   Patient: John Smith
   SSN: 428-55-9021
   Medical Record Number: MRN123456
   Treatment Date: 2024-01-15
   Medication: Metformin
   ```
4. Check that the extension detects the data
5. Go to the Dashboard → Audit Log
6. You should see the detection event logged

### Test Detection (Fix Mode)

1. Set extension to **Fix** mode
2. Paste the same test text
3. The masked version should be inserted instead
4. Verify the toast notification shows
5. Check the Dashboard for the masking event

### Test Detection (Warn Mode)

1. Set extension to **Warn** mode
2. Paste the test text
3. A warning overlay should appear
4. Try the three options:
   - **Auto-mask & send** → text is masked
   - **Edit manually** → you can manually edit
   - **Block & report** → event is logged as blocked

### Test Custom Rules

1. Go to Dashboard → Custom Rules
2. Create a new rule:
   - Type: Exact match
   - Match: "Acme Corporation"
   - Replacement: "Sample Corp"
3. Go back to ChatGPT and paste: "Acme Corporation is our largest client"
4. With Fix mode, verify it's replaced with "Sample Corp"

### Test Audit Log

1. Go to Dashboard → Audit Log
2. You should see all your test events
3. Try filtering by mode, severity, date
4. Click "Export CSV" to download audit trail

## Step 5: Configure Alerts (Optional)

### Slack Integration

1. Create a Slack webhook:
   - Go to your Slack workspace settings
   - Create an Incoming Webhook
   - Copy the webhook URL

2. In Dashboard → Settings:
   - Paste the Slack webhook URL
   - Click "Test Webhook"
   - Verify the test message appears in Slack

### SIEM Integration

1. Select your SIEM platform (Splunk, Datadog, Sentinel, Elastic)
2. Enter the API endpoint
3. Configure authentication
4. Click "Configure" and test

## Troubleshooting

### Extension Not Showing Detected Data

- Verify Supabase credentials are correct in `.env`
- Check browser console (F12 → Console tab) for errors
- Ensure content script is loaded:
  - Check chrome://extensions → PromptShield → Errors
  - Refresh the AI tool page (F5)

### Dashboard Not Loading

- Verify Node.js is version 18+: `node -v`
- Check `.env.local` has correct Supabase URL and key
- Clear `.next` folder and restart: `rm -rf .next && npm run dev`
- Check console for errors: `npm run dev` should show any TypeScript errors

### Detections Not Appearing

- Make sure extension is loaded properly
- Verify content script is injected (check Chrome DevTools Sources)
- Test with simpler pattern first (just email)
- Check network tab for Supabase connection errors

### Audit Events Not Showing in Dashboard

- Verify Supabase Real-time is enabled:
  - Go to Supabase → Replication
  - Ensure `audit_events` is in publication
- Check browser console for Supabase errors
- Try reloading the audit page (F5)

## File Structure Reference

```
extension/
  manifest.json              # Chrome extension config
  background.js             # Service worker
  content-script.js         # Injected into pages
  src/
    detection/
      patterns.js           # Regex patterns
      engine.js             # Detection engine
    rules/
      engine.js             # Custom rules
    utils/
      tokenMap.js           # Session consistency
      audit.js              # Event logging
    modes/                  # (Handler code in content-script)
  popup/
    popup.html              # Extension UI
    popup.css
    popup.js
  overlay/                  # Warn mode overlay

dashboard/
  src/
    app/
      shield/page.tsx       # Demo interface
      rules/page.tsx        # Rules management
      audit/page.tsx        # Audit log
      dashboard/page.tsx    # Analytics
      settings/page.tsx     # Configuration
      layout.tsx            # Main layout
      globals.css           # Global styles
    lib/
      supabase.ts           # Supabase client
    types/
      detection.ts          # TypeScript interfaces
  package.json              # Dependencies
  next.config.js            # Next.js config
  tsconfig.json             # TypeScript config

supabase/
  schema.sql                # Database schema
```

## Next Steps

1. **Customize Detection Patterns**
   - Edit `extension/src/detection/patterns.js`
   - Add your organization-specific patterns

2. **Set Up CI/CD**
   - Store environment variables in your CI/CD platform
   - Build and deploy automatically on push

3. **Deploy Extension**
   - Submit to Chrome Web Store
   - Or distribute via enterprise policies

4. **Deploy Dashboard**
   - Build: `npm run build`
   - Deploy to Vercel, AWS, or your platform
   - Set production environment variables

5. **Enable Advanced Features**
   - File upload scanning (requires PDF.js, Tesseract.js)
   - Semantic NER (requires spaCy, WASM)
   - Agent interceptor (requires LangGraph setup)

## Support

- 📧 support@promptshield.io
- 📚 [Documentation](https://docs.promptshield.io)
- 🐛 Report issues on GitHub

---

**Happy shielding! 🛡️**
