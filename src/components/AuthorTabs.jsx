import { useEffect, useState, useCallback } from 'react';
import { listBooks, deleteBook, presignUpload, uploadToS3, saveBook, listReviews, getUserId } from '../api';
import ChatPanel from './ChatPanel';

const GENRES = [
  { value: 'fiction', label: 'Fiction' },
  { value: 'non_fiction', label: 'Non-Fiction' },
];

const FICTION_SUBGENRES = [
  { value: 'action', label: 'Action' },
  { value: 'adventure', label: 'Adventure' },
  { value: 'drama', label: 'Drama' },
  { value: 'erotica', label: 'Erotica' },
  { value: 'fantasy', label: 'Fantasy' },
  { value: 'historical_fiction', label: 'Historical Fiction' },
  { value: 'horror', label: 'Horror' },
  { value: 'humor', label: 'Humor' },
  { value: 'lgbtq', label: 'LGBTQ+' },
  { value: 'literary_fiction', label: 'Literary Fiction' },
  { value: 'mystery', label: 'Mystery' },
  { value: 'other', label: 'Other' },
  { value: 'poetry', label: 'Poetry' },
  { value: 'romance', label: 'Romance' },
  { value: 'scifi', label: 'Sci-Fi' },
  { value: 'thriller', label: 'Thriller' },
  { value: 'young_adult', label: 'Young Adult' },
  { value: 'kids', label: 'Kids Books' },
];

const NON_FICTION_SUBGENRES = [
  { value: 'memoir', label: 'Memoir' },
  { value: 'biography', label: 'Biography' },
  { value: 'self_help', label: 'Self-Help' },
  { value: 'history', label: 'History' },
  { value: 'science', label: 'Science' },
  { value: 'business', label: 'Business' },
  { value: 'cooking', label: 'Cooking' },
  { value: 'travel', label: 'Travel' },
];

const ALL_GENRE_LABELS = {
  ...Object.fromEntries(GENRES.map((g) => [g.value, g.label])),
  ...Object.fromEntries(FICTION_SUBGENRES.map((g) => [g.value, g.label])),
  ...Object.fromEntries(NON_FICTION_SUBGENRES.map((g) => [g.value, g.label])),
};

const genreLabel = (v) => ALL_GENRE_LABELS[v] || v;

function buildReadOnlyPdfUrl(url) {
  if (!url) return '';
  const sep = url.includes('#') ? '&' : '#';
  return `${url}${sep}toolbar=0&navpanes=0&statusbar=0&messages=0&view=FitH`;
}

