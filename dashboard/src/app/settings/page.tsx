'use client';

import { useState } from 'react';
import { InfoIcon } from '@/components/InfoIcon';

export default function SettingsPage() {
    const [settings, setSettings] = useState({
        policyProfile: 'hipaa',
        alertOnCritical: true,
        dailyDigest: true,
        slackWebhook: '',
        siemEndpoint: ''
    });

    const handleSave = () => {
        // TODO: Save settings to Supabase
        alert('Settings saved!');
    };

    return (
        <div className="page">
            <div className="page-header">
                <h2>Settings</h2>
                <p>Configure policies, rules, and notifications</p>
            </div>

            <div className="settings-container">
                {/* Policy Settings */}
                <div className="section">
                    <h3>
                        Default Policy Profile{' '}
                        <InfoIcon label="About policy profiles">
                            <strong>Policy profiles</strong> are presets of detection rules tuned for a regulation:
                            <ul>
                                <li><strong>HIPAA</strong> — patient names, MRN, diagnoses, SSN</li>
                                <li><strong>GDPR</strong> — names, emails, addresses, EU IDs</li>
                                <li><strong>PCI-DSS</strong> — card numbers, CVVs, expiry</li>
                                <li><strong>Strict</strong> — all of the above plus secrets and corporate data</li>
                            </ul>
                        </InfoIcon>
                    </h3>
                    <select
                        value={settings.policyProfile}
                        onChange={(e) => setSettings({ ...settings, policyProfile: e.target.value })}
                    >
                        <option value="hipaa">HIPAA (Healthcare)</option>
                        <option value="gdpr">GDPR (EU Privacy)</option>
                        <option value="pci">PCI-DSS (Payments)</option>
                        <option value="strict">Strict (All Categories)</option>
                    </select>
                    <p className="setting-description">
                        Choose the default detection policy for all users
                    </p>
                </div>

                {/* Alert Settings */}
                <div className="section">
                    <h3>Alert Preferences</h3>
                    <div className="checkbox-group">
                        <label>
                            <input
                                type="checkbox"
                                checked={settings.alertOnCritical}
                                onChange={(e) => setSettings({ ...settings, alertOnCritical: e.target.checked })}
                            />
                            Alert on critical detections
                        </label>
                        <label>
                            <input
                                type="checkbox"
                                checked={settings.dailyDigest}
                                onChange={(e) => setSettings({ ...settings, dailyDigest: e.target.checked })}
                            />
                            Send daily activity digest
                        </label>
                    </div>
                </div>

                {/* Integration Settings */}
                <div className="section">
                    <h3>Slack Integration</h3>
                    <input
                        type="text"
                        placeholder="https://hooks.slack.com/services/YOUR/WEBHOOK/URL"
                        value={settings.slackWebhook}
                        onChange={(e) => setSettings({ ...settings, slackWebhook: e.target.value })}
                    />
                    <button className="btn btn-secondary">Test Webhook</button>
                    <p className="setting-description">
                        Receive alerts in Slack for high-severity detections
                    </p>
                </div>

                <div className="section">
                    <h3>SIEM Integration</h3>
                    <select>
                        <option value="">Select SIEM platform...</option>
                        <option value="splunk">Splunk</option>
                        <option value="datadog">Datadog</option>
                        <option value="sentinel">Azure Sentinel</option>
                        <option value="elastic">Elastic Stack</option>
                    </select>
                    <input
                        type="text"
                        placeholder="https://your-siem.com/api/endpoint"
                        value={settings.siemEndpoint}
                        onChange={(e) => setSettings({ ...settings, siemEndpoint: e.target.value })}
                    />
                    <button className="btn btn-secondary">Configure</button>
                    <p className="setting-description">
                        Forward audit events to your SIEM platform
                    </p>
                </div>

                {/* Save Button */}
                <div className="action-buttons">
                    <button className="btn btn-primary" onClick={handleSave}>
                        Save Settings
                    </button>
                </div>
            </div>

            <style jsx>{`
        .page {
          padding: 24px;
          max-width: 600px;
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

        .settings-container {
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

        .section input,
        .section select {
          width: 100%;
          padding: 10px;
          border: 1px solid #e0e0e0;
          border-radius: 6px;
          font-size: 14px;
          margin-bottom: 12px;
        }

        .section input:focus,
        .section select:focus {
          outline: none;
          border-color: #4285f4;
          box-shadow: 0 0 0 3px rgba(66, 133, 244, 0.1);
        }

        .checkbox-group {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .checkbox-group label {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
        }

        .checkbox-group input {
          width: auto;
          margin: 0;
        }

        .setting-description {
          margin: 8px 0 0;
          font-size: 12px;
          color: #666;
        }

        .btn {
          padding: 10px 16px;
          border: none;
          border-radius: 6px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-secondary {
          background: #f5f5f5;
          border: 1px solid #e0e0e0;
          color: #333;
        }

        .btn-secondary:hover {
          border-color: #4285f4;
          color: #4285f4;
        }

        .btn-primary {
          background: #4285f4;
          color: white;
        }

        .btn-primary:hover {
          background: #3367d6;
        }

        .action-buttons {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
          margin-top: 16px;
        }
      `}</style>
        </div>
    );
}
