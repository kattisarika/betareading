import { useEffect, useRef, useState, useCallback } from 'react';
import { getUserProfile, saveUserProfile, listBooksByGenre, listReviews, submitReview, generateBookAudio, getUserId } from '../api';
import ChatPanel from './ChatPanel';

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

const FICTION_SUBGENRE_VALUES = new Set(FICTION_SUBGENRES.map((g) => g.value));
const NON_FICTION_SUBGENRE_VALUES = new Set(NON_FICTION_SUBGENRES.map((g) => g.value));

const ALL_GENRE_LABELS = {
  fiction: 'Fiction',
  non_fiction: 'Non-Fiction',
  ...Object.fromEntries(FICTION_SUBGENRES.map((g) => [g.value, g.label])),
  ...Object.fromEntries(NON_FICTION_SUBGENRES.map((g) => [g.value, g.label])),
};

const genreLabel = (v) => ALL_GENRE_LABELS[v] || v;

function deriveBroadGenres(genres = []) {
  const broad = new Set();
  for (const g of genres) {
    if (g === 'non_fiction' || NON_FICTION_SUBGENRE_VALUES.has(g)) broad.add('non_fiction');
    else if (FICTION_SUBGENRE_VALUES.has(g) || g === 'fiction') broad.add('fiction');
  }
  return Array.from(broad);
}

function ReviewForm({ user, book, existing, onSaved }) {
  const [rating, setRating] = useState(existing?.rating || 0);
  const [text, setText] = useState(existing?.text || '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const submit = async (e) => {
    e.preventDefault();
    if (rating < 1) { setError('Please pick a rating.'); return; }
    setSaving(true);
    setError(null);
    try {
      const { review } = await submitReview({
        bookId: book.id || book.key,
        bookTitle: book.title,
        bookOwnerUserId: book.authorUserId,
        reviewerUserId: getUserId(user),
        reviewerName: user?.name,
        rating,
        text,
      });
      onSaved?.(review);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="review-form" onSubmit={submit}>
      <div className="star-rating" role="radiogroup" aria-label="Rating">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            type="button"
            key={n}
            className={`star ${n <= rating ? 'star-on' : ''}`}
            onClick={() => setRating(n)}
            aria-label={`${n} star${n > 1 ? 's' : ''}`}
          >
            ★
          </button>
        ))}
      </div>
      <textarea
        rows="3"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Share your thoughts (optional)"
      />
      {error && <div className="reader-card-error">{error}</div>}
      <button className="btn-primary btn-sm" type="submit" disabled={saving}>
        {saving ? 'Saving…' : existing ? 'Update Review' : 'Submit Review'}
      </button>
    </form>
  );
}

function buildReadOnlyPdfUrl(url) {
  if (!url) return '';
  const sep = url.includes('#') ? '&' : '#';
  return `${url}${sep}toolbar=0&navpanes=0&statusbar=0&messages=0&view=FitH`;
}

