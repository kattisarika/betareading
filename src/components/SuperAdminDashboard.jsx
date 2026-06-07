import { useEffect, useState } from 'react';
import { adminApi, flagCategoryList } from '../api';

const TABS = [
  { id: 'stats', label: 'Stats', icon: '📊' },
  { id: 'users', label: 'Users', icon: '👥' },
  { id: 'books', label: 'Books', icon: '📚' },
  { id: 'pings', label: 'Assignments', icon: '🔗' },
  { id: 'messages', label: 'Messages', icon: '💬' },
  { id: 'reviews', label: 'Reviews', icon: '⭐' },
  { id: 'group-chats', label: 'Group Chats', icon: '👥' },
  { id: 'admin-messages', label: 'Sent', icon: '✉️' },
];

function fmtDate(d) {
  if (!d) return '';
  try { return new Date(d).toLocaleString(); } catch { return String(d); }
}

export default function SuperAdminDashboard({ adminUser, adminUserId, onLogout }) {
  const [tab, setTab] = useState('stats');
  return (
    <div className="app-shell">
      <div className="container container-wide">
        <div className="dashboard">
          <div className="dashboard-header">
            <h1 className="dashboard-title">🛡️ Super Admin</h1>
            <button className="btn-ghost" onClick={onLogout}>Logout</button>
          </div>
          <p className="welcome">Signed in as {adminUser?.name || adminUser?.email}</p>
          <nav className="tabs">
            {TABS.map((t) => (
              <button
                key={t.id}
                className={`tab ${tab === t.id ? 'tab-active' : ''}`}
                onClick={() => setTab(t.id)}
              >
                <span className="tab-icon">{t.icon}</span> {t.label}
              </button>
            ))}
          </nav>
          <AdminPanel tab={tab} adminUserId={adminUserId} />
        </div>
      </div>
    </div>
  );
}

function AdminPanel({ tab, adminUserId }) {
  if (tab === 'stats') return <StatsPanel adminUserId={adminUserId} />;
  if (tab === 'users') return <UsersPanel adminUserId={adminUserId} />;
  if (tab === 'books') return <BooksPanel adminUserId={adminUserId} />;
  if (tab === 'pings') return <PingsPanel adminUserId={adminUserId} />;
  if (tab === 'messages') return <MessagesPanel adminUserId={adminUserId} />;
  if (tab === 'reviews') return <ReviewsPanel adminUserId={adminUserId} />;
  if (tab === 'group-chats') return <GroupChatsPanel adminUserId={adminUserId} />;
  if (tab === 'admin-messages') return <AdminMessagesPanel adminUserId={adminUserId} />;
  return null;
}

function useFetch(fn, deps) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    let alive = true;
    setLoading(true); setErr('');
    fn().then((d) => { if (alive) { setData(d); setLoading(false); } })
        .catch((e) => { if (alive) { setErr(e.message); setLoading(false); } });
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { data, err, loading };
}

function StatsPanel({ adminUserId }) {
  const { data, err, loading } = useFetch(() => adminApi.stats(adminUserId), [adminUserId]);
  if (loading) return <p>Loading…</p>;
  if (err) return <p style={{ color: '#8C1515' }}>{err}</p>;
  const items = [
    ['Total users', data.totalUsers],
    ['Authors', data.totalAuthors],
    ['Readers', data.totalReaders],
    ['Total logins', data.totalLogins],
    ['Active last 24h', data.activeLast24h],
    ['Active last 7d', data.activeLast7d],
    ['Books', data.totalBooks],
    ['Assignments (pings)', data.totalPings],
    ['Messages', data.totalMessages],
    ['Reviews', data.totalReviews],
  ];
  return (
    <div className="admin-stats-grid">
      {items.map(([k, v]) => (
        <div key={k} className="admin-stat-card">
          <div className="admin-stat-value">{v}</div>
          <div className="admin-stat-label">{k}</div>
        </div>
      ))}
    </div>
  );
}

