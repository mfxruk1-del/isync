import { useEffect, useState } from 'react';
import { api, type Invite, type Member } from './api';
import { useBackToClose } from './useBackToClose';

function formatDate(ms: number) {
  return new Date(ms).toLocaleDateString(undefined, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export default function AdminPanel({ onClose }: { onClose: () => void }) {
  useBackToClose(onClose);
  const [members, setMembers] = useState<Member[]>([]);
  const [invites, setInvites] = useState<Invite[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [creating, setCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  async function load() {
    const [m, i] = await Promise.all([api.listMembers(), api.listInvites()]);
    setMembers(m.users);
    setInvites(i.invites);
  }

  useEffect(() => {
    load()
      .catch((e) => setError((e as Error).message))
      .finally(() => setLoading(false));
  }, []);

  async function createInvite() {
    setCreating(true);
    setError('');
    try {
      await api.createInvite();
      await load();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setCreating(false);
    }
  }

  async function copy(invite: Invite) {
    const url = `${window.location.origin}${invite.path}`;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(invite.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      /* ignore */
    }
  }

  async function revoke(invite: Invite) {
    if (!confirm('Revoke this unused invite?')) return;
    try {
      await api.revokeInvite(invite.id);
      setInvites((prev) => prev.filter((i) => i.id !== invite.id));
    } catch (e) {
      setError((e as Error).message);
    }
  }

  const pending = invites.filter((i) => !i.used);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-lg animate-pop flex-col rounded-2xl border border-white/10 bg-panel shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-white/10 p-4">
          <h2 className="text-lg font-semibold">People</h2>
          <button onClick={onClose} className="rounded-lg px-3 py-1.5 text-slate-300 hover:bg-white/10">
            ✕
          </button>
        </div>

        <div className="flex-1 space-y-6 overflow-y-auto p-4">
          {error && <p className="text-sm text-rose-400">{error}</p>}

          {/* Invite section */}
          <section>
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-medium text-slate-300">Invite someone</h3>
              <button
                onClick={createInvite}
                disabled={creating}
                className="rounded-lg bg-emerald-500 px-3 py-1.5 text-sm font-medium text-emerald-950 hover:bg-emerald-400 disabled:opacity-50"
              >
                {creating ? 'Creating…' : '+ New invite link'}
              </button>
            </div>
            <p className="mb-3 text-xs text-slate-500">
              Send an invite link to a family member or friend. They pick their own
              username &amp; password and get their own private library.
            </p>
            {loading ? (
              <p className="text-sm text-slate-400">Loading…</p>
            ) : pending.length === 0 ? (
              <p className="text-sm text-slate-500">No unused invites.</p>
            ) : (
              <ul className="space-y-2">
                {pending.map((i) => (
                  <li
                    key={i.id}
                    className="flex items-center justify-between gap-2 rounded-lg border border-white/10 bg-black/20 p-2"
                  >
                    <span className="truncate text-xs text-slate-400">
                      {window.location.origin}
                      {i.path}
                    </span>
                    <div className="flex shrink-0 gap-1">
                      <button
                        onClick={() => copy(i)}
                        className="rounded-lg border border-white/10 px-2.5 py-1 text-xs hover:bg-white/5"
                      >
                        {copiedId === i.id ? 'Copied!' : 'Copy'}
                      </button>
                      <button
                        onClick={() => revoke(i)}
                        className="rounded-lg border border-rose-500/40 px-2.5 py-1 text-xs text-rose-300 hover:bg-rose-500/10"
                      >
                        Revoke
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* Members section */}
          <section>
            <h3 className="mb-2 text-sm font-medium text-slate-300">Members</h3>
            {loading ? (
              <p className="text-sm text-slate-400">Loading…</p>
            ) : (
              <ul className="space-y-2">
                {members.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center justify-between rounded-lg border border-white/10 bg-black/20 p-3"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm">
                        {m.username}
                        {m.isAdmin && <span className="ml-2 text-xs text-emerald-400">admin</span>}
                      </p>
                      <p className="text-xs text-slate-500">
                        {m.fileCount} item{m.fileCount === 1 ? '' : 's'} · joined {formatDate(m.createdAt)}
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}
