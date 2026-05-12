'use client';

import { useEffect, useState } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { supabase, isSupabaseConfigured, fetchAuditStats, fetchOrgRules, getDemoOrgId } from '@/lib/supabase';
import { useTheme } from '@/components/ThemeProvider';
import { AnimatedCounter } from '@/components/ui/AnimatedCounter';
import { motion } from 'framer-motion';
import { ShieldCheck, EyeOff, Ban, BookLock, CheckCircle2, AlertTriangle } from 'lucide-react';

export default function DashboardPage() {
    const [detectionData, setDetectionData] = useState<any[]>([]);
    const [modeData, setModeData] = useState<any[]>([]);
    const [trendData, setTrendData] = useState<any[]>([]);
    const [totalDetections, setTotalDetections] = useState(0);
    const [totalMasked, setTotalMasked] = useState(0);
    const [totalBlocked, setTotalBlocked] = useState(0);
    const [rulesCount, setRulesCount] = useState(0);
    const [loading, setLoading] = useState(true);
    const { theme } = useTheme();
    const isDark = theme === 'futuristic';
    const chartPrimary = isDark ? '#8B5CF6' : '#4285f4';
    const chartSecondary = isDark ? '#22C55E' : '#0f6e56';
    const chartAccent = isDark ? '#38BDF8' : '#4285f4';
    const chartGrid = isDark ? 'rgba(255,255,255,0.06)' : '#e0e0e0';
    const chartText = isDark ? '#94a3b8' : '#666666';

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
                {[
                    { label: 'Total Detections', value: totalDetections, sub: 'Last 7 days', Icon: ShieldCheck, accent: '#8B5CF6' },
                    { label: 'Items Masked', value: totalMasked, sub: 'Auto-masked events', Icon: EyeOff, accent: '#38BDF8' },
                    { label: 'Prompts Blocked', value: totalBlocked, sub: 'High-risk attempts', Icon: Ban, accent: '#EF4444' },
                    { label: 'Custom Rules Active', value: rulesCount, sub: 'Organization-wide', Icon: BookLock, accent: '#22C55E' },
                ].map((m, i) => (
                    <motion.div
                        key={m.label}
                        className="metric-card"
                        initial={{ opacity: 0, y: 12 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.4, delay: i * 0.08, ease: [0.16, 1, 0.3, 1] }}
                    >
                        <div className="metric-card-head">
                            <div className="metric-label">{m.label}</div>
                            <div
                                className="metric-icon"
                                style={isDark ? { color: m.accent, filter: `drop-shadow(0 0 10px ${m.accent}99)` } : { color: m.accent }}
                                aria-hidden="true"
                            >
                                <m.Icon size={18} />
                            </div>
                        </div>
                        <div className="metric-value">
                            {loading ? '—' : <AnimatedCounter value={m.value} />}
                        </div>
                        <div className="metric-change">{m.sub}</div>
                    </motion.div>
                ))}
            </div>

            {/* Charts */}
            <div className="charts-grid">
                <div className="chart-section">
                    <h3>Detections by Data Type</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={detectionData}>
                            <defs>
                                <linearGradient id="barGradPrimary" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={chartPrimary} stopOpacity={1} />
                                    <stop offset="100%" stopColor={chartPrimary} stopOpacity={0.4} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
                            <XAxis dataKey="category" stroke={chartText} />
                            <YAxis stroke={chartText} />
                            <Tooltip
                                contentStyle={
                                    isDark
                                        ? { background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(139,92,246,0.4)', borderRadius: 8, color: '#e2e8f0' }
                                        : undefined
                                }
                            />
                            <Bar dataKey="count" fill="url(#barGradPrimary)" radius={[6, 6, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                <div className="chart-section">
                    <h3>Events by Protection Mode</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <BarChart data={modeData}>
                            <defs>
                                <linearGradient id="barGradSecondary" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="0%" stopColor={chartSecondary} stopOpacity={1} />
                                    <stop offset="100%" stopColor={chartSecondary} stopOpacity={0.4} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
                            <XAxis dataKey="mode" stroke={chartText} />
                            <YAxis stroke={chartText} />
                            <Tooltip
                                contentStyle={
                                    isDark
                                        ? { background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(34,197,94,0.4)', borderRadius: 8, color: '#e2e8f0' }
                                        : undefined
                                }
                            />
                            <Bar dataKey="events" fill="url(#barGradSecondary)" radius={[6, 6, 0, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                </div>

                <div className="chart-section full-width">
                    <h3>Detection Trend (Last 7 Days)</h3>
                    <ResponsiveContainer width="100%" height={300}>
                        <LineChart data={trendData}>
                            <defs>
                                <linearGradient id="lineGrad" x1="0" y1="0" x2="1" y2="0">
                                    <stop offset="0%" stopColor={chartAccent} />
                                    <stop offset="100%" stopColor={chartPrimary} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke={chartGrid} />
                            <XAxis dataKey="date" stroke={chartText} />
                            <YAxis stroke={chartText} />
                            <Tooltip
                                contentStyle={
                                    isDark
                                        ? { background: 'rgba(15,23,42,0.95)', border: '1px solid rgba(56,189,248,0.4)', borderRadius: 8, color: '#e2e8f0' }
                                        : undefined
                                }
                            />
                            <Legend wrapperStyle={isDark ? { color: '#94a3b8' } : undefined} />
                            <Line
                                type="monotone"
                                dataKey="detections"
                                stroke="url(#lineGrad)"
                                strokeWidth={3}
                                dot={{ r: 4, fill: chartAccent, strokeWidth: 0 }}
                                activeDot={{ r: 6, fill: chartAccent, stroke: '#ffffff', strokeWidth: 2 }}
                            />
                        </LineChart>
                    </ResponsiveContainer>
                </div>
            </div>

            {/* Compliance Status */}
            <div className="section">
                <h3>Compliance Status</h3>
                <div className="compliance-grid">
                    {[
                        { name: 'HIPAA', info: 'All PHI detected and masked', status: 'compliant' as const },
                        { name: 'GDPR', info: 'All PII audit trail logged', status: 'compliant' as const },
                        { name: 'PCI-DSS', info: 'Payment data protection active', status: 'compliant' as const },
                        { name: 'SOC 2', info: 'Generate compliance report', status: 'warning' as const },
                    ].map((c, i) => (
                        <motion.div
                            key={c.name}
                            className={`compliance-card status-${c.status}`}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.35, delay: 0.15 + i * 0.07, ease: [0.16, 1, 0.3, 1] }}
                        >
                            <div className="status-icon" aria-hidden="true">
                                {c.status === 'compliant' ? <CheckCircle2 size={26} /> : <AlertTriangle size={26} />}
                            </div>
                            <div className="status-name">{c.name}</div>
                            <div className="status-info">{c.info}</div>
                        </motion.div>
                    ))}
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

        .metric-card-head {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          margin-bottom: 8px;
        }

        .metric-icon {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 32px;
          height: 32px;
          border-radius: 10px;
          background: rgba(139, 92, 246, 0.08);
        }

        .metric-label {
          font-size: 12px;
          color: #666;
          text-transform: uppercase;
          letter-spacing: 0.05em;
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