function BookItem({ user, book, existingReview, onReviewSaved, onRefresh, onRead }) {
  const [open, setOpen] = useState(false);
  const [playerOpen, setPlayerOpen] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [activeChapter, setActiveChapter] = useState(0);
  const status = book.audioStatus || 'pending';
  const chapters = Array.isArray(book.audioChapters) && book.audioChapters.length
    ? book.audioChapters
    : (book.audioUrl ? [{ title: 'Audiobook', audioUrl: book.audioUrl }] : []);
  const currentAudioUrl = chapters[activeChapter]?.audioUrl;

  const audioRef = useRef(null);
  const resumeTimeRef = useRef(0);
  const restoredRef = useRef(false);
  const lastSaveRef = useRef(0);
  const bookmarkKey = `bra_audio_bm:${book.id}`;

  useEffect(() => {
    if (status !== 'processing' || !onRefresh) return;
    const id = setInterval(onRefresh, 15000);
    return () => clearInterval(id);
  }, [status, onRefresh]);

  useEffect(() => {
    if (restoredRef.current) return;
    if (status !== 'ready' || chapters.length === 0) return;
    try {
      const raw = localStorage.getItem(bookmarkKey);
      if (raw) {
        const bm = JSON.parse(raw);
        const idx = Math.min(Math.max(0, Number(bm.chapter) || 0), chapters.length - 1);
        setActiveChapter(idx);
        resumeTimeRef.current = Number(bm.time) || 0;
      }
    } catch { /* ignore */ }
    restoredRef.current = true;
  }, [status, chapters.length, bookmarkKey]);

  const saveBookmark = (chapter, time) => {
    try {
      localStorage.setItem(
        bookmarkKey,
        JSON.stringify({ chapter, time, updatedAt: new Date().toISOString() })
      );
    } catch { /* ignore */ }
  };

  const handleLoadedMetadata = () => {
    const t = resumeTimeRef.current;
    if (t > 0 && audioRef.current) {
      try { audioRef.current.currentTime = t; } catch { /* ignore */ }
    }
    resumeTimeRef.current = 0;
  };

  const handleTimeUpdate = () => {
    const audio = audioRef.current;
    if (!audio) return;
    const now = Date.now();
    if (now - lastSaveRef.current < 3000) return;
    lastSaveRef.current = now;
    saveBookmark(activeChapter, audio.currentTime);
  };

  const handlePause = () => {
    const audio = audioRef.current;
    if (audio) saveBookmark(activeChapter, audio.currentTime);
  };

  const selectChapter = (i) => {
    resumeTimeRef.current = 0;
    setActiveChapter(i);
    saveBookmark(i, 0);
  };

  const handleListen = async () => {
    if (status === 'ready') { setPlayerOpen((v) => !v); return; }
    if (status === 'processing') return;
    try {
      setTriggering(true);
      await generateBookAudio(book.id);
      onRefresh?.();
    } catch (e) {
      alert(`Could not start audio generation: ${e.message}`);
    } finally {
      setTriggering(false);
    }
  };

  let listenLabel = '🎧 Listen';
  if (status === 'processing') listenLabel = '🎧 Generating audio…';
  else if (status === 'failed') listenLabel = '🎧 Retry audio';
  else if (status === 'pending') listenLabel = triggering ? '🎧 Starting…' : '🎧 Generate audio';
  else if (status === 'ready') listenLabel = playerOpen ? '🎧 Hide player' : '🎧 Listen';

  return (
    <li className="book-item">
      <div className="book-info">
        <strong>{book.title}</strong>
        <span className="book-genre">{genreLabel(book.genre)}</span>
        {book.description && <p className="book-desc">{book.description}</p>}
        <small>
          {book.authorName ? `by ${book.authorName} · ` : ''}
          {new Date(book.updated).toLocaleDateString()}
        </small>
        {existingReview && !open && (
          <div className="review-summary">
            Your rating: <span className="stars-gold">{'★'.repeat(existingReview.rating)}</span><span className="stars-empty">{'☆'.repeat(5 - existingReview.rating)}</span>
            {existingReview.text && <span className="review-summary-text"> — “{existingReview.text}”</span>}
          </div>
        )}
      </div>
      <div className="book-actions">
        <button
          className="btn-primary btn-sm"
          onClick={() => onRead?.(book)}
          disabled={!book.viewUrl}
        >
          📖 Read
        </button>
        <button
          className="btn-ghost btn-sm"
          onClick={handleListen}
          disabled={status === 'processing' || triggering}
          title={status === 'failed' ? (book.audioError || 'Audio generation failed') : ''}
        >
          {listenLabel}
        </button>
        <button className="btn-ghost btn-sm" onClick={() => setOpen((v) => !v)}>
          ⭐ {existingReview ? (open ? 'Cancel' : 'Edit Review') : (open ? 'Cancel' : 'Leave a Review')}
        </button>
      </div>
      {playerOpen && status === 'ready' && chapters.length > 0 && (
        <div className="book-audio-panel">
          {chapters.length > 1 && (
            <ol className="chapter-list">
              {chapters.map((ch, i) => (
                <li key={i}>
                  <button
                    type="button"
                    className={`chapter-item${i === activeChapter ? ' chapter-item-active' : ''}`}
                    onClick={() => selectChapter(i)}
                  >
                    <span className="chapter-num">{i + 1}.</span> {ch.title || `Chapter ${i + 1}`}
                  </button>
                </li>
              ))}
            </ol>
          )}
          {currentAudioUrl && (
            <audio
              key={currentAudioUrl}
              ref={audioRef}
              controls
              autoPlay={chapters.length > 1 || resumeTimeRef.current > 0}
              src={currentAudioUrl}
              preload="metadata"
              onLoadedMetadata={handleLoadedMetadata}
              onTimeUpdate={handleTimeUpdate}
              onPause={handlePause}
              onEnded={() => {
                saveBookmark(activeChapter, 0);
                if (activeChapter + 1 < chapters.length) selectChapter(activeChapter + 1);
              }}
              style={{ width: '100%', marginTop: chapters.length > 1 ? 8 : 0 }}
            />
          )}
        </div>
      )}
      {open && (
        <div className="book-review-panel">
          <ReviewForm
            user={user}
            book={book}
            existing={existingReview}
            onSaved={(rev) => { setOpen(false); onReviewSaved?.(rev); }}
          />
        </div>
      )}
    </li>
  );
}

