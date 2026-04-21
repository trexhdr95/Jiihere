import { useCallback, useEffect, useState } from 'react';
import { useAuth } from '@/data/authContext';
import {
  createInvite,
  listInvites,
  listProfiles,
  revokeInvite,
  type Invite,
  type Profile,
} from '@/data/profileService';
import { reportError } from '@/lib/errors';
import { Button } from '@/ui/primitives/Button';
import { Input } from '@/ui/primitives/Input';
import { EmptyState } from '@/ui/primitives/EmptyState';

/**
 * Admin-only page. Gated by the AdminRoute wrapper in App.tsx — if a
 * non-admin navigates here we redirect them to /. Purpose: invite new
 * teachers to the platform + see who's already in.
 */
export function AdminPage() {
  const { user } = useAuth();
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [emailInput, setEmailInput] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const [ps, ivs] = await Promise.all([listProfiles(), listInvites()]);
      setProfiles(ps);
      setInvites(ivs);
    } catch (err) {
      setError(reportError(err, 'AdminPage'));
    }
  }, []);

  useEffect(() => {
    (async () => {
      await refresh();
      setLoading(false);
    })();
  }, [refresh]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await createInvite(emailInput, user.id);
      setEmailInput('');
      setNotice(`Invited ${emailInput.trim().toLowerCase()}.`);
      await refresh();
    } catch (err) {
      setError(reportError(err, 'AdminPage.invite'));
    } finally {
      setBusy(false);
    }
  };

  const handleRevoke = async (invite: Invite) => {
    if (!confirm(`Revoke invite for ${invite.email}?`)) return;
    setBusy(true);
    setError(null);
    try {
      await revokeInvite(invite.id);
      setNotice(`Revoked invite for ${invite.email}.`);
      await refresh();
    } catch (err) {
      setError(reportError(err, 'AdminPage.revoke'));
    } finally {
      setBusy(false);
    }
  };

  const pending = invites.filter((i) => !i.accepted);
  const accepted = invites.filter((i) => i.accepted);

  return (
    <div>
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Admin</h1>
        <p className="mt-1 text-sm text-slate-600">
          Invite teachers to the platform. Only admins see this page.
        </p>
      </div>

      {error && (
        <div className="mt-4 rounded-md border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}
      {notice && !error && (
        <div className="mt-4 rounded-md border border-brand-300 bg-brand-50 px-3 py-2 text-sm text-brand-800">
          {notice}
        </div>
      )}

      {/* Invite form */}
      <section className="mt-6 rounded-lg border border-slate-200 bg-white p-4">
        <div className="text-sm font-semibold">Invite a new user</div>
        <div className="text-xs text-slate-500 mt-0.5 mb-3">
          Enter the exact email on the Google account they'll sign in with.
        </div>
        <form onSubmit={(e) => void handleInvite(e)} className="flex gap-2 flex-wrap items-end">
          <div className="flex-1 min-w-[14rem]">
            <Input
              label="Email"
              type="email"
              placeholder="teacher@example.com"
              value={emailInput}
              onChange={(e) => setEmailInput(e.target.value)}
              autoComplete="email"
            />
          </div>
          <Button type="submit" disabled={busy || !emailInput.trim()}>
            Send invite
          </Button>
        </form>
      </section>

      {/* Active users */}
      <section className="mt-6">
        <div className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-2">
          Active users ({profiles.length})
        </div>
        {loading ? (
          <div className="rounded-lg border border-slate-200 p-6 text-sm text-slate-500">
            Loading…
          </div>
        ) : profiles.length === 0 ? (
          <EmptyState
            title="No users yet"
            description="Once invited users sign in with Google, they'll show up here."
          />
        ) : (
          <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
            {profiles.map((p) => (
              <li key={p.userId} className="px-4 py-2.5 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-900 truncate">{p.email}</div>
                  <div className="text-[11px] text-slate-500">
                    Joined {new Date(p.createdAt).toLocaleDateString()}
                  </div>
                </div>
                {p.isAdmin && (
                  <span className="inline-flex items-center rounded-full bg-accent-100 text-accent-800 ring-1 ring-accent-300 px-2 py-0.5 text-[11px] font-medium shrink-0">
                    Admin
                  </span>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Pending invites */}
      <section className="mt-6">
        <div className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-2">
          Pending invites ({pending.length})
        </div>
        {pending.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 p-4 text-center text-sm text-slate-500">
            No pending invites.
          </div>
        ) : (
          <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
            {pending.map((inv) => (
              <li key={inv.id} className="px-4 py-2.5 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-sm font-medium text-slate-900 truncate">{inv.email}</div>
                  <div className="text-[11px] text-slate-500">
                    Invited {new Date(inv.invitedAt).toLocaleDateString()}
                  </div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => void handleRevoke(inv)}>
                  Revoke
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Accepted invites (historical) */}
      {accepted.length > 0 && (
        <section className="mt-6">
          <div className="text-xs font-medium uppercase tracking-wide text-slate-500 mb-2">
            Accepted invites ({accepted.length})
          </div>
          <ul className="divide-y divide-slate-200 rounded-lg border border-slate-200 bg-white">
            {accepted.map((inv) => (
              <li key={inv.id} className="px-4 py-2 text-sm flex items-center justify-between gap-2">
                <span className="truncate text-slate-700">{inv.email}</span>
                <span className="text-[11px] text-slate-500 shrink-0">
                  Accepted {inv.acceptedAt ? new Date(inv.acceptedAt).toLocaleDateString() : '—'}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
