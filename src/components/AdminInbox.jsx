import { useEffect, useState } from 'react';
import { getInbox, markInboxRead } from '../api';

export default function AdminInbox({ userId }) {
  const [messages, setMessages] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState('');

  async function load() {
    if (!userId) return;
    try {
      const data = await getInbox(userId);
      setMessages(data.messages || []);
      setUnreadCount(data.unreadCount || 0);
    } catch (e) {
      setError(e.message || 'Failed to load inbox');
    }
  }

  useEffect(() => {
    load();
    const t = setInterval(load, 60000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  async function handleOpen() {
    const next = !open;
    setOpen(next);
    if (next && unreadCount > 0) {
      try {
        await markInboxRead(userId);
        setUnreadCount(0);
        setMessages((ms) => ms.map((m) => (m.readAt ? m : { ...m, readAt: new Date().toISOString() })));
      } catch (e) {
        console.warn('Failed to mark read:', e.message);
      }
    }
  }

  if (!userId) return null;
  if (!messages.length && !error) return null;

  return (
    <div className="admin-inbox">
      <button type="button" className="admin-inbox-toggle" onClick={handleOpen}>
        <span className="admin-inbox-icon" aria-hidden="true">📬</span>
        <span>Inbox</span>
        {unreadCount > 0 && <span className="admin-inbox-badge">{unreadCount}</span>}
      </button>
      {open && (
        <div className="admin-inbox-panel">
          <div className="admin-inbox-header">Messages from Admin</div>
          {error && <div className="admin-inbox-error">{error}</div>}
          {messages.length === 0 ? (
            <div className="admin-inbox-empty">No messages.</div>
          ) : (
            <ul className="admin-inbox-list">
              {messages.map((m) => (
                <li key={m._id} className={`admin-inbox-item ${m.readAt ? '' : 'admin-inbox-item-unread'}`}>
                  <div className="admin-inbox-meta">
                    <strong>{m.adminName || 'Super Admin'}</strong>
                    <span className="admin-inbox-time">{new Date(m.createdAt).toLocaleString()}</span>
                  </div>
                  <div className="admin-inbox-text">{m.text}</div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
