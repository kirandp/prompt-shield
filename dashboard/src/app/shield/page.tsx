'use client';

import { useState } from 'react';
import {
  generateSyntheticPatientRecord,
  generateSyntheticFinancialRecord,
  generateSyntheticSecret,
  generateSyntheticCorporateData,
} from '@/lib/fakerData';
import { insertAuditEvent } from '@/lib/supabase';
import { InfoIcon } from '@/components/InfoIcon';

const MODE_DESCRIPTIONS: Record<'shadow' | 'fix' | 'warn', { title: string; body: string }> = {
  shadow: {
    title: 'Shadow',
    body: 'Detect-only. Logs detections to the audit trail but does NOT alter the prompt sent to the AI tool. Use this when tuning rules before enforcement.',
  },
  fix: {
    title: 'Fix',
    body: 'Auto-mask. Silently replaces detected sensitive data with placeholder tokens (e.g. [PHONE_1]) before the prompt reaches the AI. The user sees no warning.',
  },
  warn: {
    title: 'Warn',
    body: 'Confirm-before-send. Shows the user a warning with the detections and requires explicit confirmation before the (masked) prompt is sent.',
  },
};

const SEVERITY_RANK: Record<string, number> = { low: 1, medium: 2, high: 3, critical: 4 };

function summarizeDetections(dets: any[]) {
  const categories = Array.from(new Set(dets.map((d) => d.category)));
  let max: string | null = null;
  let rank = 0;
  for (const d of dets) {
    const r = SEVERITY_RANK[d.severity] ?? 0;
    if (r > rank) { rank = r; max = d.severity; }
  }
  return {
    detection_count: dets.length,
    categories_found: categories,
    max_severity: max,
  };
}

// Detection patterns - PHI (Protected Health Information)
const PHI_PATTERNS = {
  SSN: { pattern: /\b(?:\d{3}|XXX)-(?:\d{2}|XX)-(?:\d{4}|\d{4})\b/g, category: 'PHI', severity: 'critical', id: 'SSN', description: 'Social Security Number' },
  MRN: { pattern: /(?:MRN|Medical\s+Record\s+Number):\s*([0-9A-Z\-*]{4,30})/gi, category: 'PHI', severity: 'critical', id: 'MRN', description: 'Medical Record Number' },
  TREATMENT_DATE: { pattern: /(?:Treatment\s+Date):\s*(\d{4}-\d{1,2}-\d{1,2}|\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4})/gi, category: 'PHI', severity: 'high', id: 'TREATMENT_DATE', description: 'Treatment Date' },
  MEDICATION: { pattern: /\b(?:aspirin|ibuprofen|metformin|lisinopril|atorvastatin|omeprazole|albuterol|levothyroxine|amoxicillin|sertraline|metoprolol|amlodipine|simvastatin|fluoxetine|clopidogrel)\b/gi, category: 'PHI', severity: 'medium', id: 'MEDICATION', description: 'Medication Name' }
};

// Detection patterns - PII
const PII_PATTERNS = {
  PATIENT_NAME: { pattern: /(?:Patient):\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g, category: 'PII', severity: 'high', id: 'PATIENT_NAME', description: 'Patient Name' },
  EMAIL: { pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, category: 'PII', severity: 'high', id: 'EMAIL', description: 'Email Address' }
};