function ReaderBooks({ user, broadGenres, onRead }) {
  const [books, setBooks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reviewsByBook, setReviewsByBook] = useState({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const results = await Promise.all(broadGenres.map((g) => listBooksByGenre(g)));
      const merged = [];
      const seen = new Set();
      for (const { items } of results) {
        for (const item of items) {
          if (!seen.has(item.key)) { seen.add(item.key); merged.push(item); }
        }
      }
      merged.sort((a, b) => new Date(b.updated) - new Date(a.updated));
      setBooks(merged);
      const myId = getUserId(user);
      if (myId) {
        const { reviews } = await listReviews({ reviewerUserId: myId });
        const map = {};
        for (const r of reviews) map[r.bookId] = r;
        setReviewsByBook(map);
      }
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }, [broadGenres, user]);

  useEffect(() => { load(); }, [load]);

  const heading = broadGenres.map(genreLabel).join(' & ');

  return (
    <div className="reader-books">
      <h3>View Books</h3>
      <p className="welcome">
        {heading} books available for you.
      </p>
      {loading && <div className="empty-state">Loading…</div>}
      {error && <div className="empty-state">Error: {error}</div>}
      {!loading && !error && books.length === 0 && (
        <div className="empty-state">No {heading} books yet — check back soon!</div>
      )}
      {!loading && books.length > 0 && (
        <ul className="book-list">
          {books.map((b) => (
            <BookItem
              key={b.key}
              user={user}
              book={b}
              existingReview={reviewsByBook[b.id || b.key]}
              onReviewSaved={(rev) => setReviewsByBook((prev) => ({ ...prev, [rev.bookId]: rev }))}
              onRefresh={load}
              onRead={onRead}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

const READER_TABS = [
  { id: 'books', label: 'Books', icon: '📖' },
  { id: 'reviews', label: 'Book Reviews', icon: '⭐' },
  { id: 'messages', label: 'Messages', icon: '💬' },
  { id: 'reader', label: 'Read', icon: '📕' },
  { id: 'profile', label: 'Profile', icon: '👤' },
];

function ReaderReviews({ user }) {
  const [books, setBooks] = useState([]); // [{ bookId, bookTitle, reviews: [...] }]
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const myId = getUserId(user);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { reviews: mine } = await listReviews({ reviewerUserId: myId });
        const bookIds = Array.from(new Set(mine.map((r) => r.bookId)));
        const perBook = await Promise.all(
          bookIds.map(async (bookId) => {
            const { reviews } = await listReviews({ bookId });
            const sorted = reviews.sort(
              (a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt)
            );
            const bookTitle =
              mine.find((r) => r.bookId === bookId)?.bookTitle ||
              sorted[0]?.bookTitle || 'Untitled book';
            return { bookId, bookTitle, reviews: sorted };
          })
        );
        if (!cancelled) setBooks(perBook);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [myId]);

  return (
    <div className="tab-panel">
      <h3>Book Reviews</h3>
      <p className="welcome">Books you've reviewed — see what every reader is saying.</p>
      {loading && <div className="empty-state">Loading…</div>}
      {error && <div className="empty-state">Error: {error}</div>}
      {!loading && !error && books.length === 0 && (
        <div className="empty-state">
          You haven't reviewed any books yet — head to the Books tab and leave a review!
        </div>
      )}
      {!loading && books.length > 0 && (
        <ul className="book-list">
          {books.map(({ bookId, bookTitle, reviews }) => {
            const avg = reviews.reduce((s, r) => s + r.rating, 0) / reviews.length;
            return (
              <li key={bookId} className="book-item">
                <div className="book-info">
                  <strong>{bookTitle}</strong>
                  <div className="review-summary">
                    {reviews.length} review{reviews.length > 1 ? 's' : ''} · avg {avg.toFixed(1)} <span className="stars-gold">★</span>
                  </div>
                  <ul className="reviews-sublist">
                    {reviews.map((r) => {
                      const mine = r.reviewerUserId === myId;
                      return (
                        <li key={r._id} className="review-entry">
                          <div className="review-summary">
                            <span className="stars-gold">{'★'.repeat(r.rating)}</span><span className="stars-empty">{'☆'.repeat(5 - r.rating)}</span>
                            {' '}— <strong>{mine ? 'You' : (r.reviewerName || 'Reader')}</strong>
                            {' · '}<small>{new Date(r.updatedAt || r.createdAt).toLocaleDateString()}</small>
                          </div>
                          {r.text && <p className="book-desc">"{r.text}"</p>}
                        </li>
                      );
                    })}
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

function initialGenres(profile) {
  if (Array.isArray(profile?.genres) && profile.genres.length) return profile.genres;
  if (profile?.genre) return [profile.genre];
  return [];
}

function ReaderProfileForm({ user, savedProfile, setSavedProfile }) {
  const [selected, setSelected] = useState(() => new Set(initialGenres(savedProfile)));
  const [saving, setSaving] = useState(false);
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
    const genres = Array.from(selected);
    if (!genres.length) { setMessage({ type: 'error', text: 'Please select at least one genre.' }); return; }
    setSaving(true);
    try {
      const { profile } = await saveUserProfile({
        userId: getUserId(user),
        email: user?.email,
        name: user?.name,
        role: 'reader',
        genres,
      });
      setSavedProfile(profile);
      setMessage({ type: 'success', text: 'Profile saved!' });
    } catch (err) {
      setMessage({ type: 'error', text: err.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="reader-profile" onSubmit={handleSubmit}>
      <h2 className="auth-title">Tell us about your reading taste</h2>
      <p className="welcome">
        {savedProfile ? 'Update your reader profile.' : 'Set up your reader profile to get matched with books.'}
      </p>

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

      {message && <div className={`flash flash-${message.type}`} style={{ marginTop: '16px' }}>{message.text}</div>}

      <button type="submit" className="btn-primary" style={{ marginTop: '20px' }} disabled={saving}>
        {saving ? 'Saving…' : savedProfile ? 'Update' : 'Submit'}
      </button>
    </form>
  );
}

export default function ReaderProfile({ user }) {
  const [loading, setLoading] = useState(true);
  const [savedProfile, setSavedProfile] = useState(null);
  const [tab, setTab] = useState('books');
  const [readingBook, setReadingBook] = useState(null);

  const openReader = (book) => {
    setReadingBook(book);
    setTab('reader');
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const { profile } = await getUserProfile(getUserId(user));
        if (cancelled) return;
        if (profile) setSavedProfile(profile);
        const hasGenres = (profile?.genres?.length || 0) > 0 || !!profile?.genre;
        if (!hasGenres && !cancelled) setTab('profile');
      } catch {
        // Surface errors on the profile tab when the user opens it.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [user]);

  if (loading) return <div className="empty-state">Loading profile…</div>;

  const broadGenres = deriveBroadGenres(initialGenres(savedProfile));

  return (
    <>
      <nav className="tabs">
        {READER_TABS.map((t) => (
          <button
            key={t.id}
            className={`tab ${tab === t.id ? 'tab-active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            <span className="tab-icon">{t.icon}</span> {t.label}
          </button>
        ))}
      </nav>

      {tab === 'books' && (
        broadGenres.length
          ? <ReaderBooks key={broadGenres.join('+')} user={user} broadGenres={broadGenres} onRead={openReader} />
          : (
            <div className="tab-panel">
              <h3>Books</h3>
              <p className="welcome">Pick at least one genre in the Profile tab to see matching books.</p>
            </div>
          )
      )}

      {tab === 'reviews' && <ReaderReviews user={user} />}

      {tab === 'messages' && (
        <div className="tab-panel">
          <h3>Messages</h3>
          <p className="welcome">Chats with authors who pinged you.</p>
          <ChatPanel
            user={user}
            myRole="reader"
            title="💬 Conversations"
            emptyMessage="No conversations yet — authors will message you when they pick you as a beta reader."
          />
        </div>
      )}

      {tab === 'reader' && (
        <div className="tab-panel">
          <div className="reader-tab-header">
            <h3 className="reader-tab-title">
              {readingBook ? `📕 ${readingBook.title}` : '📕 Read'}
            </h3>
            {readingBook && (
              <button className="btn-ghost btn-sm" onClick={() => setReadingBook(null)}>
                ✕ Close
              </button>
            )}
          </div>
          {readingBook && readingBook.viewUrl ? (
            <iframe
              key={readingBook.key || readingBook.id}
              title={readingBook.title}
              src={buildReadOnlyPdfUrl(readingBook.viewUrl)}
              className="reader-tab-frame"
              onContextMenu={(e) => e.preventDefault()}
            />
          ) : (
            <p className="welcome">
              Pick a book from the <strong>Books</strong> tab and click <strong>📖 Read</strong> to open it here.
            </p>
          )}
        </div>
      )}

      {tab === 'profile' && (
        <ReaderProfileForm
          user={user}
          savedProfile={savedProfile}
          setSavedProfile={setSavedProfile}
        />
      )}
    </>
  );
}
