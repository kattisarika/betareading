import { useEffect, useState } from 'react';
import { findBetaReaders, pingReader, listPings, getUserId } from '../api';

const GENRE_LABELS = { fiction: 'Fiction', non_fiction: 'Non-Fiction' };

export default function FindBetaReader({ user, book, onBack }) {
  const [readers, setReaders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [query, setQuery] = useState('');
  const [pingState, setPingState] = useState({}); // readerUserId -> 'pinged' | 'sending' | { error }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [{ readers }, { pings }] = await Promise.all([
          findBetaReaders(book.genre),
          listPings({ authorUserId: getUserId(user) }),
        ]);
        if (cancelled) return;
        setReaders(readers);
        const initial = {};
        pings.filter((p) => p.bookId === book.id).forEach((p) => {
          initial[p.readerUserId] = 'pinged';
        });
        setPingState(initial);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [book.genre, book.id, user]);

  const filtered = readers.filter((r) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (r.name || '').toLowerCase().includes(q);
  });

  const handlePing = async (reader) => {
    setPingState((prev) => ({ ...prev, [reader.userId]: 'sending' }));
    try {
      await pingReader({
        bookId: book.id,
        bookTitle: book.title,
        bookGenre: book.genre,
        authorUserId: getUserId(user),
        authorName: user?.name,
        authorEmail: user?.email,
        readerUserId: reader.userId,
        readerName: reader.name,
      });
      setPingState((prev) => ({ ...prev, [reader.userId]: 'pinged' }));
    } catch (e) {
      setPingState((prev) => ({ ...prev, [reader.userId]: { error: e.message } }));
    }
  };

  const genreLabel = GENRE_LABELS[book.genre] || book.genre;

  return (
    <div className="find-reader-page">
      <button className="btn-ghost" onClick={onBack}>← Back to My Books</button>

      <div className="find-reader-header">
        <h2 className="auth-title">Find a Beta Reader</h2>
        <p className="welcome">
          Matching <strong>{genreLabel}</strong> readers for your book{' '}
          <em>"{book.title}"</em>.
        </p>
      </div>

      <div className="field" style={{ maxWidth: 420 }}>
        <input
          type="text"
          placeholder="Search by name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {loading && <div className="empty-state">Searching readers…</div>}
      {error && <div className="empty-state">Error: {error}</div>}
      {!loading && !error && readers.length === 0 && (
        <div className="empty-state">
          No {genreLabel} readers have signed up yet — check back soon!
        </div>
      )}
      {!loading && !error && readers.length > 0 && filtered.length === 0 && (
        <div className="empty-state">No readers match "{query}".</div>
      )}
      {!loading && filtered.length > 0 && (
        <>
          <p className="readers-title">
            {filtered.length} of {readers.length} {genreLabel} reader{readers.length > 1 ? 's' : ''}
          </p>
          <ul className="reader-cards">
            {filtered.map((r) => {
              const state = pingState[r.userId];
              const isPinged = state === 'pinged';
              const isSending = state === 'sending';
              const errMsg = state && typeof state === 'object' ? state.error : null;
              return (
                <li key={r.userId} className="reader-card">
                  <div className="reader-avatar">
                    {(r.name || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="reader-card-body">
                    <div className="reader-card-name">{r.name || 'Unnamed reader'}</div>
                    <div className="reader-card-meta">
                      Joined {new Date(r.createdAt).toLocaleDateString()}
                    </div>
                    {errMsg && <div className="reader-card-error">Error: {errMsg}</div>}
                  </div>
                  <button
                    className="btn-primary btn-sm"
                    onClick={() => handlePing(r)}
                    disabled={isPinged || isSending}
                  >
                    {isPinged ? '✓ Pinged' : isSending ? 'Pinging…' : 'Ping'}
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      )}
    </div>
  );
}
