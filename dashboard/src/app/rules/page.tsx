'use client';

import { useState } from 'react';

export default function RulesPage() {
    const [rules, setRules] = useState<any[]>([
        {
            id: 1,
            name: 'Client substitution',
            type: 'exact',
            match: 'Acme Corporation',
            replacement: 'Sample Corp',
            enabled: true,
            hits: 42,
            isOrgRule: true
        },
        {
            id: 2,
            name: 'SSN masking',
            type: 'regex',
            pattern: '\\d{3}-\\d{2}-\\d{4}',
            replacement: '000-00-0000',
            enabled: true,
            hits: 127,
            isOrgRule: false
        }
    ]);

    const [showForm, setShowForm] = useState(false);
    const [editingRule, setEditingRule] = useState<any>(null);

    const handleAddRule = () => {
        setEditingRule(null);
        setShowForm(true);
    };

    const handleDeleteRule = (id: number) => {
        setRules(rules.filter(r => r.id !== id));
    };

    const handleToggleRule = (id: number) => {
        setRules(rules.map(r =>
            r.id === id ? { ...r, enabled: !r.enabled } : r
        ));
    };

    return (
        <div className="page">
            <div className="page-header">
                <div>
                    <h2>Custom Rules</h2>
                    <p>Define organization-wide and personal masking rules</p>
                </div>
                <button className="btn btn-primary" onClick={handleAddRule}>
                    + Add Rule
                </button>
            </div>

            <div className="rules-container">
                {/* Org Rules Section */}
                <div className="section">
                    <h3>Organization Rules</h3>
                    <div className="rules-list">
                        {rules.filter(r => r.isOrgRule).map(rule => (
                            <div key={rule.id} className="rule-item">
                                <div className="rule-info">
                                    <div className="rule-name">{rule.name}</div>
                                    <div className="rule-details">
                                        <span className="rule-type">{rule.type}</span>
                                        <span className="rule-match">{rule.match || rule.pattern}</span>
                                        <span className="rule-hits">{rule.hits} hits</span>
                                    </div>
                                </div>
                                <div className="rule-actions">
                                    <input
                                        type="checkbox"
                                        checked={rule.enabled}
                                        onChange={() => handleToggleRule(rule.id)}
                                    />
                                    <button className="btn-icon">✎</button>
                                    <button className="btn-icon" onClick={() => handleDeleteRule(rule.id)}>✕</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Personal Rules Section */}
                <div className="section">
                    <h3>Your Personal Rules</h3>
                    <div className="rules-list">
                        {rules.filter(r => !r.isOrgRule).map(rule => (
                            <div key={rule.id} className="rule-item">
                                <div className="rule-info">
                                    <div className="rule-name">{rule.name}</div>
                                    <div className="rule-details">
                                        <span className="rule-type">{rule.type}</span>
                                        <span className="rule-match">{rule.match || rule.pattern}</span>
                                        <span className="rule-hits">{rule.hits} hits</span>
                                    </div>
                                </div>
                                <div className="rule-actions">
                                    <input
                                        type="checkbox"
                                        checked={rule.enabled}
                                        onChange={() => handleToggleRule(rule.id)}
                                    />
                                    <button className="btn-icon">✎</button>
                                    <button className="btn-icon" onClick={() => handleDeleteRule(rule.id)}>✕</button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>

            {showForm && (
                <div className="modal-overlay" onClick={() => setShowForm(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <h3>Add New Rule</h3>
                        <form>
                            <div className="form-group">
                                <label>Rule Name *</label>
                                <input type="text" placeholder="e.g., Client substitution" required />
                            </div>

                            <div className="form-group">
                                <label>Type *</label>
                                <select required>
                                    <option value="exact">Exact Match</option>
                                    <option value="regex">Regex Pattern</option>
                                    <option value="category">Category Override</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Match Value *</label>
                                <input type="text" placeholder="e.g., Acme Corporation" required />
                            </div>

                            <div className="form-group">
                                <label>Replacement *</label>
                                <input type="text" placeholder="e.g., Sample Corp" required />
                            </div>

                            <div className="form-actions">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary">
                                    Create Rule
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            <style jsx>{`
        .page {
          padding: 24px;
          max-width: 1000px;
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

        .rules-container {
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

        .rules-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }

        .rule-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px;
          background: #f9f9f9;
          border-radius: 6px;
          border: 1px solid #e0e0e0;
          transition: all 0.2s;
        }

        .rule-item:hover {
          background: #f5f5f5;
          border-color: #d0d0d0;
        }

        .rule-info {
          flex: 1;
        }

        .rule-name {
          font-weight: 600;
          margin-bottom: 8px;
        }

        .rule-details {
          display: flex;
          gap: 16px;
          font-size: 13px;
          color: #666;
        }

        .rule-type {
          background: #e3f2fd;
          color: #1976d2;
          padding: 2px 6px;
          border-radius: 3px;
        }

        .rule-actions {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .btn-icon {
          background: none;
          border: none;
          cursor: pointer;
          padding: 4px 8px;
          font-size: 14px;
          color: #666;
          transition: color 0.2s;
        }

        .btn-icon:hover {
          color: #333;
        }

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .modal {
          background: white;
          border-radius: 8px;
          padding: 24px;
          width: 90%;
          max-width: 500px;
          box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
        }

        .modal h3 {
          margin: 0 0 20px;
          font-size: 20px;
        }

        .form-group {
          margin-bottom: 16px;
        }

        .form-group label {
          display: block;
          margin-bottom: 6px;
          font-weight: 500;
          font-size: 14px;
        }

        .form-group input,
        .form-group select {
          width: 100%;
          padding: 10px;
          border: 1px solid #e0e0e0;
          border-radius: 6px;
          font-size: 14px;
        }

        .form-actions {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
          margin-top: 20px;
        }

        .btn {
          padding: 10px 16px;
          border: none;
          border-radius: 6px;
          font-weight: 500;
          cursor: pointer;
        }

        .btn-primary {
          background: #4285f4;
          color: white;
        }

        .btn-secondary {
          background: #f5f5f5;
          color: #333;
          border: 1px solid #e0e0e0;
        }
      `}</style>
        </div>
    );
}
