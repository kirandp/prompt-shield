'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { supabase, isSupabaseConfigured, fetchAuditStats, fetchOrgRules, getDemoOrgId } from '@/lib/supabase';

export default function DashboardPage() {
    const [detectionData, setDetectionData] = useState<any[]>([]);
    const [modeData, setModeData] = useState<any[]>([]);
    const [trendData, setTrendData] = useState<any[]>([]);
    const [totalDetections, setTotalDetections] = useState(0);
    const [totalMasked, setTotalMasked] = useState(0);
    const [totalBlocked, setTotalBlocked] = useState(0);
    const [rulesCount, setRulesCount] = useState(0);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const loadData = async () => {
            if (!isSupabaseConfigured) {
                setLoading(false);
                return;
            }

            try {
                // Resolve the demo org dynamically — the Shield page stamps rows
                // with this same id, so both pages stay in sync if the seed changes.
                const orgId = await getDemoOrgId();
                if (!orgId) {
                    setLoading(false);
                    return;
                }

                // Fetch audit stats
                const stats = await fetchAuditStats(orgId, 7);
                if (stats) {
                    setTotalDetections(stats.totalDetections);
                    setTotalMasked(stats.totalMasked);
                    setTotalBlocked(stats.totalBlocked);

                    // Build detection data for bar chart
                    const categories = Object.entries(stats.detectionsByCategory).map(([category, count]) => ({
                        category,
                        count: count as number
                    }));
                    setDetectionData(categories.length > 0 ? categories : [{ category: 'No data', count: 0 }]);

                    // Build mode data for bar chart
                    const modes = Object.entries(stats.detectionsByMode).map(([mode, count]) => ({
                        mode: mode.charAt(0).toUpperCase() + mode.slice(1),
                        events: count as number
                    }));
                    setModeData(modes);

                    // Build trend data for line chart
                    const trend = Object.entries(stats.trendByDay)
                        .sort(([dateA], [dateB]) => dateA.localeCompare(dateB))
                        .map(([date, count]) => ({
                            date: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
                            detections: count as number
                        }));
                    setTrendData(trend.length > 0 ? trend : [{ date: 'No data', detections: 0 }]);
                }

                // Fetch rules count
                const rules = await fetchOrgRules(orgId);
                setRulesCount(rules ? rules.length : 0);
            } catch (error) {
                console.error('Error loading dashboard data:', error);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, []);

    return (
        <div className="page">
            <div className="page-header">
                <h2>Analytics Dashboard</h2>
                <p>Compliance metrics and detection trends {!isSupabaseConfigured && '(Demo Mode)'}</p>
            </div>

            {/* Metric Cards */}
            <div className="metrics-grid">
                <div className="metric-card">
                    <div className="metric-label">Total Detections</div>
                    <div className="metric-value">{loading ? '-' : totalDetections}</div>
                    <div className="metric-change">Last 7 days</div>
                </div>
                <div className="metric-card">
                    <div className="metric-label">Items Masked</div>
                    <div className="metric-value">{loading ? '-' : totalMasked}</div>
                    <div className="metric-change">Auto-masked events</div>
                </div>
                <div className="metric-card">
                    <div className="metric-label">Prompts Blocked</div>
                    <div className="metric-value">{loading ? '-' : totalBlocked}</div>
                    <div className="metric-change">High-risk attempts</div>
                </div>
                <div className="metric-card">
                    <div className="metric-label">Custom Rules Active</div>
                    <div className="metric-value">{loading ? '-' : rulesCount}</div>
                    <div className="metric-change">Organization-wide</div>
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
