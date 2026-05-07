import { useCallback, useEffect, useState } from 'react';
import { listMessages, sendMessage, getUserId } from '../api';

function groupByThread(messages, myRole) {
  const map = new Map();
  for (const m of messages) {
    const otherId = myRole === 'author' ? m.readerUserId : m.authorUserId;
    const otherName = myRole === 'author' ? m.readerName : m.authorName;
    const key = `${m.bookId}::${otherId}`;
    if (!map.has(key)) {
      map.set(key, {
        key,
        bookId: m.bookId,
        bookTitle: m.bookTitle,
        authorUserId: m.authorUserId,
        authorName: m.authorName,
        readerUserId: m.readerUserId,
        readerName: m.readerName,
        otherName,
        messages: [],
      });
    }
    map.get(key).messages.push(m);
  }
  return Array.from(map.values()).sort((a, b) => {
    const lastA = a.messages[a.messages.length - 1].createdAt;
    const lastB = b.messages[b.messages.length - 1].createdAt;
    return new Date(lastB) - new Date(lastA);
  });
}

function ChatThread({ user, myRole, thread, onSent }) {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const myId = getUserId(user);

  const handleSend = async (e) => {
    e.preventDefault();
    if (!text.trim()) return;
    setSending(true);
    setError(null);
    try {
      await sendMessage({
        bookId: thread.bookId,
        bookTitle: thread.bookTitle,
        authorUserId: thread.authorUserId,
        authorName: thread.authorName,
        readerUserId: thread.readerUserId,
        readerName: thread.readerName,
        fromUserId: myId,
        fromName: user?.name,
        fromRole: myRole,
        text: text.trim(),
      });
      setText('');
      onSent?.();
    } catch (err) {
      setError(err.message);
    } finally {
      setSending(false);
    }
  };

  const otherLabel = thread.otherName || (myRole === 'author' ? 'Reader' : 'Author');

  return (
    <div className="chat-thread">
      <div className="chat-thread-header">
        <div className="chat-avatar">{otherLabel.charAt(0).toUpperCase()}</div>
        <div>
          <div className="chat-thread-name">{otherLabel}</div>
          <div className="chat-thread-book">about <em>"{thread.bookTitle}"</em></div>
        </div>
      </div>
      <div className="chat-bubbles">
        {thread.messages.map((m) => {
          const mine = m.fromUserId === myId;
          return (
            <div key={m._id} className={`chat-bubble ${mine ? 'me' : 'them'}`}>
              <div className="chat-bubble-text">{m.text}</div>
              <div className="chat-bubble-meta">
                {!mine && (m.fromName || otherLabel)} · {new Date(m.createdAt).toLocaleString()}
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
          placeholder="Type a reply…"
          disabled={sending}
        />
        <button className="btn-primary btn-sm" type="submit" disabled={sending || !text.trim()}>
          {sending ? 'Sending…' : 'Send'}
        </button>
      </form>
      {error && <div className="reader-card-error">Error: {error}</div>}
    </div>
  );
}

export default function ChatPanel({ user, myRole, title, emptyMessage, hideWhenEmpty = false }) {
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    try {
      const { messages } = await listMessages({ userId: getUserId(user) });
      setMessages(messages);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  if (loading) return null;
  if (error) return <div className="empty-state">Error loading messages: {error}</div>;

  const threads = groupByThread(messages, myRole);

  if (threads.length === 0) {
    if (hideWhenEmpty) return null;
    return (
      <div className="reader-pings">
        <h3>{title || '💬 Messages'}</h3>
        <div className="empty-state">
          {emptyMessage || 'No conversations yet.'}
        </div>
      </div>
    );
  }

  return (
    <div className="reader-pings">
      <h3>{title || '💬 Messages'} <span className="pings-badge">{threads.length}</span></h3>
      <div className="chat-thread-list">
        {threads.map((t) => (
          <ChatThread key={t.key} user={user} myRole={myRole} thread={t} onSent={load} />
        ))}
      </div>
    </div>
  );
}
