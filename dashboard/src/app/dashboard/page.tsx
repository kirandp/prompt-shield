'use client';

import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

const detectionData = [
    { category: 'PHI', count: 42 },
    { category: 'PII', count: 67 },
    { category: 'Secrets', count: 23 },
    { category: 'Financial', count: 15 }
];

const modeData = [
    { mode: 'Shadow', events: 120 },
    { mode: 'Fix', events: 89 },
    { mode: 'Warn', events: 54 }
];

const trendData = [
    { date: 'Jan 1', detections: 12 },
    { date: 'Jan 2', detections: 19 },
    { date: 'Jan 3', detections: 15 },
    { date: 'Jan 4', detections: 28 },
    { date: 'Jan 5', detections: 25 },
    { date: 'Jan 6', detections: 32 },
    { date: 'Jan 7', detections: 18 }
];

export default function DashboardPage() {
    return (
        <div className="page">
            <div className="page-header">
                <h2>Analytics Dashboard</h2>
                <p>Compliance metrics and detection trends</p>
            </div>

            {/* Metric Cards */}
            <div className="metrics-grid">
                <div className="metric-card">
                    <div className="metric-label">Total Detections</div>
                    <div className="metric-value">147</div>
                    <div className="metric-change">+12% this week</div>
                </div>
                <div className="metric-card">
                    <div className="metric-label">Items Masked</div>
                    <div className="metric-value">89</div>
                    <div className="metric-change">+8% this week</div>
                </div>
                <div className="metric-card">
                    <div className="metric-label">Prompts Blocked</div>
                    <div className="metric-value">23</div>
                    <div className="metric-change">High-risk attempts</div>
                </div>
                <div className="metric-card">
                    <div className="metric-label">Custom Rules Active</div>
                    <div className="metric-value">12</div>
                    <div className="metric-change">3 org-wide</div>
                </div>
            </div>

            {/* Charts */}
            <div className="charts-grid">
                <div className="chart-section">
                    <h3>Detections by Data Type</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={detectionData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="category" />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey="count" fill="#4285f4" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                <div className="chart-section">
                    <h3>Events by Protection Mode</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={modeData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="mode" />
                            <YAxis />
                            <Tooltip />
                            <Bar dataKey="events" fill="#0f6e56" />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                <div className="chart-section full-width">
                    <h3>Detection Trend (Last 7 Days)</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={trendData}>
                            <CartesianGrid strokeDasharray="3 3" />
                            <XAxis dataKey="date" />
                            <YAxis />
                            <Tooltip />
                            <Legend />
                            <Line type="monotone" dataKey="detections" stroke="#4285f4" strokeWidth={2} />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Compliance Status */}
            <div className="section">
                <h3>Compliance Status</h3>
                <div className="compliance-grid">
                    <div className="compliance-card status-compliant">
                        <div className="status-icon">✓</div>
                        <div className="status-name">HIPAA</div>
                        <div className="status-info">All PHI detected and masked</div>
                    </div>
                    <div className="compliance-card status-compliant">
                        <div className="status-icon">✓</div>
                        <div className="status-name">GDPR</div>
                        <div className="status-info">All PII audit trail logged</div>
                    </div>
                    <div className="compliance-card status-compliant">
                        <div className="status-icon">✓</div>
                        <div className="status-name">PCI-DSS</div>
                        <div className="status-info">Payment data protection active</div>
                    </div>
                    <div className="compliance-card status-warning">
                        <div className="status-icon">!</div>
                        <div className="status-name">SOC 2</div>
                        <div className="status-info">Generate compliance report</div>
                    </div>
                </div>
            </div>

            <style jsx>{`
        .page {
          padding: 24px;
          max-width: 1400px;
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

        .metrics-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 16px;
          margin-bottom: 32px;
        }

        .metric-card {
          background: white;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          padding: 20px;
          transition: all 0.2s;
        }

        .metric-card:hover {
          border-color: #4285f4;
          box-shadow: 0 4px 12px rgba(66, 133, 244, 0.1);
        }

        .metric-label {
          font-size: 12px;
          color: #666;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 8px;
        }

        .metric-value {
          font-size: 32px;
          font-weight: 600;
          margin-bottom: 8px;
        }

        .metric-change {
          font-size: 12px;
          color: #0f6e56;
        }

        .charts-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(400px, 1fr));
          gap: 24px;
          margin-bottom: 32px;
        }

        .chart-section {
          background: white;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          padding: 20px;
        }

        .chart-section.full-width {
          grid-column: 1 / -1;
        }

        .chart-section h3 {
          margin: 0 0 16px;
          font-size: 16px;
          font-weight: 600;
        }

        .section {
          background: white;
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          padding: 20px;
          margin-bottom: 24px;
        }

        .section h3 {
          margin: 0 0 16px;
          font-size: 16px;
          font-weight: 600;
        }

        .compliance-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 16px;
        }

        .compliance-card {
          border: 1px solid #e0e0e0;
          border-radius: 8px;
          padding: 16px;
          text-align: center;
          transition: all 0.2s;
        }

        .compliance-card.status-compliant {
          background: #e8f5e9;
          border-color: #0f6e56;
        }

        .compliance-card.status-warning {
          background: #fff3e0;
          border-color: #f57c00;
        }

        .status-icon {
          font-size: 32px;
          margin-bottom: 8px;
        }

        .status-name {
          font-weight: 600;
          font-size: 16px;
          margin-bottom: 4px;
        }

        .status-info {
          font-size: 12px;
          color: #666;
        }
      `}</style>
        </div>
    );
}
