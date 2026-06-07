import { useCallback, useEffect, useState } from 'react';
import { listReviews, submitReview, getUserId } from '../api';

function StarRow({ value, onChange, readOnly }) {
  return (
    <div className="star-rating" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          type="button"
          key={n}
          className={`star ${n <= value ? 'star-on' : ''}`}
          onClick={readOnly ? undefined : () => onChange(n)}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
          disabled={readOnly}
        >
          ★
        </button>
      ))}
    </div>
  );
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
        bookId: `gb:${book.id}`,
        bookTitle: book.title,
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
      <StarRow value={rating} onChange={setRating} />
      <textarea
        rows="3"
        value={text}
        onChange={(e) => setText(e.target.value)}
        placeholder="Share your thoughts about this book…"
      />
      {error && <div className="reader-card-error">{error}</div>}
      <button className="btn-primary btn-sm" type="submit" disabled={saving}>
        {saving ? 'Saving…' : existing ? 'Update Review' : 'Submit Review'}
      </button>
    </form>
  );
}

export default function BookDetailModal({ book, user, onClose }) {
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const myId = getUserId(user);
  const existing = reviews.find((r) => r.reviewerUserId === myId) || null;

  const load = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const { reviews: list } = await listReviews({ bookId: `gb:${book.id}` });
      setReviews(list || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [book.id]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel book-modal" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">×</button>
        <div className="book-modal-head">
          {book.thumbnail ? (
            <img src={book.thumbnail} alt={book.title} className="book-modal-cover" />
          ) : (
            <div className="book-modal-cover discover-cover-placeholder">📕</div>
          )}
          <div className="book-modal-meta">
            <h3 className="book-modal-title">{book.title}</h3>
            {book.authors && <p className="discover-authors">{book.authors}</p>}
            {book.rating != null && (
              <p className="discover-rating">
                <span className="stars-gold">{'★'.repeat(Math.round(book.rating))}</span>
                <span className="stars-empty">{'☆'.repeat(5 - Math.round(book.rating))}</span>
                <small> Google: {book.rating.toFixed(1)} ({book.ratingsCount})</small>
              </p>
            )}
            <div className="discover-meta">
              {book.publisher && <small>{book.publisher}</small>}
              {book.publishedDate && <small>{book.publishedDate.slice(0, 4)}</small>}
              {book.pageCount && <small>{book.pageCount} pages</small>}
            </div>
            {book.infoLink && (
              <a href={book.infoLink} target="_blank" rel="noreferrer" className="btn-ghost btn-sm">
                View on Google Books ↗
              </a>
            )}
          </div>
        </div>

        {book.description && (
          <div className="book-modal-section">
            <h4>About this book</h4>
            <p className="book-modal-desc" dangerouslySetInnerHTML={{ __html: book.description }} />
          </div>
        )}

        <div className="book-modal-section">
          <h4>{existing ? 'Your Flipp review' : 'Write a review'}</h4>
          <ReviewForm user={user} book={book} existing={existing} onSaved={load} />
        </div>

        <div className="book-modal-section">
          <h4>Flipp reviews ({reviews.length})</h4>
          {loading && <p className="welcome">Loading…</p>}
          {error && <div className="flash flash-error">{error}</div>}
          {!loading && reviews.length === 0 && <p className="welcome">No reviews yet — be the first!</p>}
          <ul className="review-list">
            {reviews.map((r) => (
              <li key={r._id} className="review-item">
                <div className="review-head">
                  <strong>{r.reviewerName || 'Reader'}</strong>
                  <StarRow value={r.rating} readOnly />
                </div>
                {r.text && <p className="review-text">{r.text}</p>}
                <small className="review-date">{new Date(r.createdAt).toLocaleDateString()}</small>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}
