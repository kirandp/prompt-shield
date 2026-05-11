'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase, subscribeToAuditEvents, isSupabaseConfigured } from '@/lib/supabase';
import { DatePickerField } from '@/components/DatePickerField';
import { InfoIcon } from '@/components/InfoIcon';

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
};

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
          'id, timestamp, user_id, mode, event_type, detection_count, categories_found, max_severity, action_taken, ai_tool'
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
            </tr>
          </thead>

          <tbody>
            {loading && events.length === 0 && (
              <tr>
                <td colSpan={9} className="empty-state">Loading audit events…</td>
              </tr>
            )}

            {!loading && events.length === 0 && (
              <tr>
                <td colSpan={9} className="empty-state">
                  No events match the current filters.
                </td>
              </tr>
            )}

            {events.map((event, idx) => (
              <tr key={event.id}>
                <td className="col-sn">{idx + 1}</td>
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
                <td>{event.action_taken ?? '—'}</td>
                <td>{event.ai_tool ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

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
      `}</style>
    </div>
  );
}