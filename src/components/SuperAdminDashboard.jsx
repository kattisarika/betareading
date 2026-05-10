import { useEffect, useState } from 'react';
import { adminApi } from '../api';

const TABS = [
  { id: 'stats', label: 'Stats', icon: '📊' },
  { id: 'users', label: 'Users', icon: '👥' },
  { id: 'books', label: 'Books', icon: '📚' },
  { id: 'pings', label: 'Assignments', icon: '🔗' },
  { id: 'messages', label: 'Messages', icon: '💬' },
  { id: 'reviews', label: 'Reviews', icon: '⭐' },
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
  const { data, err, loading } = useFetch(() => adminApi.users(adminUserId), [adminUserId]);
  if (loading) return <p>Loading…</p>;
  if (err) return <p style={{ color: '#8C1515' }}>{err}</p>;
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead><tr>
          <th>Name</th><th>Email</th><th>Role</th><th>Genres</th>
          <th>Age group</th><th>Favorite authors</th><th>Qualifications</th><th>Joined</th>
        </tr></thead>
        <tbody>
          {data.users.map((u) => (
            <tr key={u.userId}>
              <td>{u.name || '—'}</td>
              <td>{u.email || '—'}</td>
              <td><span className={`role-pill role-${u.role}`}>{u.role}</span></td>
              <td>{(u.genres || []).join(', ') || u.genre || '—'}</td>
              <td>{u.ageGroup || '—'}</td>
              <td>{u.favoriteAuthors || '—'}</td>
              <td>{u.qualifications || '—'}</td>
              <td>{fmtDate(u.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function BooksPanel({ adminUserId }) {
  const { data, err, loading } = useFetch(() => adminApi.books(adminUserId), [adminUserId]);
  if (loading) return <p>Loading…</p>;
  if (err) return <p style={{ color: '#8C1515' }}>{err}</p>;
  return (
    <div className="admin-table-wrap">
      <table className="admin-table">
        <thead><tr>
          <th>Title</th><th>Author</th><th>Genre</th><th>Subgenres</th>
          <th>Audio</th><th>Uploaded</th>
        </tr></thead>
        <tbody>
          {data.books.map((b) => (
            <tr key={b._id}>
              <td>{b.title}</td>
              <td>{b.authorName || b.authorEmail || b.userId}</td>
              <td>{b.genre || '—'}</td>
              <td>{(b.genres || []).join(', ') || '—'}</td>
              <td>{b.audioStatus || '—'}</td>
              <td>{fmtDate(b.createdAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
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
