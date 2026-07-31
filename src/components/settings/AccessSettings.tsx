'use client';

import { FormEvent, useEffect, useState } from 'react';
import { Button, Input } from '@/components/ui';

interface AccessAccount {
  id: string;
  email: string;
  name: string | null;
  role: 'ADMIN' | 'USER';
  isActive: boolean;
}

export function AccessSettings() {
  const [accounts, setAccounts] = useState<AccessAccount[]>([]);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadAccounts = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/accounts', { cache: 'no-store' });
      if (!response.ok) throw new Error(`Account list failed (${response.status})`);
      const payload = await response.json() as { accounts: AccessAccount[] };
      setAccounts(payload.accounts);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Account list failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAccounts();
  }, []);

  const addAccount = async (event: FormEvent) => {
    event.preventDefault();
    if (!email.trim() || saving) return;
    setSaving(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, name }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Account creation failed');
      setEmail('');
      setName('');
      await loadAccounts();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Account creation failed');
    } finally {
      setSaving(false);
    }
  };

  const setAccountActive = async (account: AccessAccount, isActive: boolean) => {
    setError(null);
    setAccounts((current) => current.map((item) => item.id === account.id ? { ...item, isActive } : item));
    try {
      const response = await fetch('/api/admin/accounts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: account.id, isActive }),
      });
      const payload = await response.json() as { error?: string };
      if (!response.ok) throw new Error(payload.error || 'Account update failed');
    } catch (cause) {
      setAccounts((current) => current.map((item) => item.id === account.id ? { ...item, isActive: account.isActive } : item));
      setError(cause instanceof Error ? cause.message : 'Account update failed');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-sm font-medium uppercase tracking-wider text-[var(--accent-primary)]">Platform Access</h3>
        <p className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">Only active accounts can sign in. New accounts are always created with the User role; the platform administrator cannot be disabled.</p>
      </div>

      <form onSubmit={addAccount} className="grid gap-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-secondary)]/40 p-4 sm:grid-cols-2">
        <Input label="Email" type="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="person@example.com" />
        <Input label="Name (optional)" value={name} onChange={(event) => setName(event.target.value)} placeholder="Display name" />
        <Button type="submit" variant="primary" disabled={saving || !email.trim()} isLoading={saving} className="sm:col-span-2">Add or reactivate account</Button>
      </form>

      {error && <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-xs text-red-700">{error}</div>}

      <div className="space-y-2">
        {loading ? <div className="p-4 text-sm text-[var(--text-tertiary)]">Loading accounts...</div> : accounts.map((account) => {
          const admin = account.role === 'ADMIN';
          return (
            <div key={account.id} className="flex items-center gap-3 rounded-xl border border-[var(--border-color)] bg-[var(--bg-primary)] p-3 shadow-sm">
              <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${admin ? 'bg-[var(--accent-primary)] text-white' : 'bg-[var(--bg-tertiary)] text-[var(--text-secondary)]'}`}>
                {(account.name || account.email).slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-medium text-[var(--text-primary)]">{account.email}</div>
                <div className="mt-0.5 text-[10px] uppercase tracking-wider text-[var(--text-tertiary)]">{admin ? 'Administrator' : 'User'}{account.name ? ` · ${account.name}` : ''}</div>
              </div>
              <label className={`flex items-center gap-2 text-xs ${admin ? 'cursor-not-allowed opacity-60' : 'cursor-pointer'} text-[var(--text-secondary)]`}>
                <input
                  type="checkbox"
                  checked={account.isActive}
                  disabled={admin}
                  onChange={(event) => setAccountActive(account, event.target.checked)}
                  className="h-4 w-4 rounded border-[var(--border-color)] text-[var(--accent-primary)] focus:ring-[var(--accent-focus-ring)]"
                />
                Active
              </label>
            </div>
          );
        })}
      </div>
    </div>
  );
}
