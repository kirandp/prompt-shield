'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase, subscribeToAuditEvents, isSupabaseConfigured } from '@/lib/supabase';
import { DatePickerField } from '@/components/DatePickerField';
import { InfoIcon } from '@/components/InfoIcon';

type ReplayDetection = {
  id?: string;
  text: string;
  category: string;
  severity: string;
  description?: string;
  start: number;
  end: number;
};

type ReplayPayload = {
  replay_available?: boolean;
  original_prompt?: string | null;
  masked_prompt?: string | null;
  token_map?: Array<[string, string]> | null;
  ai_response_raw?: string | null;
  ai_response_rehydrated?: string | null;
  provider?: string | null;
  detections?: ReplayDetection[];
};

type AuditEvent = {
  id: number | string;
  timestamp: string;
  user_id?: string | null;
  user_email?: string | null;
  mode?: string | null;
  event_type?: string;
  detection_count?: number;
  categories_found?: string[];
  max_severity?: string | null;
  action_taken?: string | null;
  ai_tool?: string | null;
  context_metadata?: ReplayPayload | null;
};

const CATEGORY_BG: Record<string, string> = {
  PHI: '#FCEBEB',
  PII: '#FAEEDA',
  SECRET: '#EEEDFE',
  FINANCIAL: '#E1F5EE',
  CORPORATE: '#E3F2FD',
};

const CATEGORY_FG: Record<string, string> = {
  PHI: '#A32D2D',
  PII: '#633806',
  SECRET: '#4A148C',
  FINANCIAL: '#00695C',
  CORPORATE: '#0D47A1',
};

