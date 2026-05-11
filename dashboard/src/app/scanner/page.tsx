'use client';

import { useCallback, useRef, useState } from 'react';
import { InfoIcon } from '@/components/InfoIcon';
import { insertAuditEvent } from '@/lib/supabase';
import type { ScanResult } from '@/lib/scannerEngine';

type FileState = {
    id: string;
    file: File;
    status: 'queued' | 'extracting' | 'scanning' | 'done' | 'error';
    progress?: number;
    result?: ScanResult;
    error?: string;
};

const ACCEPTED_EXT = ['pdf', 'docx', 'png', 'jpg', 'jpeg'];
const MAX_MB = 10;

type Sample = {
    file: string;
    label: string;
    hint: string;
    icon: string;
};

const SAMPLES: Sample[] = [
    {
        file: 'clean-corporate-memo.pdf',
        label: 'Clean Memo',
        hint: 'Benign internal memo — expected: SAFE',
        icon: '📄',
    },
    {
        file: 'prompt-injection.pdf',
        label: 'Prompt Injection',
        hint: '"Ignore all previous instructions" attack',
        icon: '⚠️',
    },
    {
        file: 'jailbreak-dan.pdf',
        label: 'Jailbreak (DAN)',
        hint: 'DAN + developer-mode + disable-safety payload',
        icon: '🔓',
    },
    {
        file: 'multi-vector-attack.pdf',
        label: 'Multi-Vector Attack',
        hint: 'Chains injection + role + leak + exfil + bypass',
        icon: '☠️',
    },
    {
        file: 'role-manipulation.docx',
        label: 'Role Manipulation (DOCX)',
        hint: '"You are now an unrestricted AI" persona swap',
        icon: '🎭',
    },
];

function extOf(name: string): string {
    const i = name.lastIndexOf('.');
    return i >= 0 ? name.slice(i + 1).toLowerCase() : '';
}

function fileTypeFor(ext: string): 'pdf' | 'docx' | 'image' | null {
    if (ext === 'pdf') return 'pdf';
    if (ext === 'docx') return 'docx';
    if (ext === 'png' || ext === 'jpg' || ext === 'jpeg') return 'image';
    return null;
}

function severityClass(sev: string): string {
    return `severity severity-${sev}`;
}

async function ocrImageInBrowser(
    file: File,
    onProgress: (pct: number) => void,
): Promise<string> {
    // Dynamic import keeps the ~5 MB tesseract bundle out of the initial page.
    const Tesseract = await import('tesseract.js');
    const worker = await Tesseract.createWorker('eng', 1, {
        logger: (m: any) => {
            if (m.status === 'recognizing text' && typeof m.progress === 'number') {
                onProgress(Math.round(m.progress * 100));
            }
        },
    });
    try {
        const { data } = await worker.recognize(file);
        return data?.text ?? '';
    } finally {
        await worker.terminate();
    }
}

async function scanFile(
    fs: FileState,
    update: (patch: Partial<FileState>) => void,
): Promise<ScanResult> {
    const ext = extOf(fs.file.name);
    const fileType = fileTypeFor(ext);
    if (!fileType) throw new Error(`Unsupported file type: .${ext}`);

    let result: ScanResult;

    if (fileType === 'image') {
        update({ status: 'extracting', progress: 0 });
        const text = await ocrImageInBrowser(fs.file, (pct) =>
            update({ progress: pct }),
        );
        update({ status: 'scanning', progress: undefined });
        const res = await fetch('/api/scan-file', {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({
                file_name: fs.file.name,
                file_type: fileType,
                extracted_text: text,
            }),
        });
        if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
        result = await res.json();
    } else {
        update({ status: 'scanning' });
        const fd = new FormData();
        fd.append('file', fs.file);
        const res = await fetch('/api/scan-file', { method: 'POST', body: fd });
        if (!res.ok) throw new Error((await res.json()).error ?? `HTTP ${res.status}`);
        result = await res.json();
    }

    // Audit-log every scan via the existing helper so /audit picks it up live.
    await insertAuditEvent({
        event_type: 'file_scan',
        mode: 'shadow',
        detection_count: result.threats_detected.length,
        categories_found: result.categories_found as unknown as string[],
        max_severity: result.severity === 'safe' ? null : result.severity,
        action_taken: result.safe ? 'allowed' : 'flagged',
        context_metadata: {
            file_name: result.file_name,
            file_type: result.file_type,
            risk_score: result.risk_score,
            scan_time_ms: result.scan_time_ms,
        },
    });

    return result;
}

