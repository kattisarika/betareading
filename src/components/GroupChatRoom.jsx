import { useCallback, useEffect, useRef, useState } from 'react';
import { getUserId, listGroupMembers, listGroupMessages, sendGroupMessage } from '../api';
import { genreLabel } from '../constants/genres';

const POLL_MS = 4000;

export default function GroupChatRoom({ user, genre, onBack }) {
  const myId = getUserId(user);
  const [members, setMembers] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bubblesRef = useRef(null);

  const loadMessages = useCallback(async () => {
    try {
      const { messages: list } = await listGroupMessages(myId, genre);
      setMessages(list);
    } catch (e) {
      setError(e.message);
    }
  }, [myId, genre]);

  const loadMembers = useCallback(async () => {
    try {
      const { members: list } = await listGroupMembers(myId, genre);
      setMembers(list);
    } catch (e) {
      setError(e.message);
    }
  }, [myId, genre]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await Promise.all([loadMessages(), loadMembers()]);
      if (!cancelled) setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [loadMessages, loadMembers]);

  useEffect(() => {
    const id = setInterval(() => { loadMessages(); }, POLL_MS);
    return () => clearInterval(id);
  }, [loadMessages]);

  useEffect(() => {
    if (bubblesRef.current) {
      bubblesRef.current.scrollTop = bubblesRef.current.scrollHeight;
    }
  }, [messages.length]);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    setError(null);
    try {
      await sendGroupMessage(myId, genre, text.trim());
      setText('');
      await Promise.all([loadMessages(), loadMembers()]);
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  const label = genreLabel(genre);
  const isSolo = members.length === 1;

  return (
    <div className="group-chat-page">
      <div className="group-chat-header">
        <button className="btn-ghost btn-sm" onClick={onBack}>← Back to groups</button>
        <h2 className="group-chat-title">👥 {label} Beta Readers</h2>
        <span className="group-chat-count">{members.length} {members.length === 1 ? 'member' : 'members'}</span>
      </div>

      {loading ? (
        <div className="empty-state">Loading…</div>
      ) : (
        <div className="group-chat-body">
          <aside className="group-chat-members">
            <h4 className="group-chat-section-title">Members</h4>
            {members.length === 0 && <p className="muted">No members yet.</p>}
            {members.map((m) => (
              <div key={m.userId} className={`group-chat-member-row ${m.userId === myId ? 'is-me' : ''}`}>
                <div className="chat-avatar">{(m.name || m.email || '?').charAt(0).toUpperCase()}</div>
                <div className="group-chat-member-info">
                  <div className="group-chat-member-name">
                    {m.name || m.email || m.userId}
                    {m.userId === myId && <span className="group-chat-me-tag"> (you)</span>}
                  </div>
                  {m.ageGroup && <div className="group-chat-member-meta">{m.ageGroup.replace('_', ' ')}</div>}
                </div>
              </div>
            ))}
          </aside>

          <section className="group-chat-main">
            {isSolo && (
              <div className="group-solo">
                You're the only one here — stay put till your tribe is found.
              </div>
            )}
            <div className="chat-bubbles group-chat-bubbles" ref={bubblesRef}>
              {messages.length === 0 && !isSolo && (
                <p className="muted">No messages yet — say hi to your tribe.</p>
              )}
              {messages.map((m) => {
                const mine = m.fromUserId === myId;
                return (
                  <div key={m._id} className={`chat-bubble ${mine ? 'me' : 'them'}`}>
                    <div className="chat-bubble-text">{m.text}</div>
                    <div className="chat-bubble-meta">
                      {!mine && (m.fromName || 'Reader')} · {new Date(m.createdAt).toLocaleString()}
                    </div>
                  </div>
                );
              })}
            </div>
            <form className="chat-compose" onSubmit={handleSend}>
              <input
                type="text"
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder={`Message the ${label} group…`}
                disabled={sending}
              />
              <button className="btn-primary btn-sm" type="submit" disabled={sending || !text.trim()}>
                {sending ? 'Sending…' : 'Send'}
              </button>
            </form>
            {error && <div className="reader-card-error">Error: {error}</div>}
          </section>
        </div>
      )}
    </div>
  );
}
