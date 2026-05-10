'use client';

import { useState } from 'react';

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

// Simple detection engine
function detectSensitiveData(text: string) {
  const detections: any[] = [];
  const allPatterns = { ...PHI_PATTERNS, ...PII_PATTERNS };

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
    'FINANCIAL': '#E1F5EE'
  };

  for (const det of detections) {
    html += escapeHtml(text.substring(lastEnd, det.start));
    const bgColor = colorMap[det.category] || '#E8E8E8';
    const textColor = det.category === 'PHI' ? '#A32D2D' : '#633806';
    html += `<mark style="background-color: ${bgColor}; color: ${textColor}; padding: 2px 4px; border-radius: 3px; font-weight: 600;">${escapeHtml(det.text)}</mark>`;
    lastEnd = det.end;
  }

  html += escapeHtml(text.substring(lastEnd));
  return html;
}

// Build masked text
function buildMasked(text: string, detections: any[]) {
  if (detections.length === 0) return text;

  let masked = '';
  let lastEnd = 0;
  const tokenMap = new Map<string, string>();
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
  return masked;
}

export default function ShieldPage() {
  const [input, setSampleInput] = useState('');
  const [detections, setDetections] = useState<any[]>([]);
  const [highlighted, setHighlighted] = useState('');
  const [masked, setMasked] = useState('');
  const [mode, setMode] = useState<'shadow' | 'fix' | 'warn'>('warn');

  const handleScan = async () => {
    if (!input.trim()) {
      alert('Please enter some text to scan');
      return;
    }

    const found = detectSensitiveData(input);
    setDetections(found);
    setHighlighted(buildHighlighted(input, found));
    setMasked(buildMasked(input, found));
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
          <h3>Protection Mode</h3>
          <div className="mode-tabs">
            {(['shadow', 'fix', 'warn'] as const).map(m => (
              <button
                key={m}
                className={`tab ${mode === m ? 'active' : ''}`}
                onClick={() => setMode(m)}
              >
                {m.charAt(0).toUpperCase() + m.slice(1)}
              </button>
            ))}
          </div>
        </div>

        {/* Input Textarea */}
        <div className="section">
          <h3>Sample Text</h3>
          <textarea
            className="input-textarea"
            placeholder="Paste text here to scan for sensitive data..."
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
            {mode === 'warn' && (
              <div className="section">
                <div className="action-buttons">
                  <button className="btn btn-success">✓ Mask & Send</button>
                  <button className="btn btn-secondary">✏️ Edit Manually</button>
                  <button className="btn btn-danger">🚫 Block</button>
                </div>
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

        .btn-success {
          background: #0f6e56;
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
      `}</style>
    </div>
  );
}