function UsersPanel({ adminUserId }) {
  const [users, setUsers] = useState(null);
  const [err, setErr] = useState('');
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [composeFor, setComposeFor] = useState(null);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const [search, setSearch] = useState('');

  async function load() {
    setLoading(true); setErr('');
    try {
      const data = await adminApi.users(adminUserId);
      setUsers(data.users || []);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [adminUserId]);

  async function handleBlock(u) {
    const reason = window.prompt(`Revoke access for ${u.email}?\n\nOptional reason (shown in admin records only):`, '');
    if (reason === null) return;
    setBusyId(u.userId);
    try {
      await adminApi.blockUser(adminUserId, u.userId, reason);
      await load();
    } catch (e) {
      alert(e.message || 'Failed to block user');
    } finally {
      setBusyId(null);
    }
  }

  async function handleUnblock(u) {
    if (!window.confirm(`Restore access for ${u.email}?`)) return;
    setBusyId(u.userId);
    try {
      await adminApi.unblockUser(adminUserId, u.userId);
      await load();
    } catch (e) {
      alert(e.message || 'Failed to unblock user');
    } finally {
      setBusyId(null);
    }
  }

  if (loading) return <p>Loading…</p>;
  if (err) return <p style={{ color: '#8C1515' }}>{err}</p>;

  const q = search.trim().toLowerCase();
  const filtered = q
    ? users.filter((u) =>
        (u.name || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        (u.role || '').toLowerCase().includes(q)
      )
    : users;
  const total = filtered.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const pageRows = filtered.slice(start, start + pageSize);

  return (
    <div className="admin-table-wrap">
      <div className="admin-toolbar">
        <input
          type="search"
          className="admin-search"
          placeholder="Search name, email, or role…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
        <div className="admin-pager">
          <label className="admin-toolbar-check">
            Rows per page:{' '}
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </label>
          <span className="admin-pager-info">
            {total === 0 ? '0 of 0' : `${start + 1}–${Math.min(start + pageSize, total)} of ${total}`}
          </span>
          <button
            className="btn-mini"
            disabled={safePage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >‹ Prev</button>
          <span className="admin-pager-info">Page {safePage} / {totalPages}</span>
          <button
            className="btn-mini"
            disabled={safePage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >Next ›</button>
        </div>
      </div>
      <table className="admin-table">
        <thead><tr>
          <th>Name</th><th>Email</th><th>Role</th><th>Genres</th>
          <th>Age group</th><th>Favorite authors</th><th>Qualifications</th>
          <th>Joined</th><th>Logins</th><th>Last login</th><th>Status</th><th>Actions</th>
        </tr></thead>
        <tbody>
          {pageRows.map((u) => (
            <tr key={u.userId} className={u.blocked ? 'admin-row-blocked' : ''}>
              <td>{u.name || '—'}</td>
              <td>{u.email || '—'}</td>
              <td><span className={`role-pill role-${u.role}`}>{u.role}</span></td>
              <td>{(u.genres || []).join(', ') || u.genre || '—'}</td>
              <td>{u.ageGroup || '—'}</td>
              <td>{u.favoriteAuthors || '—'}</td>
              <td>{u.qualifications || '—'}</td>
              <td>{fmtDate(u.createdAt)}</td>
              <td style={{ textAlign: 'right' }}>{u.loginCount || 0}</td>
              <td>{u.lastLoginAt ? fmtDate(u.lastLoginAt) : '—'}</td>
              <td>
                {u.blocked
                  ? <span className="status-pill status-declined">blocked</span>
                  : <span className="status-pill status-accepted">active</span>}
              </td>
              <td className="admin-actions-cell">
                {u.role !== 'super_admin' && (
                  <>
                    <button
                      className="btn-mini"
                      disabled={busyId === u.userId}
                      onClick={() => setComposeFor(u)}
                    >✉️ Message</button>
                    {u.blocked
                      ? <button
                          className="btn-mini btn-mini-ok"
                          disabled={busyId === u.userId}
                          onClick={() => handleUnblock(u)}
                        >Unblock</button>
                      : <button
                          className="btn-mini btn-mini-danger"
                          disabled={busyId === u.userId}
                          onClick={() => handleBlock(u)}
                        >Revoke</button>}
                  </>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {composeFor && (
        <ComposeMessageModal
          adminUserId={adminUserId}
          recipient={composeFor}
          onClose={() => setComposeFor(null)}
        />
      )}
    </div>
  );
}

function ComposeMessageModal({ adminUserId, recipient, onClose }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState('');

  async function send() {
    if (!text.trim()) return;
    setSending(true); setErr('');
    try {
      await adminApi.sendMessage(adminUserId, recipient.userId, text.trim());
      onClose();
    } catch (e) {
      setErr(e.message || 'Failed to send');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="admin-modal-backdrop" onClick={onClose}>
      <div className="admin-modal" onClick={(e) => e.stopPropagation()}>
        <h3>Message {recipient.name || recipient.email}</h3>
        <p className="admin-modal-sub">{recipient.email}</p>
        <textarea
          rows={6}
          placeholder="Write a message to this user…"
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoFocus
        />
        {err && <div className="admin-modal-error">{err}</div>}
        <div className="admin-modal-actions">
          <button className="btn-ghost" onClick={onClose} disabled={sending}>Cancel</button>
          <button className="btn-primary" onClick={send} disabled={sending || !text.trim()}>
            {sending ? 'Sending…' : 'Send'}
          </button>
        </div>
      </div>
    </div>
  );
}

function BooksPanel({ adminUserId }) {
  const [data, setData] = useState(null);
  const [err, setErr] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [rescanAllBusy, setRescanAllBusy] = useState(false);
  const [excerptsFor, setExcerptsFor] = useState(null);
  const [showFlaggedOnly, setShowFlaggedOnly] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const d = await adminApi.books(adminUserId);
      setData(d);
      setErr(null);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => { load(); /* eslint-disable-next-line */ }, [adminUserId]);

  const rescanOne = async (b) => {
    setBusyId(b._id);
    try {
      await adminApi.rescanBook(adminUserId, b._id);
      await load();
    } catch (e) {
      alert(e.message || 'Rescan failed');
    } finally {
      setBusyId(null);
    }
  };
  const rescanAll = async () => {
    if (!confirm('Re-scan every book in the database? This runs in the background and may take a while.')) return;
    setRescanAllBusy(true);
    try {
      const r = await adminApi.rescanAll(adminUserId);
      alert(`Queued ${r.queued} book(s) for re-scan. Refresh in a few minutes to see updated flags.`);
    } catch (e) {
      alert(e.message || 'Failed to start re-scan');
    } finally {
      setRescanAllBusy(false);
    }
  };

  if (loading) return <p>Loading…</p>;
  if (err) return <p style={{ color: '#8C1515' }}>{err}</p>;

  const rows = (data.books || []).filter((b) =>
    !showFlaggedOnly || flagCategoryList(b.contentFlags).length > 0
  );

  return (
    <div className="admin-table-wrap">
      <div className="admin-toolbar">
        <label className="admin-toolbar-check">
          <input
            type="checkbox"
            checked={showFlaggedOnly}
            onChange={(e) => setShowFlaggedOnly(e.target.checked)}
          />
          {' '}Show flagged books only
        </label>
        <button className="btn-ghost btn-sm" onClick={rescanAll} disabled={rescanAllBusy}>
          {rescanAllBusy ? 'Queuing…' : '🔄 Re-scan all books'}
        </button>
      </div>
      <table className="admin-table">
        <thead><tr>
          <th>Title</th><th>Author</th><th>Genre</th>
          <th>Audio</th><th>Content flags</th><th>Uploaded</th><th></th>
        </tr></thead>
        <tbody>
          {rows.map((b) => {
            const flags = flagCategoryList(b.contentFlags);
            return (
              <tr key={b._id}>
                <td>{b.title}</td>
                <td>{b.authorName || b.authorEmail || b.userId}</td>
                <td>{b.genre || '—'}</td>
                <td>{b.audioStatus || '—'}</td>
                <td>
                  {flags.length === 0 ? (
                    <span className="flag-badge-empty">
                      {b.contentScanStatus === 'scanned' ? 'Clean' : (b.contentScanStatus || 'pending')}
                    </span>
                  ) : (
                    <div className="flag-badge-list">
                      {flags.map((f) => (
                        <button
                          key={f.key}
                          type="button"
                          className="flag-badge"
                          title="View matched excerpts"
                          onClick={() => setExcerptsFor({ book: b, flag: f })}
                        >
                          🚩 {f.label} ({f.count})
                        </button>
                      ))}
                    </div>
                  )}
                </td>
                <td>{fmtDate(b.createdAt)}</td>
                <td>
                  <button
                    className="btn-ghost btn-sm"
                    onClick={() => rescanOne(b)}
                    disabled={busyId === b._id}
                  >
                    {busyId === b._id ? 'Scanning…' : 'Re-scan'}
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {excerptsFor && (
        <ExcerptsModal
          book={excerptsFor.book}
          flag={excerptsFor.flag}
          onClose={() => setExcerptsFor(null)}
        />
      )}
    </div>
  );
}

function ExcerptsModal({ book, flag, onClose }) {
  return (
    <div className="content-warning-backdrop" onClick={onClose}>
      <div className="content-warning-modal" onClick={(e) => e.stopPropagation()} style={{ textAlign: 'left', maxWidth: 640 }}>
        <h2 className="content-warning-title">🚩 {flag.label}</h2>
        <p className="content-warning-sub">
          <strong>{book.title}</strong> · {flag.count} match{flag.count === 1 ? '' : 'es'}
        </p>
        <ul className="flag-excerpts">
          {flag.excerpts.length === 0
            ? <li>No excerpts saved.</li>
            : flag.excerpts.map((ex, i) => <li key={i}>{ex}</li>)}
        </ul>
        <div className="content-warning-actions">
          <button className="btn-primary" onClick={onClose}>Close</button>
        </div>
      </div>
    </div>
  );
}


function PingsPanel({ adminUserId }) {
  const { data, err, loading } = useFetch(() => adminApi.pings(adminUserId), [adminUserId]);
  if (loading) return <p>Loading…</p>;
  if (err) return <p style={{ color: '#8C1515' }}>{err}</p>;
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead><tr>
          <th>Book</th><th>Author</th><th>Reader</th><th>Status</th><th>Initial message</th><th>Created</th>
        </tr></thead>
        <tbody>
          {data.pings.map((p) => (
            <tr key={p._id}>
              <td>{p.bookTitle}</td>
              <td>{p.authorName || p.authorEmail || p.authorUserId}</td>
              <td>{p.readerName || p.readerUserId}</td>
              <td><span className={`status-pill status-${p.status}`}>{p.status}</span></td>
              <td className="admin-msg-cell">{p.message || '—'}</td>
              <td>{fmtDate(p.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function MessagesPanel({ adminUserId }) {
  const { data, err, loading } = useFetch(() => adminApi.messages(adminUserId), [adminUserId]);
  if (loading) return <p>Loading…</p>;
  if (err) return <p style={{ color: '#8C1515' }}>{err}</p>;
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead><tr>
          <th>Sent</th><th>Book</th><th>From</th><th>Role</th><th>Author ↔ Reader</th><th>Message</th>
        </tr></thead>
        <tbody>
          {data.messages.map((m) => (
            <tr key={m._id}>
              <td>{fmtDate(m.createdAt)}</td>
              <td>{m.bookTitle}</td>
              <td>{m.fromName || m.fromUserId}</td>
              <td>{m.fromRole}</td>
              <td>{(m.authorName || m.authorUserId)} ↔ {(m.readerName || m.readerUserId)}</td>
              <td className="admin-msg-cell">{m.text}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {data.messages.length >= 2000 && (
        <p style={{ marginTop: 12, color: '#666' }}>Showing latest 2000 messages.</p>
      )}
    </div>
  );
}

function ReviewsPanel({ adminUserId }) {
  const { data, err, loading } = useFetch(() => adminApi.reviews(adminUserId), [adminUserId]);
  if (loading) return <p>Loading…</p>;
  if (err) return <p style={{ color: '#8C1515' }}>{err}</p>;
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead><tr>
          <th>Book</th><th>Reviewer</th><th>Rating</th><th>Comment</th><th>Date</th>
        </tr></thead>
        <tbody>
          {data.reviews.map((r) => (
            <tr key={r._id}>
              <td>{r.bookTitle || r.bookId}</td>
              <td>{r.reviewerName || r.reviewerUserId}</td>
              <td>{'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}</td>
              <td className="admin-msg-cell">{r.text || '—'}</td>
              <td>{fmtDate(r.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


function GroupChatsPanel({ adminUserId }) {
  const [genre, setGenre] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const { data, err, loading } = useFetch(
    () => adminApi.groupMessages(adminUserId, genre ? { genre } : {}),
    [adminUserId, genre]
  );
  const messages = data?.messages || [];
  const genres = Array.from(new Set(messages.map((m) => m.genre))).sort();
  const total = messages.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safePage = Math.min(page, totalPages);
  const start = (safePage - 1) * pageSize;
  const pageRows = messages.slice(start, start + pageSize);
  return (
    <div className="admin-table-wrap">
      <div className="admin-toolbar">
        <label style={{ fontSize: '0.9rem', color: '#555' }}>
          Filter by group:{' '}
          <select
            value={genre}
            onChange={(e) => { setGenre(e.target.value); setPage(1); }}
          >
            <option value="">All groups</option>
            {genres.map((g) => (
              <option key={g} value={g}>{g}</option>
            ))}
          </select>
        </label>
        <div className="admin-pager">
          <label className="admin-toolbar-check">
            Rows per page:{' '}
            <select
              value={pageSize}
              onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }}
            >
              <option value={10}>10</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </label>
          <span className="admin-pager-info">
            {total === 0 ? '0 of 0' : `${start + 1}–${Math.min(start + pageSize, total)} of ${total}`}
          </span>
          <button
            className="btn-mini"
            disabled={safePage <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >‹ Prev</button>
          <span className="admin-pager-info">Page {safePage} / {totalPages}</span>
          <button
            className="btn-mini"
            disabled={safePage >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >Next ›</button>
        </div>
      </div>
      {loading && <p>Loading…</p>}
      {err && <p style={{ color: '#8C1515' }}>{err}</p>}
      {!loading && !err && (
        <>
          <table className="admin-table">
            <thead><tr>
              <th>Sent</th><th>Group</th><th>From</th><th>Role</th><th>Message</th>
            </tr></thead>
            <tbody>
              {pageRows.map((m) => (
                <tr key={m._id}>
                  <td>{fmtDate(m.createdAt)}</td>
                  <td style={{ textTransform: 'capitalize' }}>{m.genre}</td>
                  <td>{m.fromName || m.fromUserId}</td>
                  <td>{m.fromRole}</td>
                  <td className="admin-msg-cell">{m.text}</td>
                </tr>
              ))}
              {total === 0 && (
                <tr><td colSpan={5} style={{ textAlign: 'center', color: '#666' }}>No group chat messages yet.</td></tr>
              )}
            </tbody>
          </table>
          {total >= 2000 && (
            <p style={{ marginTop: 12, color: '#666' }}>Showing latest 2000 messages.</p>
          )}
        </>
      )}
    </div>
  );
}


function AdminMessagesPanel({ adminUserId }) {
  const { data, err, loading } = useFetch(() => adminApi.adminMessages(adminUserId), [adminUserId]);
  if (loading) return <p>Loading…</p>;
  if (err) return <p style={{ color: '#8C1515' }}>{err}</p>;
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead><tr>
          <th>Sent</th><th>To</th><th>Email</th><th>Message</th><th>Read</th>
        </tr></thead>
        <tbody>
          {data.messages.map((m) => (
            <tr key={m._id}>
              <td>{fmtDate(m.createdAt)}</td>
              <td>{m.recipientName || m.recipientUserId}</td>
              <td>{m.recipientEmail || '—'}</td>
              <td className="admin-msg-cell">{m.text}</td>
              <td>{m.readAt ? fmtDate(m.readAt) : <span className="status-pill status-pending">unread</span>}</td>
            </tr>
          ))}
          {data.messages.length === 0 && (
            <tr><td colSpan={5} style={{ textAlign: 'center', color: '#666' }}>No admin messages sent yet.</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