// Detection patterns - FINANCIAL DATA
const FINANCIAL_PATTERNS = {
  CREDIT_CARD: { pattern: /(?:Card\s+Number|Credit\s+Card):\s*(\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4})/gi, category: 'FINANCIAL', severity: 'critical', id: 'CREDIT_CARD', description: 'Credit Card Number' },
  CARD_NUMBER_PATTERN: { pattern: /\b\d{4}[\s\-]?\d{4}[\s\-]?\d{4}[\s\-]?\d{4}\b/g, category: 'FINANCIAL', severity: 'critical', id: 'CARD_NUMBER', description: 'Card Number' },
  CVV: { pattern: /(?:CVV|CVC):\s*(\d{3,4})/gi, category: 'FINANCIAL', severity: 'critical', id: 'CVV', description: 'Card CVV/CVC' },
  ACCOUNT_NUMBER: { pattern: /(?:Account\s+Number|Account\s+#):\s*(\d{10,12})/gi, category: 'FINANCIAL', severity: 'high', id: 'ACCOUNT_NUMBER', description: 'Account Number' },
  ROUTING_NUMBER: { pattern: /(?:Routing\s+Number|Routing\s+#):\s*(\d{9})/gi, category: 'FINANCIAL', severity: 'high', id: 'ROUTING_NUMBER', description: 'Routing Number' },
  TRANSACTION_AMOUNT: { pattern: /(?:Transaction\s+Amount|Amount):\s*\$?([\d,]+\.?\d{0,2})/gi, category: 'FINANCIAL', severity: 'medium', id: 'TRANSACTION_AMOUNT', description: 'Transaction Amount' }
};

// Detection patterns - SECRETS (API Keys, Tokens, Passwords)
const SECRET_PATTERNS = {
  API_KEY: { pattern: /(?:API\s+Key|api_key):\s*(sk_live_[a-zA-Z0-9_]{20,}|[a-zA-Z0-9]{32,})/gi, category: 'SECRET', severity: 'critical', id: 'API_KEY', description: 'API Key' },
  AUTH_TOKEN: { pattern: /(?:Auth\s+Token|Token):\s*([a-zA-Z0-9_\-]{40,})/gi, category: 'SECRET', severity: 'critical', id: 'AUTH_TOKEN', description: 'Authentication Token' },
  PASSWORD: { pattern: /(?:Password):\s*([^\s\n]+)/gi, category: 'SECRET', severity: 'critical', id: 'PASSWORD', description: 'Password' },
  SERVICE_KEY: { pattern: /(?:sk_live_)([a-zA-Z0-9_]{20,})/gi, category: 'SECRET', severity: 'critical', id: 'SERVICE_KEY', description: 'Service Key' }
};

// Detection patterns - CORPORATE DATA
const CORPORATE_PATTERNS = {
  EMPLOYEE_ID: { pattern: /(?:Employee\s+ID|EMP):\s*([A-Z]{0,3}[\-]?\d{4}[\-]?\d{4})/gi, category: 'CORPORATE', severity: 'high', id: 'EMPLOYEE_ID', description: 'Employee ID' },
  IP_ADDRESS: { pattern: /(?:IP|Workstation\s+IP):\s*(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/g, category: 'CORPORATE', severity: 'high', id: 'IP_ADDRESS', description: 'IP Address' },
  MAC_ADDRESS: { pattern: /(?:MAC|MAC\s+Address):\s*([0-9A-Fa-f]{2}(?::[0-9A-Fa-f]{2}){5})/g, category: 'CORPORATE', severity: 'high', id: 'MAC_ADDRESS', description: 'MAC Address' },
  JOB_TITLE: { pattern: /(?:Role):\s*([A-Za-z\s]+?)(?:\n|$)/gi, category: 'CORPORATE', severity: 'medium', id: 'JOB_TITLE', description: 'Job Title' },
  EMPLOYEE_NAME: { pattern: /(?:Employee):\s*([A-Z][a-z]+(?:\s+[A-Z][a-z]+)*)/g, category: 'CORPORATE', severity: 'high', id: 'EMPLOYEE_NAME', description: 'Employee Name' }
};

// Simple detection engine
function detectSensitiveData(text: string) {
  const detections: any[] = [];
  const allPatterns = { ...PHI_PATTERNS, ...PII_PATTERNS, ...FINANCIAL_PATTERNS, ...SECRET_PATTERNS, ...CORPORATE_PATTERNS };

  for (const [key, patternObj] of Object.entries(allPatterns)) {
    const regex = new RegExp(patternObj.pattern.source, patternObj.pattern.flags);
    let match;
    while ((match = regex.exec(text)) !== null) {
      // Use capture group if exists, otherwise use full match
      const capturedText = match[1] || match[0];
      const startOffset = match[1] ? match.index + match[0].indexOf(match[1]) : match.index;

      detections.push({
        id: `${patternObj.id}_${match.index}`,
        text: capturedText,
        fullMatch: match[0],
        category: patternObj.category,
        severity: patternObj.severity,
        patternId: patternObj.id,
        description: (patternObj as any).description || patternObj.id,
        start: startOffset,
        end: startOffset + capturedText.length
      });
    }
  }

  // Sort by start position and remove overlaps
  return detections.sort((a, b) => a.start - b.start).reduce((acc: any[], det) => {
    if (!acc.some(d => d.start < det.end && d.end > det.start)) acc.push(det);
    return acc;
  }, []);
}

// Escape HTML special characters
function escapeHtml(text: string) {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

// Build highlighted HTML
function buildHighlighted(text: string, detections: any[]) {
  if (detections.length === 0) return `<div>${escapeHtml(text)}</div>`;

  let html = '';
  let lastEnd = 0;

  const colorMap: Record<string, string> = {
    'PHI': '#FCEBEB',
    'PII': '#FAEEDA',
    'SECRET': '#EEEDFE',
    'FINANCIAL': '#E1F5EE',
    'CORPORATE': '#E3F2FD'
  };

  for (const det of detections) {
    html += escapeHtml(text.substring(lastEnd, det.start));
    const bgColor = colorMap[det.category] || '#E8E8E8';
    const textColorMap: Record<string, string> = {
      'PHI': '#A32D2D',
      'PII': '#633806',
      'SECRET': '#4A148C',
      'FINANCIAL': '#00695C',
      'CORPORATE': '#0D47A1'
    };
    const textColor = textColorMap[det.category] || '#333';
    html += `<mark style="background-color: ${bgColor}; color: ${textColor}; padding: 2px 4px; border-radius: 3px; font-weight: 600;">${escapeHtml(det.text)}</mark>`;
    lastEnd = det.end;
  }

  html += escapeHtml(text.substring(lastEnd));
  return html;
}

// Build masked text + token map (token map is needed to de-anonymize the AI response)
function buildMasked(text: string, detections: any[]): { masked: string; tokenMap: Map<string, string> } {
  const tokenMap = new Map<string, string>();
  if (detections.length === 0) return { masked: text, tokenMap };

  let masked = '';
  let lastEnd = 0;
  const categoryCounters: Record<string, number> = {};

  for (const det of detections) {
    masked += text.substring(lastEnd, det.start);

    let token = tokenMap.get(det.text);
    if (!token) {
      categoryCounters[det.category] = (categoryCounters[det.category] || 0) + 1;
      token = `[${det.category}_${categoryCounters[det.category]}]`;
      tokenMap.set(det.text, token);
    }

    masked += token;
    lastEnd = det.end;
  }

  masked += text.substring(lastEnd);
  return { masked, tokenMap };
}

// Replace tokens back to their original values (used on the AI response).
function deanonymize(text: string, tokenMap: Map<string, string> | null): string {
  if (!tokenMap || tokenMap.size === 0) return text;
  let result = text;
  for (const [original, token] of tokenMap.entries()) {
    const escaped = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    result = result.replace(new RegExp(escaped, 'g'), original);
  }
  return result;
}

export default function ShieldPage() {
  const [input, setSampleInput] = useState('');
  const [detections, setDetections] = useState<any[]>([]);
  const [highlighted, setHighlighted] = useState('');
  const [masked, setMasked] = useState('');
  const [tokenMap, setTokenMap] = useState<Map<string, string> | null>(null);
  const [mode, setMode] = useState<'shadow' | 'fix' | 'warn'>('warn');

  const [provider, setProvider] = useState<'ollama' | 'claude'>('ollama');
  const [response, setResponse] = useState<string | null>(null);
  const [responseRaw, setResponseRaw] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [showRaw, setShowRaw] = useState(false);

  const [sessionId] = useState(
    () => `shield_${Math.random().toString(36).slice(2, 10)}`
  );

  const handleScan = async () => {
    if (!input.trim()) {
      alert('Please enter some text to scan');
      return;
    }

    const found = detectSensitiveData(input);
    const { masked: maskedText, tokenMap: map } = buildMasked(input, found);

    setDetections(found);
    setHighlighted(buildHighlighted(input, found));
    setMasked(maskedText);
    setTokenMap(map);
    // Reset any previous AI run
    setResponse(null);
    setResponseRaw(null);
    setSendError(null);

    void insertAuditEvent({
      event_type: 'detection',
      mode,
      action_taken: found.length > 0 ? 'detected' : 'clean',
      session_id: sessionId,
      ...summarizeDetections(found),
    });
  };

  const handleMaskAndSend = async () => {
    if (!masked) return;
    setIsSending(true);
    setSendError(null);
    setResponse(null);
    setResponseRaw(null);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ provider, prompt: masked }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);

      const raw = String(data?.content ?? '');
      setResponseRaw(raw);
      setResponse(deanonymize(raw, tokenMap));

      void insertAuditEvent({
        event_type: 'masked',
        mode,
        action_taken: 'masked',
        ai_tool: provider,
        session_id: sessionId,
        ...summarizeDetections(detections),
      });
    } catch (e: any) {
      setSendError(e?.message ?? 'Request failed');
    } finally {
      setIsSending(false);
    }
  };

  const handleEditManually = () => {
    if (!masked) return;

    void insertAuditEvent({
      event_type: 'allowed',
      mode,
      action_taken: 'edited',
      session_id: sessionId,
      ...summarizeDetections(detections),
    });

    setSampleInput(masked);
    setDetections([]);
    setHighlighted('');
    setMasked('');
    setTokenMap(null);
    setResponse(null);
    setResponseRaw(null);
    setSendError(null);
  };

  const handleBlock = () => {
    if (detections.length > 0) {
      void insertAuditEvent({
        event_type: 'blocked',
        mode,
        action_taken: 'blocked',
        session_id: sessionId,
        ...summarizeDetections(detections),
      });
    }

    setSampleInput('');
    setDetections([]);
    setHighlighted('');
    setMasked('');
    setTokenMap(null);
    setResponse(null);
    setResponseRaw(null);
    setSendError(null);
  };

  const handleReportIncident = () => {
    if (detections.length > 0) {
      void insertAuditEvent({
        event_type: 'incident_report',
        mode,
        action_taken: 'reported',
        session_id: sessionId,
        ...summarizeDetections(detections),
      });
    }

    setSampleInput('');
    setDetections([]);
    setHighlighted('');
    setMasked('');
    setTokenMap(null);
    setResponse(null);
    setResponseRaw(null);
    setSendError(null);
  };

  return (
    <div className="page">
      <div className="page-header">
        <h2>Shield Demo</h2>
        <p>Test the PromptShield detection engine in real time</p>
      </div>

      <div className="demo-container">
        {/* Mode Selector */}
        <div className="section">
          <h3>
            Protection Mode{' '}
            <InfoIcon label="About protection modes">
              <strong>Three modes</strong> control how PromptShield reacts when sensitive data is detected:
              <ul>
                <li><strong>Shadow</strong> — log only, prompt unchanged</li>
                <li><strong>Fix</strong> — auto-mask silently</li>
                <li><strong>Warn</strong> — confirm with the user</li>
              </ul>
            </InfoIcon>
          </h3>
          <div className="mode-tabs">
            {(['shadow', 'fix', 'warn'] as const).map(m => (
              <span key={m} className="mode-tab-wrapper">
                <button
                  className={`tab ${mode === m ? 'active' : ''}`}
                  onClick={() => setMode(m)}
                >
                  {MODE_DESCRIPTIONS[m].title}
                </button>
                <InfoIcon label={`About ${MODE_DESCRIPTIONS[m].title} mode`}>
                  <strong>{MODE_DESCRIPTIONS[m].title}</strong>
                  <br />
                  {MODE_DESCRIPTIONS[m].body}
                </InfoIcon>
              </span>
            ))}
          </div>
        </div>

        {/* Input Textarea */}
        <div className="section">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
            <h3 style={{ margin: 0 }}>Sample Text</h3>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <button
                className="btn btn-demo"
                onClick={() => {
                  setSampleInput(generateSyntheticPatientRecord());
                  setDetections([]);
                  setHighlighted('');
                  setMasked('');
                  setTokenMap(null);
                  setResponse(null);
                  setResponseRaw(null);
                }}
                title="Load synthetic patient medical record with PHI"
              >
                📋 Patient Record
              </button>
              <button
                className="btn btn-demo"
                onClick={() => {
                  setSampleInput(generateSyntheticFinancialRecord());
                  setDetections([]);
                  setHighlighted('');
                  setMasked('');
                  setTokenMap(null);
                  setResponse(null);
                  setResponseRaw(null);
                }}
                title="Load synthetic financial data with PII"
              >
                💳 Financial Data
              </button>
              <button
                className="btn btn-demo"
                onClick={() => {
                  setSampleInput(generateSyntheticSecret());
                  setDetections([]);
                  setHighlighted('');
                  setMasked('');
                  setTokenMap(null);
                  setResponse(null);
                  setResponseRaw(null);
                }}
                title="Load synthetic API secrets and credentials"
              >
                🔐 API Secrets
              </button>
              <button
                className="btn btn-demo"
                onClick={() => {
                  setSampleInput(generateSyntheticCorporateData());
                  setDetections([]);
                  setHighlighted('');
                  setMasked('');
                  setTokenMap(null);
                  setResponse(null);
                  setResponseRaw(null);
                }}
                title="Load synthetic corporate employee data"
              >
                🏢 Corporate Data
              </button>
            </div>
          </div>
          <textarea
            className="input-textarea"
            placeholder="Paste text here to scan for sensitive data... (or use demo buttons above)"
            value={input}
            onChange={(e) => setSampleInput(e.target.value)}
            rows={6}
          />
          <button className="btn btn-primary" onClick={handleScan}>
            Scan for Sensitive Data
          </button>
        </div>

        {/* Results */}
        {detections.length > 0 && (
          <>
            {/* Detection List */}
            <div className="section">
              <h3>Detections Found</h3>
              <div className="detection-list">
                {detections.map((det) => (
                  <div key={det.id} className={`detection-item severity-${det.severity}`}>
                    <span className={`badge badge-${det.category.toLowerCase()}`}>
                      {det.category}
                    </span>
                    <span className="detection-type">{det.description}</span>
                    <code>{det.fullMatch || det.text}</code>
                    <span className={`severity-badge severity-${det.severity}`}>{det.severity.toUpperCase()}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Highlighted Preview */}
            <div className="section">
              <h3>Highlighted Text</h3>
              <div className="preview highlighted" dangerouslySetInnerHTML={{ __html: highlighted }} />
            </div>

            {/* Masked Preview */}
            <div className="section">
              <h3>What AI Would Receive (Masked)</h3>
              <div className="preview masked">{masked}</div>
            </div>

            {/* Action Buttons */}
            <div className="section">
              <div className="provider-row">
                <label className="provider-label">Send to</label>
                <select
                  className="provider-select"
                  value={provider}
                  onChange={(e) => setProvider(e.target.value as 'ollama' | 'claude')}
                  disabled={isSending}
                >
                  <option value="ollama">Ollama (local · qwen3:latest)</option>
                  <option value="claude">Claude (Anthropic API)</option>
                </select>
              </div>
              <div className="action-buttons">
                <button
                  className="btn btn-success"
                  onClick={handleMaskAndSend}
                  disabled={isSending || !masked}
                >
                  {isSending ? 'Sending…' : '✓ Mask & Send'}
                </button>
                <button
                  className="btn btn-secondary"
                  onClick={handleEditManually}
                  disabled={isSending || !masked}
                >
                  ✏️ Edit Manually
                </button>
                <button
                  className="btn btn-warning"
                  onClick={handleReportIncident}
                  disabled={isSending || detections.length === 0}
                >
                  🚨 Report Incident
                </button>
                <button
                  className="btn btn-danger"
                  onClick={handleBlock}
                  disabled={isSending}
                >
                  🚫 Block
                </button>
              </div>
            </div>

            {/* AI Response */}
            {sendError && (
              <div className="section">
                <h3>Error</h3>
                <div className="error-box">{sendError}</div>
              </div>
            )}

            {response !== null && (
              <div className="section">
                <div className="response-header">
                  <h3>AI Response (de-anonymized)</h3>
                  <label className="toggle-raw">
                    <input
                      type="checkbox"
                      checked={showRaw}
                      onChange={(e) => setShowRaw(e.target.checked)}
                    />
                    <span>Show raw (with tokens)</span>
                  </label>
                </div>
                <div className="preview response">
                  {showRaw ? responseRaw : response}
                </div>
                <p className="response-note">
                  Tokens like <code>[PHI_1]</code> were replaced back to your original values
                  client-side after the AI replied. The AI never saw the raw data.
                </p>
              </div>
            )}
          </>
        )}
      </div>

      <style jsx>{`
        .page {
          padding: 24px;
          max-width: 900px;
        }

        .page-header {
          margin-bottom: 32px;
        }

        .page-header h2 {
          margin: 0 0 8px;
          font-size: 28px;
          font-weight: 600;
        }

        .page-header p {
          margin: 0;
          color: #666;
        }

        .demo-container {
          display: flex;
          flex-direction: column;
          gap: 24px;
        }

        .section {
          background: white;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          padding: 20px;
        }

        .section h3 {
          margin: 0 0 16px;
          font-size: 16px;
          font-weight: 600;
        }

        .mode-tabs {
          display: flex;
          gap: 12px;
          align-items: center;
        }

        .mode-tab-wrapper {
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .tab {
          padding: 10px 16px;
          border: 1px solid #e0e0e0;
          background: white;
          border-radius: 6px;
          cursor: pointer;
          font-weight: 500;
          transition: all 0.2s;
        }

        .tab:hover {
          border-color: #4285f4;
          color: #4285f4;
        }

        .tab.active {
          background: #0f6e56;
          color: white;
          border-color: #0f6e56;
        }

        .input-textarea {
          width: 100%;
          padding: 12px;
          border: 1px solid #e0e0e0;
          border-radius: 6px;
          font-family: monospace;
          font-size: 14px;
          resize: vertical;
          margin-bottom: 12px;
        }

        .btn {
          padding: 10px 16px;
          border: none;
          border-radius: 6px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-primary {
          background: #4285f4;
          color: white;
        }

        .btn-primary:hover {
          background: #3367d6;
        }

        .btn-demo {
          background: #e8f0fe;
          color: #1a73e8;
          padding: 8px 12px;
          font-size: 12px;
          border: 1px solid #b3d9f2;
        }

        .btn-demo:hover {
          background: #d2e3fc;
          border-color: #8ab4f8;
        }

        .btn-success {
          background: #0f6e56;
          color: white;
        }

        .btn-warning {
          background: #f57c00;
          color: white;
        }

        .btn-danger {
          background: #ea4335;
          color: white;
        }

        .btn-secondary {
          background: #f5f5f5;
          color: #333;
        }

        .detection-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .detection-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px;
          background: #f9f9f9;
          border-radius: 6px;
          border-left: 4px solid #e0e0e0;
        }

        .detection-item.severity-critical {
          border-left-color: #ea4335;
        }

        .detection-item.severity-high {
          border-left-color: #fbbc04;
        }

        .badge {
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
          white-space: nowrap;
        }

        .badge-phi {
          background: #fcebeb;
          color: #a32d2d;
        }

        .badge-pii {
          background: #faeeda;
          color: #633806;
        }

        .badge-secret {
          background: #eeedfe;
          color: #4a148c;
        }

        .badge-financial {
          background: #e1f5ee;
          color: #00695c;
        }

        .badge-corporate {
          background: #e3f2fd;
          color: #0d47a1;
        }

        .detection-type {
          font-size: 13px;
          font-weight: 500;
          color: #333;
          white-space: nowrap;
        }

        .severity-badge {
          padding: 3px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
          white-space: nowrap;
          margin-left: auto;
        }

        .severity-critical {
          background: #fce8e6;
          color: #c5221f;
        }

        .severity-high {
          background: #fef7e0;
          color: #b06000;
        }

        .severity-medium {
          background: #e8f0fe;
          color: #1a73e8;
        }

        .severity-low {
          background: #e6f4ea;
          color: #137333;
        }

        .preview {
          padding: 12px;
          background: #f9f9f9;
          border-radius: 6px;
          font-family: monospace;
          font-size: 13px;
          line-height: 1.5;
          word-break: break-all;
          max-height: 300px;
          overflow-y: auto;
        }

        .action-buttons {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
        }

        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .provider-row {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 16px;
          padding-bottom: 16px;
          border-bottom: 1px solid #eee;
        }

        .provider-label {
          font-size: 13px;
          font-weight: 600;
          color: #555;
        }

        .provider-select {
          padding: 8px 12px;
          border: 1px solid #e0e0e0;
          border-radius: 6px;
          font-size: 14px;
          background: white;
          flex: 1;
          max-width: 360px;
        }

        .response-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
          margin-bottom: 12px;
        }

        .response-header h3 {
          margin: 0;
        }

        .toggle-raw {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          color: #666;
          cursor: pointer;
        }

        .preview.response {
          white-space: pre-wrap;
          max-height: 480px;
        }

        .response-note {
          margin: 12px 0 0;
          font-size: 12px;
          color: #888;
          line-height: 1.5;
        }

        .response-note code {
          background: #f1f5f9;
          padding: 1px 6px;
          border-radius: 3px;
          font-size: 11px;
        }

        .error-box {
          padding: 12px 16px;
          background: #fee2e2;
          color: #7f1d1d;
          border: 1px solid #fca5a5;
          border-radius: 6px;
          font-size: 13px;
          line-height: 1.5;
          word-break: break-word;
        }
      `}</style>
    </div>
  );
}