export default function ScannerPage() {
    const [files, setFiles] = useState<FileState[]>([]);
    const [dragOver, setDragOver] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const update = useCallback((id: string, patch: Partial<FileState>) => {
        setFiles((prev) => prev.map((f) => (f.id === id ? { ...f, ...patch } : f)));
    }, []);

    const runScans = useCallback(
        async (entries: FileState[]) => {
            for (const fs of entries) {
                try {
                    const result = await scanFile(fs, (patch) => update(fs.id, patch));
                    update(fs.id, { status: 'done', result });
                } catch (e: any) {
                    update(fs.id, { status: 'error', error: e?.message ?? 'Scan failed' });
                }
            }
        },
        [update],
    );

    const addFiles = useCallback(
        (incoming: FileList | File[]) => {
            const list = Array.from(incoming);
            const accepted: FileState[] = [];
            const rejected: string[] = [];
            for (const file of list) {
                const ext = extOf(file.name);
                if (!ACCEPTED_EXT.includes(ext)) {
                    rejected.push(`${file.name}: unsupported type`);
                    continue;
                }
                if (file.size > MAX_MB * 1024 * 1024) {
                    rejected.push(`${file.name}: exceeds ${MAX_MB} MB`);
                    continue;
                }
                accepted.push({
                    id: `${file.name}-${file.size}-${Date.now()}-${Math.random()}`,
                    file,
                    status: 'queued',
                });
            }
            if (rejected.length > 0) {
                alert(rejected.join('\n'));
            }
            if (accepted.length === 0) return;
            // Replace the previous results so the page only ever shows the
            // analysis for the current selection — no stacking. The audit log
            // still preserves history of every scan that ran.
            setFiles(accepted);
            void runScans(accepted);
        },
        [runScans],
    );

    const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setDragOver(false);
        if (e.dataTransfer?.files?.length) addFiles(e.dataTransfer.files);
    };

    const loadSample = useCallback(
        async (sample: Sample) => {
            try {
                const res = await fetch(`/samples/${sample.file}`);
                if (!res.ok) throw new Error(`Failed to fetch sample: ${res.status}`);
                const blob = await res.blob();
                const ext = extOf(sample.file);
                const mime =
                    ext === 'pdf'
                        ? 'application/pdf'
                        : ext === 'docx'
                            ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
                            : blob.type;
                const file = new File([blob], sample.file, { type: mime });
                addFiles([file]);
            } catch (e: any) {
                alert(`Could not load sample: ${e?.message ?? e}`);
            }
        },
        [addFiles],
    );

    const clear = () => setFiles([]);

    return (
        <div className="page scanner-page">
            <div className="page-header">
                <div>
                    <h2>
                        File Upload Scanner{' '}
                        <InfoIcon label="About the file scanner">
                            <strong>File Upload Scanner</strong> inspects PDF, DOCX, and image
                            files for prompt-injection, jailbreak, system-prompt-leak, role-manipulation,
                            and data-exfiltration payloads <em>before</em> they reach your AI tool.
                            Images are OCR&apos;d in your browser; nothing leaves your machine except the
                            extracted text.
                        </InfoIcon>
                    </h2>
                    <p>Scan files for hidden prompt-injection and jailbreak payloads</p>
                </div>
                {files.length > 0 && (
                    <div className="header-actions">
                        <button className="btn btn-secondary" onClick={clear}>
                            Clear results
                        </button>
                    </div>
                )}
            </div>

            <div
                className={`drop-zone ${dragOver ? 'drop-zone-active' : ''}`}
                onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                }}
                onDragLeave={() => setDragOver(false)}
                onDrop={onDrop}
                onClick={() => inputRef.current?.click()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') inputRef.current?.click();
                }}
            >
                <input
                    ref={inputRef}
                    type="file"
                    multiple
                    accept=".pdf,.docx,.png,.jpg,.jpeg"
                    style={{ display: 'none' }}
                    onChange={(e) => {
                        if (e.target.files?.length) addFiles(e.target.files);
                        e.target.value = '';
                    }}
                />
                <div className="drop-zone-icon" aria-hidden="true">📂</div>
                <div className="drop-zone-text">
                    <strong>Drop files here</strong> or click to browse
                </div>
                <div className="drop-zone-hint">
                    PDF · DOCX · PNG · JPG · JPEG · up to {MAX_MB} MB · multi-file supported
                </div>
            </div>

            <div className="sample-bar">
                <div className="sample-bar-label">
                    Or load a sample:{' '}
                    <InfoIcon label="About sample files">
                        Five pre-built files demonstrating each attack category the scanner
                        catches. <strong>Clean Memo</strong> should scan SAFE; the rest range
                        from medium to critical risk.
                    </InfoIcon>
                </div>
                <div className="sample-buttons">
                    {SAMPLES.map((s) => (
                        <button
                            key={s.file}
                            className="sample-btn"
                            onClick={() => loadSample(s)}
                            title={s.hint}
                            type="button"
                        >
                            <span className="sample-btn-icon" aria-hidden="true">
                                {s.icon}
                            </span>
                            <span className="sample-btn-label">{s.label}</span>
                        </button>
                    ))}
                </div>
            </div>

            {files.length > 0 && (
                <div className="scan-results">
                    {files.map((fs) => (
                        <ScanCard key={fs.id} state={fs} />
                    ))}
                </div>
            )}

            <style jsx>{`
                .scanner-page {
                    padding: 24px;
                    max-width: 1100px;
                }

                .page-header {
                    display: flex;
                    align-items: flex-start;
                    justify-content: space-between;
                    margin-bottom: 24px;
                    gap: 16px;
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

                .scan-results {
                    display: flex;
                    flex-direction: column;
                    gap: 16px;
                }

                .sample-bar {
                    margin-bottom: 24px;
                }

                .sample-bar-label {
                    font-size: 13px;
                    color: #666;
                    margin-bottom: 10px;
                    display: flex;
                    align-items: center;
                    gap: 6px;
                }

                .sample-buttons {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 8px;
                }

                .sample-btn {
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    padding: 8px 14px;
                    border: 1px solid #e0e0e0;
                    background: #fff;
                    border-radius: 999px;
                    cursor: pointer;
                    font-size: 13px;
                    font-weight: 500;
                    color: #333;
                    transition: all 0.15s;
                }

                .sample-btn:hover {
                    border-color: #4285f4;
                    color: #4285f4;
                    transform: translateY(-1px);
                    box-shadow: 0 2px 6px rgba(66, 133, 244, 0.15);
                }

                .sample-btn-icon {
                    font-size: 14px;
                }
            `}</style>
        </div>
    );
}