function escapeHtml(text: string) {
  const map: Record<string, string> = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;',
  };
  return text.replace(/[&<>"']/g, (m) => map[m]);
}

function renderHighlighted(text: string, detections: ReplayDetection[]) {
  if (!text) return '';
  if (!detections || detections.length === 0) return escapeHtml(text);
  const sorted = [...detections].sort((a, b) => a.start - b.start);
  let html = '';
  let lastEnd = 0;
  for (const d of sorted) {
    if (d.start < lastEnd) continue;
    html += escapeHtml(text.slice(lastEnd, d.start));
    const bg = CATEGORY_BG[d.category] ?? '#E8E8E8';
    const fg = CATEGORY_FG[d.category] ?? '#333';
    html += `<mark style="background-color:${bg};color:${fg};padding:2px 4px;border-radius:3px;font-weight:600;">${escapeHtml(text.slice(d.start, d.end))}</mark>`;
    lastEnd = d.end;
  }
  html += escapeHtml(text.slice(lastEnd));
  return html;
}

const DEMO_EVENTS: AuditEvent[] = [
  {
    id: 'demo-1',
    timestamp: new Date(Date.now() - 1000 * 60 * 12).toISOString(),
    user_email: 'demo-user-1@example.com',
    mode: 'fix',
    detection_count: 3,
    categories_found: ['PHI', 'PII'],
    max_severity: 'high',
    action_taken: 'masked',
    ai_tool: 'chatgpt',
  },
  {
    id: 'demo-2',
    timestamp: new Date(Date.now() - 1000 * 60 * 75).toISOString(),
    user_email: 'demo-user-2@example.com',
    mode: 'warn',
    detection_count: 5,
    categories_found: ['SECRET'],
    max_severity: 'critical',
    action_taken: 'blocked',
    ai_tool: 'claude',
  },
  {
    id: 'demo-3',
    timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    user_email: 'demo-user-3@example.com',
    mode: 'shadow',
    detection_count: 7,
    categories_found: ['FINANCIAL', 'SECRET', 'PHI'],
    max_severity: 'critical',
    action_taken: 'reported',
    ai_tool: undefined,
  },
];

export default function AuditPage() {
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [usingDemoData, setUsingDemoData] = useState(false);

  const [filters, setFilters] = useState({
    mode: 'all',
    severity: 'all',
    startDate: '',
    endDate: '',
  });

  const [replayEvent, setReplayEvent] = useState<AuditEvent | null>(null);
  const [replayShowRaw, setReplayShowRaw] = useState(false);

  // Pagination
  const PAGE_SIZE_OPTIONS = [10, 25, 50, 100];
  const [pageSize, setPageSize] = useState(25);
  const [page, setPage] = useState(1);

  const filtersRef = useRef(filters);

  useEffect(() => {
    filtersRef.current = filters;
  }, [filters]);

  const fetchEvents = useCallback(async () => {
    if (!supabase) {
      setEvents(DEMO_EVENTS);
      setUsingDemoData(true);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      let query = supabase
        .from('audit_events')
        .select(
          'id, timestamp, user_id, mode, event_type, detection_count, categories_found, max_severity, action_taken, ai_tool, context_metadata'
        )
        .order('timestamp', { ascending: false })
        .limit(200);

      if (filters.mode !== 'all') {
        query = query.eq('mode', filters.mode);
      }

      if (filters.severity !== 'all') {
        query = query.eq('max_severity', filters.severity);
      }

      if (filters.startDate) {
        query = query.gte('timestamp', `${filters.startDate}T00:00:00Z`);
      }

      if (filters.endDate) {
        query = query.lte('timestamp', `${filters.endDate}T23:59:59Z`);
      }

      const { data, error: dbError } = await query;

      if (dbError) throw dbError;

      const baseRows: AuditEvent[] = (data ?? []).map((row: any) => ({
        id: row.id,
        timestamp: row.timestamp,
        user_id: row.user_id,
        user_email: null,
        mode: row.mode,
        event_type: row.event_type,
        detection_count: row.detection_count ?? 0,
        categories_found: row.categories_found ?? [],
        max_severity: row.max_severity,
        action_taken: row.action_taken,
        ai_tool: row.ai_tool,
        context_metadata: row.context_metadata ?? null,
      }));

      const ids = Array.from(
        new Set(baseRows.map((row) => row.user_id).filter((id): id is string => Boolean(id)))
      );

      if (ids.length > 0) {
        const { data: userRows } = await supabase
          .from('users')
          .select('id, email')
          .in('id', ids);

        if (userRows?.length) {
          const emailById = new Map(userRows.map((user: any) => [user.id, user.email]));

          for (const row of baseRows) {
            if (row.user_id) {
              row.user_email = emailById.get(row.user_id) ?? null;
            }
          }
        }
      }

      setEvents(baseRows);
      setUsingDemoData(false);
    } catch (err: any) {
      setError(err?.message ?? 'Failed to load audit events');
      setEvents([]);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // Reset to page 1 whenever filters change or events refresh
  useEffect(() => {
    setPage(1);
  }, [filters, pageSize, events.length]);

  const totalPages = Math.max(1, Math.ceil(events.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const pageStart = (safePage - 1) * pageSize;
  const pageEnd = Math.min(pageStart + pageSize, events.length);
  const pagedEvents = events.slice(pageStart, pageEnd);

  useEffect(() => {
    if (!isSupabaseConfigured) return;

    const unsubscribe = subscribeToAuditEvents((payload: any) => {
      const row = payload?.new;
      if (!row) return;

      const currentFilters = filtersRef.current;

      if (currentFilters.mode !== 'all' && row.mode !== currentFilters.mode) return;
      if (currentFilters.severity !== 'all' && row.max_severity !== currentFilters.severity) return;

      if (currentFilters.startDate && row.timestamp < `${currentFilters.startDate}T00:00:00Z`) {
        return;
      }

      if (currentFilters.endDate && row.timestamp > `${currentFilters.endDate}T23:59:59Z`) {
        return;
      }

      const mapped: AuditEvent = {
        id: row.id,
        timestamp: row.timestamp,
        user_id: row.user_id,
        user_email: null,
        mode: row.mode,
        event_type: row.event_type,
        detection_count: row.detection_count ?? 0,
        categories_found: row.categories_found ?? [],
        max_severity: row.max_severity,
        action_taken: row.action_taken,
        ai_tool: row.ai_tool,
        context_metadata: row.context_metadata ?? null,
      };

      setEvents((prev) => [mapped, ...prev].slice(0, 200));
    });

    return unsubscribe;
  }, []);

  const handleExportCSV = () => {
    const csv = [
      ['#', 'Timestamp', 'User', 'Mode', 'Detections', 'Categories', 'Severity', 'Action', 'AI Tool'],
      ...events.map((event, idx) => [
        String(idx + 1),
        formatTs(event.timestamp),
        event.user_email ?? event.user_id ?? '',
        event.mode ?? '',
        String(event.detection_count ?? 0),
        (event.categories_found ?? []).join('; '),
        event.max_severity ?? '',
        event.action_taken ?? '',
        event.ai_tool ?? '',
      ]),
    ]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = window.URL.createObjectURL(blob);

    const link = document.createElement('a');
    link.href = url;
    const today = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric', month: '2-digit', day: '2-digit',
    }).format(new Date());
    link.download = `audit_${today}.csv`;
    link.click();

    window.URL.revokeObjectURL(url);
  };

  const formatTs = (iso: string) => {
    if (!iso) return '';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return iso;
    // sv-SE + Asia/Kolkata yields YYYY-MM-DD HH:MM:SS, sortable and matches the
    // prior shape; "IST" suffix keeps the timezone unambiguous for users.
    const formatted = new Intl.DateTimeFormat('sv-SE', {
      timeZone: 'Asia/Kolkata',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
      hour12: false,
    }).format(date);
    return `${formatted} IST`;
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2>Audit Log</h2>
          <p>
            Real-time event tracking and compliance audit trail
            {!loading && events.length > 0 && (
              <span className="event-count">
                {' '}· {events.length} event{events.length === 1 ? '' : 's'}
              </span>
            )}
          </p>
        </div>

        <div className="header-actions">
          <button className="btn btn-secondary" onClick={fetchEvents} disabled={loading}>
            {loading ? 'Loading…' : '↻ Refresh'}
          </button>

          <button className="btn btn-secondary" onClick={handleExportCSV} disabled={events.length === 0}>
            ⬇ Export CSV
          </button>
        </div>
      </div>

      {usingDemoData && (
        <div className="banner banner-info">
          <strong>Demo data shown.</strong> Configure Supabase environment variables to see live audit events.
        </div>
      )}

      {error && (
        <div className="banner banner-error">
          <strong>Failed to load events:</strong> {error}
        </div>
      )}

      <div className="filters-bar">
        <span className="filter-with-info">
          <select value={filters.mode} onChange={(e) => setFilters({ ...filters, mode: e.target.value })}>
            <option value="all">All Modes</option>
            <option value="shadow">Shadow</option>
            <option value="fix">Fix</option>
            <option value="warn">Warn</option>
          </select>
          <InfoIcon label="About protection modes">
            <strong>Protection modes</strong>
            <ul>
              <li><strong>Shadow</strong> — detect only, prompt unchanged</li>
              <li><strong>Fix</strong> — auto-mask before send</li>
              <li><strong>Warn</strong> — confirm with user first</li>
            </ul>
          </InfoIcon>
        </span>

        <span className="filter-with-info">
          <select value={filters.severity} onChange={(e) => setFilters({ ...filters, severity: e.target.value })}>
            <option value="all">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <InfoIcon label="About severity levels">
            <strong>Severity</strong> reflects the worst category found in a prompt:
            <ul>
              <li><strong>Critical</strong> — SSN, payment cards, secrets</li>
              <li><strong>High</strong> — PHI, government IDs</li>
              <li><strong>Medium</strong> — emails, phone numbers</li>
              <li><strong>Low</strong> — names, job titles</li>
            </ul>
          </InfoIcon>
        </span>

        <DatePickerField
          value={filters.startDate}
          onChange={(v) => setFilters({ ...filters, startDate: v })}
          ariaLabel="Start date"
          placeholder="Start date"
        />

        <DatePickerField
          value={filters.endDate}
          onChange={(v) => setFilters({ ...filters, endDate: v })}
          ariaLabel="End date"
          placeholder="End date"
        />

        {(filters.mode !== 'all' || filters.severity !== 'all' || filters.startDate || filters.endDate) && (
          <button
            className="btn btn-link"
            onClick={() => setFilters({ mode: 'all', severity: 'all', startDate: '', endDate: '' })}
          >
            Clear filters
          </button>
        )}
      </div>

      <div className="section">
        <table className="events-table">
          <thead>
            <tr>
              <th className="col-sn">#</th>
              <th>Timestamp</th>
              <th>User</th>
              <th>Mode</th>
              <th>Detections</th>
              <th>Categories</th>
              <th>Severity</th>
              <th>Action</th>
              <th>AI Tool</th>
              <th>Replay</th>
            </tr>
          </thead>

          <tbody>
            {loading && events.length === 0 && (
              <tr>
                <td colSpan={10} className="empty-state">Loading audit events…</td>
              </tr>
            )}

            {!loading && events.length === 0 && (
              <tr>
                <td colSpan={10} className="empty-state">
                  No events match the current filters.
                </td>
              </tr>
            )}

            {pagedEvents.map((event, idx) => (
              <tr key={event.id}>
                <td className="col-sn">{pageStart + idx + 1}</td>
                <td>{formatTs(event.timestamp)}</td>
                <td>{event.user_email ?? (event.user_id ? `${event.user_id.slice(0, 8)}…` : '—')}</td>
                <td>{event.mode ? <span className={`badge mode-${event.mode}`}>{event.mode}</span> : '—'}</td>
                <td>{event.detection_count ?? 0}</td>
                <td>
                  <div className="category-badges">
                    {(event.categories_found ?? []).map((cat) => (
                      <span key={cat} className={`badge cat-${cat.toLowerCase()}`}>
                        {cat}
                      </span>
                    ))}
                  </div>
                </td>
                <td>
                  {event.max_severity ? (
                    <span className={`severity severity-${event.max_severity}`}>
                      {event.max_severity}
                    </span>
                  ) : '—'}
                </td>
                <td>
                  {event.action_taken ? (
                    <span className={`badge action-${event.action_taken.toLowerCase()}`}>
                      {event.action_taken}
                    </span>
                  ) : '—'}
                </td>
                <td>{event.ai_tool ?? '—'}</td>
                <td>
                  {event.context_metadata?.replay_available ? (
                    <button
                      className="btn btn-replay"
                      onClick={() => {
                        setReplayShowRaw(false);
                        setReplayEvent(event);
                      }}
                    >
                      🎬 Replay
                    </button>
                  ) : (
                    '—'
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {events.length > 0 && (
          <div className="pagination-bar">
            <div className="pagination-info">
              Showing <strong>{events.length === 0 ? 0 : pageStart + 1}</strong>–
              <strong>{pageEnd}</strong> of <strong>{events.length}</strong>
            </div>

            <div className="pagination-controls">
              <label className="page-size-label">
                Rows per page
                <select
                  value={pageSize}
                  onChange={(e) => setPageSize(Number(e.target.value))}
                  aria-label="Rows per page"
                >
                  {PAGE_SIZE_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </label>

              <div className="page-nav">
                <button
                  className="page-btn"
                  onClick={() => setPage(1)}
                  disabled={safePage === 1}
                  aria-label="First page"
                >
                  «
                </button>
                <button
                  className="page-btn"
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                  aria-label="Previous page"
                >
                  ‹ Prev
                </button>
                <span className="page-indicator">
                  Page <strong>{safePage}</strong> of <strong>{totalPages}</strong>
                </span>
                <button
                  className="page-btn"
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage === totalPages}
                  aria-label="Next page"
                >
                  Next ›
                </button>
                <button
                  className="page-btn"
                  onClick={() => setPage(totalPages)}
                  disabled={safePage === totalPages}
                  aria-label="Last page"
                >
                  »
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {replayEvent && replayEvent.context_metadata && (
        <div
          className="replay-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setReplayEvent(null);
          }}
        >
          <div className="replay-modal" role="dialog" aria-modal="true">
            <div className="replay-header">
              <div>
                <h3>🎬 Time-Travel Replay</h3>
                <p className="replay-meta">
                  {formatTs(replayEvent.timestamp)} · mode <strong>{replayEvent.mode ?? '—'}</strong>
                  {' · '}provider <strong>{replayEvent.context_metadata.provider ?? '—'}</strong>
                  {' · '}session <code>{(replayEvent as any).session_id ?? '—'}</code>
                </p>
              </div>
              <button className="btn btn-secondary" onClick={() => setReplayEvent(null)}>
                ✕ Close
              </button>
            </div>

            <div className="replay-grid">
              <div className="replay-pane">
                <div className="replay-pane-title">1. What the user typed</div>
                <div
                  className="preview replay-preview"
                  dangerouslySetInnerHTML={{
                    __html: renderHighlighted(
                      replayEvent.context_metadata.original_prompt ?? '',
                      replayEvent.context_metadata.detections ?? []
                    ),
                  }}
                />
              </div>

              <div className="replay-pane">
                <div className="replay-pane-title">2. What was detected</div>
                <div className="preview replay-preview">
                  {(replayEvent.context_metadata.detections ?? []).length === 0 ? (
                    <em>No detections recorded.</em>
                  ) : (
                    <ul className="replay-detections">
                      {(replayEvent.context_metadata.detections ?? []).map((d, i) => (
                        <li key={i}>
                          <span
                            className="replay-cat"
                            style={{
                              background: CATEGORY_BG[d.category] ?? '#eee',
                              color: CATEGORY_FG[d.category] ?? '#333',
                            }}
                          >
                            {d.category}
                          </span>
                          <strong>{d.description ?? d.category}</strong>
                          <code>{d.text}</code>
                          <span className={`severity severity-${d.severity}`}>{d.severity}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              <div className="replay-pane">
                <div className="replay-pane-title">3. What the AI received (masked)</div>
                <div className="preview replay-preview">
                  {replayEvent.context_metadata.masked_prompt || <em>—</em>}
                </div>
                {(replayEvent.context_metadata.token_map ?? []).length > 0 && (
                  <details className="replay-tokens">
                    <summary>Token map ({replayEvent.context_metadata.token_map!.length})</summary>
                    <table>
                      <thead>
                        <tr><th>Token</th><th>Original</th></tr>
                      </thead>
                      <tbody>
                        {replayEvent.context_metadata.token_map!.map(([orig, tok], i) => (
                          <tr key={i}>
                            <td><code>{tok}</code></td>
                            <td>{orig}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </details>
                )}
              </div>

              <div className="replay-pane">
                <div className="replay-pane-title">
                  4. What the AI returned
                  {(replayEvent.context_metadata.ai_response_raw ||
                    replayEvent.context_metadata.ai_response_rehydrated) && (
                    <label className="replay-toggle">
                      <input
                        type="checkbox"
                        checked={replayShowRaw}
                        onChange={(e) => setReplayShowRaw(e.target.checked)}
                      />
                      <span>{replayShowRaw ? 'Showing raw (tokens)' : 'Showing rehydrated'}</span>
                    </label>
                  )}
                </div>
                <div className="preview replay-preview">
                  {replayShowRaw
                    ? replayEvent.context_metadata.ai_response_raw || <em>No response captured.</em>
                    : replayEvent.context_metadata.ai_response_rehydrated || <em>No response captured.</em>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .page {
          padding: 24px;
          max-width: 1200px;
        }

        .page-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 32px;
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

        .event-count {
          color: #888;
          font-weight: 500;
        }

        .header-actions {
          display: flex;
          gap: 8px;
        }

        .banner {
          margin-bottom: 16px;
          padding: 12px 16px;
          border-radius: 6px;
          font-size: 14px;
          line-height: 1.5;
        }

        .banner-info {
          background: #fef9c3;
          color: #713f12;
          border: 1px solid #fde047;
        }

        .banner-error {
          background: #fee2e2;
          color: #7f1d1d;
          border: 1px solid #fca5a5;
        }

        .filters-bar {
          display: flex;
          gap: 12px;
          margin-bottom: 24px;
          flex-wrap: wrap;
          align-items: center;
        }

        .filters-bar select,
        .filters-bar input {
          padding: 10px 12px;
          border: 1px solid #e0e0e0;
          border-radius: 6px;
          font-size: 14px;
          background: #fff;
        }

        .filter-with-info {
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }

        .section {
          background: white;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          overflow: hidden;
        }

        .events-table {
          width: 100%;
          border-collapse: collapse;
        }

        .events-table thead {
          background: #f5f5f5;
          border-bottom: 2px solid #e0e0e0;
        }

        .events-table th,
        .events-table td {
          padding: 12px;
          text-align: left;
          border-bottom: 1px solid #e0e0e0;
          font-size: 14px;
        }

        .events-table th {
          font-weight: 600;
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #666;
        }

        .events-table tbody tr:hover {
          background: #f9f9f9;
        }

        .events-table .col-sn {
          width: 44px;
          text-align: right;
          color: #999;
          font-variant-numeric: tabular-nums;
        }

        .empty-state {
          text-align: center;
          color: #888;
          padding: 32px 12px !important;
        }

        .badge,
        .severity {
          display: inline-block;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
        }

        .mode-shadow { background: #e3f2fd; color: #1976d2; }
        .mode-fix { background: #e8f5e9; color: #388e3c; }
        .mode-warn { background: #fff3e0; color: #f57c00; }

        .action-masked { background: #e8f5e9; color: #388e3c; }
        .action-blocked { background: #ffebee; color: #c62828; }
        .action-reported { background: #fff3e0; color: #e65100; }
        .action-detected { background: #e3f2fd; color: #1976d2; }
        .action-edited { background: #f3e5f5; color: #6a1b9a; }

        .cat-phi { background: #fcebeb; color: #a32d2d; }
        .cat-pii { background: #faeeda; color: #633806; }
        .cat-secret { background: #eeedfe; color: #3c3489; }
        .cat-financial { background: #e1f5ee; color: #085041; }
        .cat-custom { background: #fff3cd; color: #664d03; }

        .severity-critical { background: #ffebee; color: #c62828; }
        .severity-high { background: #fff3e0; color: #e65100; }
        .severity-medium { background: #e8f0fe; color: #1a73e8; }
        .severity-low { background: #e6f4ea; color: #137333; }

        .category-badges {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
        }

        .btn {
          padding: 10px 16px;
          border: 1px solid #e0e0e0;
          border-radius: 6px;
          background: white;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .btn-secondary:hover:not(:disabled) {
          border-color: #4285f4;
          color: #4285f4;
        }

        .btn-link {
          background: transparent;
          border: none;
          color: #4285f4;
          padding: 6px 8px;
        }

        .btn-link:hover {
          text-decoration: underline;
        }

        .pagination-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
          padding: 12px 16px;
          border-top: 1px solid #e0e0e0;
          background: #fafafa;
          flex-wrap: wrap;
        }

        .pagination-info {
          font-size: 13px;
          color: #475569;
        }

        .pagination-controls {
          display: flex;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
        }

        .page-size-label {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          font-size: 13px;
          color: #475569;
          white-space: nowrap;
          flex-shrink: 0;
        }

        .pagination-bar .page-size-label select {
          height: 32px;
          width: 72px;
          min-width: 72px;
          padding: 0 28px 0 10px;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          font-size: 13px;
          background-color: #ffffff !important;
          color: #1f2937 !important;
          cursor: pointer;
          appearance: none;
          -webkit-appearance: none;
          -moz-appearance: none;
          background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='10' height='6' viewBox='0 0 10 6'><path fill='%236b7280' d='M0 0l5 6 5-6z'/></svg>");
          background-repeat: no-repeat;
          background-position: right 10px center;
          background-size: 10px 6px;
        }

        .pagination-bar .page-size-label select option {
          color: #1f2937;
          background-color: #ffffff;
        }

        .page-size-label select:hover {
          border-color: #94a3b8;
        }

        .page-nav {
          display: inline-flex;
          align-items: stretch;
          background: white;
          border: 1px solid #d1d5db;
          border-radius: 6px;
          overflow: hidden;
        }

        .page-btn {
          height: 32px;
          min-width: 36px;
          padding: 0 12px;
          background: white;
          border: none;
          border-right: 1px solid #e5e7eb;
          color: #334155;
          font-size: 13px;
          font-weight: 500;
          line-height: 1;
          cursor: pointer;
          transition: background 0.15s ease, color 0.15s ease;
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }

        .page-btn:last-child {
          border-right: none;
        }

        .page-btn:hover:not(:disabled) {
          background: #eef2ff;
          color: #1d4ed8;
        }

        .page-btn:active:not(:disabled) {
          background: #e0e7ff;
        }

        .page-btn:disabled {
          color: #cbd5e1;
          background: #f8fafc;
          cursor: not-allowed;
        }

        .page-btn:focus-visible {
          outline: 2px solid #6366f1;
          outline-offset: -2px;
          z-index: 1;
        }

        .page-indicator {
          display: inline-flex;
          align-items: center;
          height: 32px;
          padding: 0 12px;
          border-right: 1px solid #e5e7eb;
          background: #f9fafb;
          font-size: 13px;
          color: #475569;
          white-space: nowrap;
        }

        .page-indicator strong {
          color: #1f2937;
          margin: 0 2px;
        }

        .btn-replay {
          background: #ede9fe;
          border-color: #c4b5fd;
          color: #5b21b6;
          padding: 6px 10px;
          font-size: 12px;
          font-weight: 600;
        }

        .btn-replay:hover {
          background: #ddd6fe;
          border-color: #8b5cf6;
        }

        .replay-backdrop {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.55);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 24px;
        }

        .replay-modal {
          background: white;
          width: 100%;
          max-width: 1100px;
          max-height: 90vh;
          overflow-y: auto;
          border-radius: 12px;
          padding: 24px;
          box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
        }

        .replay-header {
          display: flex;
          align-items: flex-start;
          justify-content: space-between;
          gap: 16px;
          margin-bottom: 20px;
          padding-bottom: 16px;
          border-bottom: 1px solid #e0e0e0;
        }

        .replay-header h3 {
          margin: 0 0 4px;
          font-size: 18px;
          font-weight: 600;
        }

        .replay-meta {
          margin: 0;
          font-size: 12px;
          color: #666;
        }

        .replay-meta code {
          background: #f1f5f9;
          padding: 1px 6px;
          border-radius: 3px;
          font-size: 11px;
        }

        .replay-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .replay-pane-title {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          font-size: 12px;
          font-weight: 700;
          color: #5b21b6;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 6px;
        }

        .replay-preview {
          padding: 12px;
          background: #f9f9f9;
          border: 1px solid #e0e0e0;
          border-radius: 6px;
          font-family: monospace;
          font-size: 12px;
          line-height: 1.55;
          max-height: 240px;
          overflow-y: auto;
          white-space: pre-wrap;
          word-break: break-word;
        }

        .replay-toggle {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          font-weight: 500;
          color: #666;
          text-transform: none;
          letter-spacing: normal;
          cursor: pointer;
        }

        .replay-detections {
          list-style: none;
          margin: 0;
          padding: 0;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .replay-detections li {
          display: flex;
          align-items: center;
          gap: 8px;
          font-family: -apple-system, sans-serif;
          font-size: 12px;
        }

        .replay-detections code {
          background: #fff;
          border: 1px solid #e0e0e0;
          padding: 2px 6px;
          border-radius: 3px;
        }

        .replay-cat {
          padding: 2px 6px;
          border-radius: 3px;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
        }

        .replay-tokens {
          margin-top: 8px;
          font-size: 12px;
        }

        .replay-tokens summary {
          cursor: pointer;
          color: #5b21b6;
          font-weight: 600;
        }

        .replay-tokens table {
          width: 100%;
          margin-top: 8px;
          border-collapse: collapse;
        }

        .replay-tokens th,
        .replay-tokens td {
          padding: 6px 8px;
          text-align: left;
          border-bottom: 1px solid #eee;
          font-size: 11px;
        }

        @media (max-width: 760px) {
          .replay-grid { grid-template-columns: 1fr; }
        }
      `}</style>
    </div>
  );
}