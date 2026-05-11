'use client';

import { useEffect, useState } from 'react';
import { supabase, isSupabaseConfigured, fetchOrgRules, createOrgRule, updateOrgRule, deleteOrgRule, subscribeToRules, getDemoOrgId } from '@/lib/supabase';

export default function RulesPage() {
    const [rules, setRules] = useState<any[]>([]);
    const [showForm, setShowForm] = useState(false);
    const [editingRule, setEditingRule] = useState<any>(null);
    const [formData, setFormData] = useState({ name: '', type: 'exact', match: '', replacement: '' });
    const [loading, setLoading] = useState(true);
    const [orgId, setOrgId] = useState<string | null>(null);

    // Load rules on mount
    useEffect(() => {
        let cancelled = false;
        let unsubscribe: (() => void) | null = null;

        const loadRules = async (resolvedOrgId: string) => {
            try {
                const data = await fetchOrgRules(resolvedOrgId);
                if (cancelled) return;
                if (data) {
                    setRules(data.map((rule: any) => ({
                        id: rule.id,
                        name: rule.name,
                        type: rule.rule_type,
                        match: rule.match_pattern,
                        replacement: rule.replacement,
                        enabled: rule.enabled,
                        hits: rule.hit_count || 0,
                        isOrgRule: true
                    })));
                }
            } catch (error) {
                console.error('Error loading rules:', error);
            } finally {
                if (!cancelled) setLoading(false);
            }
        };

        (async () => {
            if (!isSupabaseConfigured) {
                setLoading(false);
                return;
            }

            const resolved = await getDemoOrgId();
            if (cancelled) return;
            if (!resolved) {
                console.error('Could not resolve demo org id — did you run seed-demo-data.sql?');
                setLoading(false);
                return;
            }
            setOrgId(resolved);
            await loadRules(resolved);

            unsubscribe = subscribeToRules(() => {
                loadRules(resolved);
            });
        })();

        return () => {
            cancelled = true;
            unsubscribe?.();
        };
    }, []);

    const handleAddRule = () => {
        setEditingRule(null);
        setFormData({ name: '', type: 'exact', match: '', replacement: '' });
        setShowForm(true);
    };

    const handleEditRule = (rule: any) => {
        setEditingRule(rule);
        setFormData({
            name: rule.name,
            type: rule.type,
            match: rule.match || '',
            replacement: rule.replacement
        });
        setShowForm(true);
    };

    const handleDeleteRule = async (id: number) => {
        if (!confirm('Are you sure you want to delete this rule?')) return;
        if (!isSupabaseConfigured) return;

        try {
            await deleteOrgRule(id);
            setRules(rules.filter(r => r.id !== id));
        } catch (error: any) {
            console.error('Error deleting rule:', error);
            alert(`Failed to delete rule: ${error?.message ?? 'unknown error'}`);
        }
    };

    const handleToggleRule = async (id: number) => {
        const rule = rules.find(r => r.id === id);
        if (!rule || !isSupabaseConfigured) return;

        try {
            await updateOrgRule(id, { enabled: !rule.enabled });
            setRules(rules.map(r =>
                r.id === id ? { ...r, enabled: !r.enabled } : r
            ));
        } catch (error: any) {
            console.error('Error toggling rule:', error);
            alert(`Failed to toggle rule: ${error?.message ?? 'unknown error'}`);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.name || !formData.match || !formData.replacement) {
            alert('Please fill in all fields');
            return;
        }

        if (!isSupabaseConfigured) {
            alert('Supabase is not configured — set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.');
            return;
        }

        if (!orgId) {
            alert('Demo org not found — run supabase/seed-demo-data.sql against your Supabase project.');
            return;
        }

        try {
            if (editingRule) {
                await updateOrgRule(editingRule.id, {
                    name: formData.name,
                    rule_type: formData.type,
                    match_pattern: formData.match,
                    replacement: formData.replacement
                });
            } else {
                await createOrgRule(orgId, {
                    name: formData.name,
                    type: formData.type,
                    match: formData.match,
                    replacement: formData.replacement
                });
            }
            setShowForm(false);
            const updatedRules = await fetchOrgRules(orgId);
            if (updatedRules) {
                setRules(updatedRules.map((rule: any) => ({
                    id: rule.id,
                    name: rule.name,
                    type: rule.rule_type,
                    match: rule.match_pattern,
                    replacement: rule.replacement,
                    enabled: rule.enabled,
                    hits: rule.hit_count || 0,
                    isOrgRule: true
                })));
            }
        } catch (error: any) {
            console.error('Error saving rule:', error);
            alert(`Failed to save rule: ${error?.message ?? 'unknown error'}`);
        }
    };

    return (
        <div className="page">
            <div className="page-header">
                <div>
                    <h2>Custom Rules</h2>
                    <p>Define organization-wide masking rules {!isSupabaseConfigured && '(Demo Mode)'}</p>
                </div>
                <button className="btn btn-primary" onClick={handleAddRule}>
                    + Add Rule
                </button>
            </div>

            <div className="rules-container">
                {/* Org Rules Section */}
                <div className="section">
                    <h3>Organization Rules {loading && <span style={{fontSize: '12px', color: '#666'}}>(Loading...)</span>}</h3>
                    <div className="rules-list">
                        {rules.length === 0 ? (
                            <div style={{padding: '20px', textAlign: 'center', color: '#666'}}>
                                {loading ? 'Loading rules...' : 'No rules configured yet. Add one to get started!'}
                            </div>
                        ) : (
                            rules.map(rule => (
                                <div key={rule.id} className="rule-item">
                                    <div className="rule-info">
                                        <div className="rule-name">{rule.name}</div>
                                        <div className="rule-details">
                                            <span className="rule-type">{rule.type}</span>
                                            <span className="rule-match">{rule.match}</span>
                                            <span className="rule-hits">{rule.hits} hits</span>
                                        </div>
                                    </div>
                                    <div className="rule-actions">
                                        <input
                                            type="checkbox"
                                            checked={rule.enabled}
                                            onChange={() => handleToggleRule(rule.id)}
                                        />
                                        <button className="btn-icon" onClick={() => handleEditRule(rule)}>✎</button>
                                        <button className="btn-icon" onClick={() => handleDeleteRule(rule.id)}>✕</button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {showForm && (
                <div className="modal-overlay" onClick={() => setShowForm(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <h3>{editingRule ? 'Edit Rule' : 'Add New Rule'}</h3>
                        <form onSubmit={handleSubmit}>
                            <div className="form-group">
                                <label>Rule Name *</label>
                                <input
                                    type="text"
                                    placeholder="e.g., Client substitution"
                                    value={formData.name}
                                    onChange={(e) => setFormData({...formData, name: e.target.value})}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label>Type *</label>
                                <select
                                    value={formData.type}
                                    onChange={(e) => setFormData({...formData, type: e.target.value})}
                                    required
                                >
                                    <option value="exact">Exact Match</option>
                                    <option value="regex">Regex Pattern</option>
                                    <option value="category">Category Override</option>
                                </select>
                            </div>

                            <div className="form-group">
                                <label>Match Value *</label>
                                <input
                                    type="text"
                                    placeholder="e.g., Acme Corporation"
                                    value={formData.match}
                                    onChange={(e) => setFormData({...formData, match: e.target.value})}
                                    required
                                />
                            </div>

                            <div className="form-group">
                                <label>Replacement *</label>
                                <input
                                    type="text"
                                    placeholder="e.g., Sample Corp"
                                    value={formData.replacement}
                                    onChange={(e) => setFormData({...formData, replacement: e.target.value})}
                                    required
                                />
                            </div>

                            <div className="form-actions">
                                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>
                                    Cancel
                                </button>
                                <button type="submit" className="btn btn-primary">
                                    {editingRule ? 'Update Rule' : 'Create Rule'}
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