function ScanCard({ state }: { state: FileState }) {
    const [showExcerpts, setShowExcerpts] = useState(false);
    const { file, status, result, error, progress } = state;

    let statusLabel = '';
    if (status === 'queued') statusLabel = 'Queued';
    else if (status === 'extracting')
        statusLabel = `OCR… ${typeof progress === 'number' ? `${progress}%` : ''}`;
    else if (status === 'scanning') statusLabel = 'Scanning…';
    else if (status === 'error') statusLabel = 'Error';

    return (
        <div className="scan-card">
            <div className="scan-card-head">
                <div className="scan-card-file">
                    <span className="scan-card-icon" aria-hidden="true">
                        {extOf(file.name) === 'pdf'
                            ? '📄'
                            : extOf(file.name) === 'docx'
                                ? '📝'
                                : '🖼️'}
                    </span>
                    <div>
                        <div className="scan-card-name">{file.name}</div>
                        <div className="scan-card-meta">
                            {(file.size / 1024).toFixed(1)} KB · {extOf(file.name).toUpperCase()}
                        </div>
                    </div>
                </div>

                {status !== 'done' && status !== 'error' && (
                    <div className="scan-card-status">{statusLabel}</div>
                )}

                {status === 'error' && (
                    <div className="scan-card-status scan-card-error">Error: {error}</div>
                )}

                {status === 'done' && result && (
                    <div className="scan-card-verdict">
                        <span className={severityClass(result.severity)}>
                            {result.severity.toUpperCase()}
                        </span>
                        <span className="risk-score-pill">Risk {result.risk_score}/100</span>
                    </div>
                )}
            </div>

            {status === 'done' && result && (
                <>
                    <RiskMeter score={result.risk_score} severity={result.severity} />

                    {result.threats_detected.length === 0 ? (
                        <div className="scan-card-clean">
                            ✓ No prompt-injection or jailbreak patterns detected.
                            <div className="scan-card-clean-sub">
                                Extracted {result.extracted_chars.toLocaleString()} chars · scanned in{' '}
                                {result.scan_time_ms} ms
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="scan-card-summary">
                                <strong>{result.threats_detected.length}</strong> threat
                                {result.threats_detected.length === 1 ? '' : 's'} across{' '}
                                <strong>{result.categories_found.length}</strong>{' '}
                                {result.categories_found.length === 1 ? 'category' : 'categories'} ·
                                scanned in {result.scan_time_ms} ms
                            </div>

                            <ul className="threat-list">
                                {result.threats_detected.map((t) => (
                                    <li key={t.id} className={`threat-item severity-${t.severity}`}>
                                        <div className="threat-item-head">
                                            <span className={`badge cat-${t.category.toLowerCase().replace(/\s+/g, '-')}`}>
                                                {t.category}
                                            </span>
                                            <span className="threat-item-label">{t.label}</span>
                                            <span className={`severity severity-${t.severity}`}>
                                                {t.severity}
                                            </span>
                                            <span className="threat-item-conf">
                                                {Math.round(t.confidence * 100)}% conf · {t.matches.length}{' '}
                                                match{t.matches.length === 1 ? '' : 'es'}
                                            </span>
                                        </div>
                                        {showExcerpts && (
                                            <div className="threat-item-excerpt">
                                                <code>{t.excerpt}</code>
                                            </div>
                                        )}
                                    </li>
                                ))}
                            </ul>

                            <button
                                className="btn btn-link"
                                onClick={() => setShowExcerpts((v) => !v)}
                            >
                                {showExcerpts ? 'Hide excerpts' : 'Show matched excerpts'}
                            </button>
                        </>
                    )}

                    {/* LLM-send gate. Only clean files are forwarded; risky
                        files show a blocking notice and the send UI is hidden. */}
                    {result.safe ? (
                        <LlmSendPanel
                            extractedText={result.extracted_text ?? ''}
                            fileName={file.name}
                            fileType={result.file_type}
                            riskScore={result.risk_score}
                        />
                    ) : (
                        <div className="scan-card-blocked">
                            <strong>🚫 Send to LLM blocked.</strong>{' '}
                            {result.threats_detected.length} threat
                            {result.threats_detected.length === 1 ? '' : 's'} detected in this
                            file ({result.categories_found.join(', ')}). Remove or replace the
                            file before sending its contents to any AI tool.
                        </div>
                    )}
                </>
            )}

            <style jsx>{`
                .scan-card {
                    background: #fff;
                    border: 1px solid #e0e0e0;
                    border-radius: 8px;
                    padding: 20px;
                    display: flex;
                    flex-direction: column;
                    gap: 14px;
                }

                .scan-card-head {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 16px;
                    flex-wrap: wrap;
                }

                .scan-card-file {
                    display: flex;
                    align-items: center;
                    gap: 12px;
                    min-width: 0;
                }

                .scan-card-icon {
                    font-size: 24px;
                    line-height: 1;
                }

                .scan-card-name {
                    font-weight: 600;
                    word-break: break-all;
                }

                .scan-card-meta {
                    color: #888;
                    font-size: 12px;
                }

                .scan-card-status {
                    color: #666;
                    font-size: 13px;
                    background: #f5f5f5;
                    padding: 6px 10px;
                    border-radius: 6px;
                }

                .scan-card-error {
                    color: #b71c1c;
                    background: #fde8e8;
                }

                .scan-card-verdict {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                }

                .risk-score-pill {
                    background: #f5f5f5;
                    padding: 4px 10px;
                    border-radius: 999px;
                    font-size: 12px;
                    font-weight: 600;
                    color: #444;
                }

                .scan-card-clean {
                    color: #0f6e56;
                    background: #e8f5ef;
                    padding: 12px 14px;
                    border-radius: 6px;
                    font-weight: 500;
                }

                .scan-card-clean-sub {
                    margin-top: 4px;
                    color: #666;
                    font-weight: 400;
                    font-size: 12px;
                }

                .scan-card-summary {
                    color: #444;
                    font-size: 14px;
                }

                .scan-card-blocked {
                    margin-top: 6px;
                    padding: 12px 14px;
                    background: #fde8e8;
                    color: #b71c1c;
                    border: 1px solid #f4c2c2;
                    border-radius: 6px;
                    font-size: 14px;
                    line-height: 1.5;
                }

                .threat-list {
                    list-style: none;
                    margin: 0;
                    padding: 0;
                    display: flex;
                    flex-direction: column;
                    gap: 8px;
                }

                .threat-item {
                    border: 1px solid #eee;
                    border-left: 4px solid #ccc;
                    border-radius: 6px;
                    padding: 10px 12px;
                    background: #fafafa;
                }

                .threat-item.severity-critical {
                    border-left-color: #b71c1c;
                }

                .threat-item.severity-high {
                    border-left-color: #ea4335;
                }

                .threat-item.severity-medium {
                    border-left-color: #fbbc04;
                }

                .threat-item.severity-low {
                    border-left-color: #4285f4;
                }

                .threat-item-head {
                    display: flex;
                    align-items: center;
                    gap: 10px;
                    flex-wrap: wrap;
                }

                .threat-item-label {
                    font-weight: 500;
                    flex: 1;
                    min-width: 0;
                }

                .threat-item-conf {
                    color: #888;
                    font-size: 12px;
                }

                .threat-item-excerpt {
                    margin-top: 8px;
                    padding: 8px 10px;
                    background: #fff;
                    border: 1px solid #eee;
                    border-radius: 4px;
                    overflow-x: auto;
                }

                .threat-item-excerpt code {
                    font-size: 12px;
                    color: #333;
                    white-space: pre-wrap;
                }

                .btn-link {
                    align-self: flex-start;
                    background: none;
                    border: none;
                    color: #4285f4;
                    cursor: pointer;
                    padding: 0;
                    font-size: 13px;
                    text-decoration: underline;
                }
            `}</style>
        </div>
    );
}