export function MyBooks({ user, refreshKey, onFindBetaReader, onRead }) {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { items } = await listBooks(getUserId(user));
      setBooks(items);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load, refreshKey]);

  const handleDelete = async (key) => {
    if (!confirm('Delete this book?')) return;
    try {
      await deleteBook(getUserId(user), key);
      load();
    } catch (e) {
      alert('Delete failed: ' + e.message);
    }
  };

  return (
    <div className="tab-panel">
      <h3>My Books</h3>
      <p className="welcome">Your uploaded books.</p>
      {loading && <div className="empty-state">Loading…</div>}
      {error && <div className="empty-state">Error: {error}</div>}
      {!loading && !error && books.length === 0 && (
        <div className="empty-state">No books yet — upload your first one!</div>
      )}
      {!loading && books.length > 0 && (
        <ul className="book-list">
          {books.map((b) => (
            <li key={b.key} className="book-item">
              <div className="book-info">
                <strong>{b.title}</strong>
                {b.genres?.length
                  ? b.genres.map((g) => (
                      <span key={g} className="book-genre">{genreLabel(g)}</span>
                    ))
                  : b.genre && <span className="book-genre">{genreLabel(b.genre)}</span>}
                {b.description && <p className="book-desc">{b.description}</p>}
                <small>
                  {b.size ? `${(b.size / 1024).toFixed(1)} KB · ` : ''}
                  {new Date(b.updated).toLocaleString()}
                </small>
              </div>
              <div className="book-actions">
                <button
                  className="btn-ghost"
                  onClick={() => onRead?.(b)}
                  disabled={!b.viewUrl}
                >
                  View
                </button>
                <button className="btn-primary btn-sm" onClick={() => onFindBetaReader?.(b)}>
                  Find a Beta Reader
                </button>
                <button className="btn-ghost danger" onClick={() => handleDelete(b.key)}>Delete</button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function BookReviews({ user }) {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { reviews } = await listReviews({ bookOwnerUserId: getUserId(user) });
        if (!cancelled) setReviews(reviews);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  const grouped = reviews.reduce((acc, r) => {
    (acc[r.bookId] ||= { bookTitle: r.bookTitle, items: [] }).items.push(r);
    return acc;
  }, {});
  const books = Object.entries(grouped);

  return (
    <div className="tab-panel">
      <h3>Book Reviews</h3>
      <p className="welcome">Reader reviews of your books.</p>
      {loading && <div className="empty-state">Loading…</div>}
      {error && <div className="empty-state">Error: {error}</div>}
      {!loading && !error && books.length === 0 && (
        <div className="empty-state">No reviews yet — only books with at least one review appear here.</div>
      )}
      {!loading && books.length > 0 && (
        <ul className="book-list">
          {books.map(([bookId, { bookTitle, items }]) => {
            const avg = items.reduce((s, r) => s + r.rating, 0) / items.length;
            return (
              <li key={bookId} className="book-item">
                <div className="book-info">
                  <strong>{bookTitle || 'Untitled book'}</strong>
                  <div className="review-summary">
                    {items.length} review{items.length > 1 ? 's' : ''} · avg {avg.toFixed(1)} <span className="stars-gold">★</span>
                  </div>
                  <ul className="reviews-sublist">
                    {items.map((r) => (
                      <li key={r._id} className="review-entry">
                        <div className="review-summary">
                          <span className="stars-gold">{'★'.repeat(r.rating)}</span><span className="stars-empty">{'☆'.repeat(5 - r.rating)}</span>
                          {' '}— <strong>{r.reviewerName || 'Reader'}</strong>
                          {' · '}<small>{new Date(r.updatedAt || r.createdAt).toLocaleDateString()}</small>
                        </div>
                        {r.text && <p className="book-desc">"{r.text}"</p>}
                      </li>
                    ))}
                  </ul>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function AuthorReader({ book, onClose }) {
  return (
    <div className="tab-panel">
      <div className="reader-tab-header">
        <h3 className="reader-tab-title">
          {book ? `📕 ${book.title}` : '📕 Read'}
        </h3>
        {book && (
          <button className="btn-ghost btn-sm" onClick={onClose}>✕ Close</button>
        )}
      </div>
      {book && book.viewUrl ? (
        <iframe
          key={book.key || book.id}
          title={book.title}
          src={buildReadOnlyPdfUrl(book.viewUrl)}
          className="reader-tab-frame"
          onContextMenu={(e) => e.preventDefault()}
        />
      ) : (
        <p className="welcome">
          Pick a book from the <strong>My Books</strong> tab and click <strong>View</strong> to open it here.
        </p>
      )}
    </div>
  );
}

export function AuthorMessages({ user }) {
  return (
    <div className="tab-panel">
      <h3>Messages</h3>
      <p className="welcome">Chats with beta readers you've pinged.</p>
      <ChatPanel
        user={user}
        myRole="author"
        title="💬 Conversations"
        emptyMessage="No conversations yet — ping a beta reader from My Books to start one."
      />
    </div>
  );
}

export function UploadBook({ user, onUploaded }) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selected, setSelected] = useState(() => new Set());
  const [file, setFile] = useState(null);
  const [progress, setProgress] = useState(0);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState(null);

  const toggle = (value) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(value)) next.delete(value); else next.add(value);
      return next;
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage(null);
    if (!file) { setMessage({ type: 'error', text: 'Please choose a PDF file.' }); return; }
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      setMessage({ type: 'error', text: 'Only PDF files are supported.' }); return;
    }
    if (!title.trim()) { setMessage({ type: 'error', text: 'Please enter a title.' }); return; }
    const genres = Array.from(selected);
    if (!genres.length) { setMessage({ type: 'error', text: 'Please select at least one genre.' }); return; }

    setUploading(true);
    setProgress(0);
    try {
      const { url, key } = await presignUpload({
        userId: getUserId(user),
        filename: file.name,
        contentType: 'application/pdf',
        title: title.trim(),
        description: description.trim(),
      });
      await uploadToS3(url, file, setProgress);
      await saveBook({
        userId: getUserId(user),
        title: title.trim(),
        description: description.trim(),
        genres,
        s3Key: key,
        size: file.size,
        authorEmail: user?.email,
        authorName: user?.name,
      });
      setMessage({ type: 'success', text: 'Upload complete!' });
      setTitle(''); setDescription(''); setSelected(new Set()); setFile(null);
      onUploaded?.();
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="tab-panel">
      <h3>Upload Book</h3>
      <p className="welcome">Add a new PDF to your catalog.</p>
      <form className="upload-form" onSubmit={handleSubmit}>
        <label className="field">
          <span>Title</span>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Enter book title" />
        </label>
        <label className="field">
          <span>Description</span>
          <textarea rows="4" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short description" />
        </label>
        <fieldset className="genre-group">
          <legend>Fiction</legend>
          <div className="genre-checkbox-grid">
            {FICTION_SUBGENRES.map((g) => (
              <label key={g.value} className="genre-checkbox">
                <input
                  type="checkbox"
                  checked={selected.has(g.value)}
                  onChange={() => toggle(g.value)}
                />
                <span>{g.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <fieldset className="genre-group">
          <legend>Non-Fiction</legend>
          <div className="genre-checkbox-grid">
            {NON_FICTION_SUBGENRES.map((g) => (
              <label key={g.value} className="genre-checkbox">
                <input
                  type="checkbox"
                  checked={selected.has(g.value)}
                  onChange={() => toggle(g.value)}
                />
                <span>{g.label}</span>
              </label>
            ))}
          </div>
        </fieldset>
        <label className="field">
          <span>Book File (PDF only)</span>
          <input type="file" accept="application/pdf,.pdf" onChange={(e) => setFile(e.target.files?.[0] || null)} />
        </label>
        {uploading && (
          <div className="progress"><div className="progress-bar" style={{ width: `${progress}%` }} /></div>
        )}
        {message && <div className={`flash flash-${message.type}`}>{message.text}</div>}
        <button type="submit" className="btn-primary" disabled={uploading}>
          {uploading ? `Uploading… ${Math.round(progress)}%` : 'Upload'}
        </button>
      </form>
    </div>
  );
}
