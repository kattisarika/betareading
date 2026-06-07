import { useCallback, useEffect, useState } from 'react';
import { FICTION_SUBGENRES, NON_FICTION_SUBGENRES } from '../constants/genres';
import BookDetailModal from './BookDetailModal';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.DEV ? 'http://localhost:3001' : '');
const MAX_RESULTS = 24;

const GENRE_QUERY = {
  action: 'action', adventure: 'adventure', drama: 'drama', fantasy: 'fantasy',
  historical_fiction: 'historical fiction', horror: 'horror', humor: 'humor',
  literary_fiction: 'literary fiction', mystery: 'mystery', poetry: 'poetry',
  romance: 'romance', scifi: 'science fiction', thriller: 'thriller',
  young_adult: 'young adult', kids: 'juvenile fiction', erotica: 'erotica',
  lgbtq: 'LGBTQ', other: 'fiction',
  memoir: 'memoir', biography: 'biography', self_help: 'self help',
  history: 'history', science: 'science', business: 'business',
  cooking: 'cooking', travel: 'travel',
};

function normalize(volume) {
  const v = volume?.volumeInfo || {};
  return {
    id: volume.id,
    title: v.title || 'Untitled',
    authors: Array.isArray(v.authors) ? v.authors.join(', ') : '',
    publisher: v.publisher || '',
    publishedDate: v.publishedDate || '',
    description: v.description || '',
    pageCount: v.pageCount || null,
    rating: v.averageRating || null,
    ratingsCount: v.ratingsCount || 0,
    thumbnail: (v.imageLinks?.thumbnail || v.imageLinks?.smallThumbnail || '').replace('http://', 'https://'),
    infoLink: v.infoLink || v.previewLink || '',
    previewLink: v.previewLink || '',
  };
}

async function searchGoogleBooks(query) {
  const url = `${API_BASE}/api/google-books?q=${encodeURIComponent(query)}&max=${MAX_RESULTS}`;
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data?.error || `Google Books API error (${res.status})`);
  return (data.items || []).map(normalize);
}

export default function DiscoverBooks({ user }) {
  const [query, setQuery] = useState('');
  const [activeGenre, setActiveGenre] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [didSearch, setDidSearch] = useState(false);
  const [selectedBook, setSelectedBook] = useState(null);

  const runSearch = useCallback(async (q) => {
    if (!q || !q.trim()) return;
    setLoading(true); setError(null); setDidSearch(true);
    try {
      const items = await searchGoogleBooks(q);
      setResults(items);
    } catch (err) {
      setError(err.message); setResults([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Default landing search so the tab isn't empty
    runSearch('bestsellers');
  }, [runSearch]);

  const onSubmit = (e) => {
    e.preventDefault();
    setActiveGenre('');
    runSearch(query);
  };

  const onGenreClick = (g) => {
    setActiveGenre(g.value);
    setQuery('');
    runSearch(`subject:"${GENRE_QUERY[g.value] || g.label}"`);
  };

  return (
    <div className="tab-panel">
      <h3>🌐 Discover Books</h3>
      <p className="welcome">Search millions of books from Google Books — find your next read.</p>

      <form className="discover-search" onSubmit={onSubmit}>
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by title, author, or keyword…"
          className="discover-search-input"
        />
        <button type="submit" className="btn-primary" disabled={loading}>
          {loading ? 'Searching…' : 'Search'}
        </button>
      </form>

      <div className="discover-genre-chips">
        {[...FICTION_SUBGENRES, ...NON_FICTION_SUBGENRES].map((g) => (
          <button
            key={g.value}
            type="button"
            className={`discover-chip ${activeGenre === g.value ? 'discover-chip-active' : ''}`}
            onClick={() => onGenreClick(g)}
          >
            {g.label}
          </button>
        ))}
      </div>

      {error && <div className="flash flash-error">{error}</div>}
      {loading && <p className="welcome">Loading books…</p>}
      {!loading && didSearch && results.length === 0 && !error && (
        <p className="welcome">No books found. Try a different search.</p>
      )}

      <div className="discover-grid">
        {results.map((b) => (
          <article
            key={b.id}
            className="discover-card discover-card-clickable"
            onClick={() => setSelectedBook(b)}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedBook(b); } }}
          >
            {b.thumbnail ? (
              <img src={b.thumbnail} alt={b.title} className="discover-cover" />
            ) : (
              <div className="discover-cover discover-cover-placeholder">📕</div>
            )}
            <div className="discover-card-body">
              <h4 className="discover-title">{b.title}</h4>
              {b.authors && <p className="discover-authors">{b.authors}</p>}
              {b.rating != null && (
                <p className="discover-rating">
                  <span className="stars-gold">{'★'.repeat(Math.round(b.rating))}</span>
                  <span className="stars-empty">{'☆'.repeat(5 - Math.round(b.rating))}</span>
                  <small> {b.rating.toFixed(1)} ({b.ratingsCount})</small>
                </p>
              )}
              {b.description && <p className="discover-desc">{b.description.slice(0, 180)}{b.description.length > 180 ? '…' : ''}</p>}
              <div className="discover-meta">
                {b.publishedDate && <small>{b.publishedDate.slice(0, 4)}</small>}
                {b.pageCount && <small>{b.pageCount} pages</small>}
              </div>
              <span className="discover-card-cta">View &amp; review →</span>
            </div>
          </article>
        ))}
      </div>

      {selectedBook && (
        <BookDetailModal book={selectedBook} user={user} onClose={() => setSelectedBook(null)} />
      )}
    </div>
  );
}