function RiskMeter({ score, severity }: { score: number; severity: string }) {
    const color =
        severity === 'critical'
            ? '#b71c1c'
            : severity === 'high'
                ? '#ea4335'
                : severity === 'medium'
                    ? '#fbbc04'
                    : severity === 'low'
                        ? '#4285f4'
                        : '#0f6e56';
    return (
        <div className="risk-meter" role="img" aria-label={`Risk score ${score} of 100`}>
            <div className="risk-meter-track">
                <div
                    className="risk-meter-fill"
                    style={{ width: `${Math.max(2, score)}%`, background: color }}
                />
            </div>
            <style jsx>{`
                .risk-meter {
                    width: 100%;
                }
                .risk-meter-track {
                    width: 100%;
                    height: 8px;
                    background: #f0f0f0;
                    border-radius: 999px;
                    overflow: hidden;
                }
                .risk-meter-fill {
                    height: 100%;
                    border-radius: 999px;
                    transition: width 0.4s ease-out, background 0.2s;
                }
            `}</style>
        </div>
    );
}

// ---------------------------------------------------------------------------
// LlmSendPanel — shown inside a scan card ONLY when the scan is clean.
// Lets the user type a prompt about the file and forward {prompt + extracted
// text} to the selected LLM via the existing /api/chat route.
// ---------------------------------------------------------------------------

