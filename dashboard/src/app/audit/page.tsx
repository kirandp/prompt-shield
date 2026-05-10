'use client';

import { useEffect, useState } from 'react';

export default function AuditPage() {
  const [events, setEvents] = useState<any[]>([
    {
      id: 1,
      timestamp: '2024-01-15T14:23:45Z',
      user: 'john@acme.com',
      mode: 'fix',
      count: 3,
      categories: ['PHI', 'PII'],
      severity: 'high',
      action: 'masked',
      aiTool: 'ChatGPT'
    },
    {
      id: 2,
      timestamp: '2024-01-15T13:15:22Z',
      user: 'sarah@acme.com',
      mode: 'warn',
      count: 5,
      categories: ['SECRET'],
      severity: 'critical',
      action: 'blocked',
      aiTool: 'Claude'
    }
  ]);

  const [filters, setFilters] = useState({
    mode: 'all',
    severity: 'all',
    startDate: '',
    endDate: ''
  });

  const handleExportCSV = () => {
    const csv = [
      ['Timestamp', 'User', 'Mode', 'Count', 'Categories', 'Severity', 'Action', 'AI Tool'],
      ...events.map(e => [
        e.timestamp,
        e.user,
        e.mode,
        e.count,
        e.categories.join('; '),
        e.severity,
        e.action,
        e.aiTool
      ])
    ].map(row => row.join(',')).join('\n');

    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `audit_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h2>Audit Log</h2>
          <p>Real-time event tracking and compliance audit trail</p>
        </div>
        <button className="btn btn-secondary" onClick={handleExportCSV}>
          ⬇️ Export CSV
        </button>
      </div>

      {/* Filters */}
      <div className="filters-bar">
        <select
          value={filters.mode}
          onChange={(e) => setFilters({ ...filters, mode: e.target.value })}
        >
          <option value="all">All Modes</option>
          <option value="shadow">Shadow</option>
          <option value="fix">Fix</option>
          <option value="warn">Warn</option>
        </select>

        <select
          value={filters.severity}
          onChange={(e) => setFilters({ ...filters, severity: e.target.value })}
        >
          <option value="all">All Severities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        <input
          type="date"
          value={filters.startDate}
          onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
        />

        <input
          type="date"
          value={filters.endDate}
          onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
        />
      </div>

      {/* Events Table */}
      <div className="section">
        <table className="events-table">
          <thead>
            <tr>
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
            {events.map(event => {
              const date = new Date(event.timestamp);
              const formatted = date.toISOString().replace('T', ' ').substring(0, 19);
              return (
                <tr key={event.id}>
                  <td>{formatted}</td>
                  <td>{event.user}</td>
                  <td>
                    <span className={`badge mode-${event.mode}`}>{event.mode}</span>
                  </td>
                  <td>{event.count}</td>
                  <td>
                    <div className="category-badges">
                      {event.categories.map((cat: string) => (
                        <span key={cat} className={`badge cat-${cat.toLowerCase()}`}>
                          {cat}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td>
                    <span className={`severity severity-${event.severity}`}>
                      {event.severity}
                    </span>
                  </td>
                  <td>{event.action}</td>
                  <td>{event.aiTool}</td>
                </tr>
              );
            })}
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

        .filters-bar {
          display: flex;
          gap: 12px;
          margin-bottom: 24px;
          flex-wrap: wrap;
        }

        .filters-bar select,
        .filters-bar input {
          padding: 10px 12px;
          border: 1px solid #e0e0e0;
          border-radius: 6px;
          font-size: 14px;
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

        .events-table th {
          padding: 12px;
          text-align: left;
          font-weight: 600;
          font-size: 13px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #666;
        }

        .events-table td {
          padding: 12px;
          border-bottom: 1px solid #e0e0e0;
          font-size: 14px;
        }

        .events-table tbody tr:hover {
          background: #f9f9f9;
        }

        .badge {
          display: inline-block;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
        }

        .mode-shadow {
          background: #e3f2fd;
          color: #1976d2;
        }

        .mode-fix {
          background: #e8f5e9;
          color: #388e3c;
        }

        .mode-warn {
          background: #fff3e0;
          color: #f57c00;
        }

        .cat-phi {
          background: #fcebeb;
          color: #a32d2d;
          margin: 0 4px 0 0;
        }

        .cat-pii {
          background: #faeeda;
          color: #633806;
          margin: 0 4px 0 0;
        }

        .cat-secret {
          background: #eeedfe;
          color: #3c3489;
          margin: 0 4px 0 0;
        }

        .severity {
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 600;
          text-transform: uppercase;
        }

        .severity-critical {
          background: #ffebee;
          color: #c62828;
        }

        .severity-high {
          background: #fff3e0;
          color: #e65100;
        }

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

        .btn-secondary:hover {
          border-color: #4285f4;
          color: #4285f4;
        }
      `}</style>
    </div>
  );
}