function LlmSendPanel({
    extractedText,
    fileName,
    fileType,
    riskScore,
}: {
    extractedText: string;
    fileName: string;
    fileType: string;
    riskScore: number;
}) {
    const [prompt, setPrompt] = useState('Summarize this document.');
    const [provider, setProvider] = useState<'claude' | 'ollama'>('claude');
    const [sending, setSending] = useState(false);
    const [response, setResponse] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const send = useCallback(async () => {
        const userPrompt = prompt.trim() || 'Summarize this document.';
        const combined = `${userPrompt}\n\n--- Document content (${fileName}) ---\n${extractedText}`;

        setError(null);
        setSending(true);
        setResponse(null);
        try {
            const res = await fetch('/api/chat', {
                method: 'POST',
                headers: { 'content-type': 'application/json' },
                body: JSON.stringify({ provider, prompt: combined }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data?.error ?? `HTTP ${res.status}`);
            setResponse(String(data?.content ?? ''));

            await insertAuditEvent({
                event_type: 'file_sent',
                mode: 'shadow',
                ai_tool: provider,
                action_taken: 'allowed',
                context_metadata: {
                    source: 'scanner_send',
                    file_name: fileName,
                    file_type: fileType,
                    risk_score: riskScore,
                    user_prompt: userPrompt,
                },
            });
        } catch (e: any) {
            setError(e?.message ?? 'Send failed');
        } finally {
            setSending(false);
        }
    }, [prompt, provider, extractedText, fileName, fileType, riskScore]);

    return (
        <div className="llm-send-panel">
            <div className="llm-send-head">
                <strong>Ask the AI about this file</strong>
                <span className="llm-send-sub">
                    File is clean — forwarding its contents to the selected LLM is allowed.
                </span>
            </div>

            <textarea
                className="llm-send-prompt"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="Summarize this document."
                rows={2}
            />

            <div className="llm-send-actions">
                <div className="provider-row">
                    <label className="provider-label">Send to:</label>
                    <select
                        className="provider-select"
                        value={provider}
                        onChange={(e) => setProvider(e.target.value as 'claude' | 'ollama')}
                        disabled={sending}
                    >
                        <option value="claude">Claude (Anthropic API)</option>
                        <option value="ollama">Ollama (local · qwen3:latest)</option>
                    </select>
                </div>
                <button
                    className="btn btn-primary"
                    onClick={send}
                    disabled={sending || !extractedText.trim()}
                >
                    {sending ? 'Sending…' : 'Send to LLM'}
                </button>
            </div>

            {error && <div className="llm-send-error">Error: {error}</div>}

            {response !== null && (
                <div className="llm-send-response">
                    <div className="llm-send-response-head">
                        <strong>LLM response</strong>
                        <span className="llm-send-sub">via {provider}</span>
                    </div>
                    <div className="llm-send-response-body">{response || '(empty response)'}</div>
                </div>
            )}

            <style jsx>{`
                .llm-send-panel {
                    border-top: 1px solid #f0f0f0;
                    padding-top: 14px;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }

                .llm-send-head {
                    display: flex;
                    align-items: baseline;
                    gap: 10px;
                    flex-wrap: wrap;
                }

                .llm-send-sub {
                    font-size: 12px;
                    color: #777;
                }

                .llm-send-prompt {
                    width: 100%;
                    padding: 10px 12px;
                    border: 1px solid #e0e0e0;
                    border-radius: 6px;
                    font-family: inherit;
                    font-size: 14px;
                    line-height: 1.5;
                    resize: vertical;
                }

                .llm-send-prompt:focus {
                    outline: none;
                    border-color: #4285f4;
                    box-shadow: 0 0 0 3px rgba(66, 133, 244, 0.1);
                }

                .llm-send-actions {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    gap: 12px;
                    flex-wrap: wrap;
                }

                .provider-row {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                }

                .provider-label {
                    font-size: 13px;
                    color: #666;
                }

                .provider-select {
                    padding: 8px 10px;
                    border: 1px solid #e0e0e0;
                    border-radius: 6px;
                    font-size: 13px;
                    background: #fff;
                }

                .btn-primary {
                    background: #4285f4;
                    color: #fff;
                    border: none;
                    padding: 9px 16px;
                    border-radius: 6px;
                    font-weight: 500;
                    cursor: pointer;
                }

                .btn-primary:hover:not(:disabled) {
                    background: #3367d6;
                }

                .btn-primary:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }

                .llm-send-error {
                    padding: 10px 14px;
                    background: #fde8e8;
                    color: #b71c1c;
                    border-radius: 6px;
                    font-size: 14px;
                }

                .llm-send-response {
                    background: #f8fbff;
                    border: 1px solid #d6e3ff;
                    border-radius: 6px;
                    padding: 12px 14px;
                }

                .llm-send-response-head {
                    display: flex;
                    align-items: baseline;
                    gap: 10px;
                    margin-bottom: 6px;
                }

                .llm-send-response-body {
                    white-space: pre-wrap;
                    font-size: 14px;
                    line-height: 1.55;
                    color: #1a1a1a;
                }
            `}</style>
        </div>
    );
}

