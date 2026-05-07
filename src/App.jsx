import { useState } from 'react';
import { GoogleLogin } from '@react-oauth/google';
import './App.css';
import { MyBooks, BookReviews, UploadBook, AuthorMessages, AuthorReader } from './components/AuthorTabs';
import ReaderProfile from './components/ReaderProfile';
import FindBetaReader from './components/FindBetaReader';
import { saveUserProfile, getUserId } from './api';

const ROLES = {
  author: { label: 'Author', icon: '✍️', desc: 'Publish & narrate your stories' },
  reader: { label: 'Reader', icon: '📖', desc: 'Listen to immersive readings' },
};

const AUTHOR_TABS = [
  { id: 'books', label: 'My Books', icon: '📚' },
  { id: 'reader', label: 'Read', icon: '📕' },
  { id: 'messages', label: 'Messages', icon: '💬' },
  { id: 'reviews', label: 'Book Reviews', icon: '⭐' },
  { id: 'upload', label: 'Upload Book', icon: '⬆️' },
];

function AuthorTabPanel({ tab, user, refreshKey, onUploaded, onFindBetaReader, onRead, readingBook, onCloseReader }) {
  if (tab === 'books') return <MyBooks user={user} refreshKey={refreshKey} onFindBetaReader={onFindBetaReader} onRead={onRead} />;
  if (tab === 'reader') return <AuthorReader book={readingBook} onClose={onCloseReader} />;
  if (tab === 'messages') return <AuthorMessages user={user} />;
  if (tab === 'reviews') return <BookReviews user={user} />;
  return <UploadBook user={user} onUploaded={onUploaded} />;
}

function decodeJwt(token) {
  try {
    const payload = token.split('.')[1];
    return JSON.parse(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    return null;
  }
}

export default function App() {
  const [role, setRole] = useState(null);
  const [user, setUser] = useState(null);
  const [authorTab, setAuthorTab] = useState('books');
  const [booksRefresh, setBooksRefresh] = useState(0);
  const [findReaderForBook, setFindReaderForBook] = useState(null);
  const [authorReadingBook, setAuthorReadingBook] = useState(null);

  if (user && role) {
    return (
      <div className="app-shell">
        <div className="container container-wide">
          <div className="dashboard">
            <div className="dashboard-header">
              <h1 className="dashboard-title">
                {ROLES[role].icon} {ROLES[role].label} Dashboard
              </h1>
              <button className="btn-ghost" onClick={() => { setUser(null); setRole(null); }}>
                Logout
              </button>
            </div>
            <p className="welcome">Welcome, {user.name || user.email}!</p>

            {role === 'reader' && <ReaderProfile user={user} />}

            {role === 'author' && (
              findReaderForBook ? (
                <FindBetaReader
                  user={user}
                  book={findReaderForBook}
                  onBack={() => setFindReaderForBook(null)}
                />
              ) : (
                <>
                  <nav className="tabs">
                    {AUTHOR_TABS.map((t) => (
                      <button
                        key={t.id}
                        className={`tab ${authorTab === t.id ? 'tab-active' : ''}`}
                        onClick={() => setAuthorTab(t.id)}
                      >
                        <span className="tab-icon">{t.icon}</span> {t.label}
                      </button>
                    ))}
                  </nav>
                  <AuthorTabPanel
                    tab={authorTab}
                    user={user}
                    refreshKey={booksRefresh}
                    onUploaded={() => { setBooksRefresh((n) => n + 1); setAuthorTab('books'); }}
                    onFindBetaReader={(book) => setFindReaderForBook(book)}
                    onRead={(book) => { setAuthorReadingBook(book); setAuthorTab('reader'); }}
                    readingBook={authorReadingBook}
                    onCloseReader={() => setAuthorReadingBook(null)}
                  />
                </>
              )
            )}
          </div>
        </div>
      </div>
    );
  }

  if (role) {
    return (
      <div className="app-shell">
        <div className="container">
          <h1 className="brand-title">Voice Enabled Reading Services</h1>
          <p className="brand-tagline">Continue as {ROLES[role].label}</p>
          <div className="auth-card">
            <h2 className="auth-title">{ROLES[role].icon} Sign in as {ROLES[role].label}</h2>
            <p className="auth-subtitle">Use your Google account to continue</p>
            <div className="google-wrap">
              <GoogleLogin
                onSuccess={(credentialResponse) => {
                  const profile = decodeJwt(credentialResponse.credential);
                  setUser(profile);
                  if (role === 'author' && profile) {
                    saveUserProfile({
                      userId: getUserId(profile),
                      email: profile.email,
                      name: profile.name,
                      role: 'author',
                    }).catch((err) => console.error('Failed to save author profile:', err.message));
                  }
                }}
                onError={() => console.error('Google Login Failed')}
                shape="pill"
                theme="outline"
                size="large"
              />
            </div>
            <button className="btn-ghost" onClick={() => setRole(null)}>
              ← Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <div className="container">
        <div className="hero-art" aria-hidden="true">
          <svg viewBox="0 0 1440 300" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <linearGradient id="bk1" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#8C1515" />
                <stop offset="100%" stopColor="#651014" />
              </linearGradient>
              <linearGradient id="bk2" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#E98300" />
                <stop offset="100%" stopColor="#B8650F" />
              </linearGradient>
              <linearGradient id="bk3" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#0098DB" />
                <stop offset="100%" stopColor="#007C92" />
              </linearGradient>
              <linearGradient id="bk4" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#6FA287" />
                <stop offset="100%" stopColor="#175E54" />
              </linearGradient>
              <linearGradient id="bk5" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#B26F16" />
                <stop offset="100%" stopColor="#5E3032" />
              </linearGradient>
              <radialGradient id="floor" cx="0.5" cy="0.5" r="0.5">
                <stop offset="0%" stopColor="rgba(140,21,21,0.28)" />
                <stop offset="100%" stopColor="rgba(140,21,21,0)" />
              </radialGradient>
            </defs>

            <ellipse cx="720" cy="278" rx="680" ry="16" fill="url(#floor)" />

            <g transform="translate(120 130)">
              <rect x="0" y="100" width="180" height="30" rx="4" fill="url(#bk5)" />
              <rect x="0" y="107" width="180" height="3" fill="rgba(255,255,255,0.25)" />
              <rect x="10" y="70" width="160" height="30" rx="4" fill="url(#bk4)" transform="rotate(-2 90 85)" />
              <rect x="10" y="77" width="160" height="3" fill="rgba(255,255,255,0.25)" transform="rotate(-2 90 85)" />
              <rect x="20" y="40" width="140" height="30" rx="4" fill="url(#bk3)" transform="rotate(3 90 55)" />
              <rect x="20" y="47" width="140" height="3" fill="rgba(255,255,255,0.25)" transform="rotate(3 90 55)" />
            </g>

            <g transform="translate(620 80)">
              <rect x="0" y="140" width="200" height="34" rx="4" fill="url(#bk1)" />
              <rect x="0" y="148" width="200" height="3" fill="rgba(255,255,255,0.25)" />
              <rect x="14" y="108" width="180" height="34" rx="4" fill="url(#bk2)" transform="rotate(-3 104 125)" />
              <rect x="14" y="116" width="180" height="3" fill="rgba(255,255,255,0.25)" transform="rotate(-3 104 125)" />
              <rect x="6" y="76" width="190" height="34" rx="4" fill="url(#bk3)" transform="rotate(2 101 93)" />
              <rect x="6" y="84" width="190" height="3" fill="rgba(255,255,255,0.25)" transform="rotate(2 101 93)" />
              <rect x="22" y="44" width="170" height="34" rx="4" fill="url(#bk4)" transform="rotate(-2 107 61)" />
              <rect x="22" y="52" width="170" height="3" fill="rgba(255,255,255,0.25)" transform="rotate(-2 107 61)" />
              <rect x="34" y="12" width="150" height="34" rx="4" fill="url(#bk5)" transform="rotate(4 109 29)" />
              <rect x="34" y="20" width="150" height="3" fill="rgba(255,255,255,0.25)" transform="rotate(4 109 29)" />
            </g>

            <g transform="translate(1140 110)">
              <rect x="0" y="120" width="170" height="32" rx="4" fill="url(#bk2)" />
              <rect x="0" y="128" width="170" height="3" fill="rgba(255,255,255,0.25)" />
              <rect x="8" y="88" width="160" height="32" rx="4" fill="url(#bk1)" transform="rotate(2 88 104)" />
              <rect x="8" y="96" width="160" height="3" fill="rgba(255,255,255,0.25)" transform="rotate(2 88 104)" />
              <rect x="18" y="56" width="140" height="32" rx="4" fill="url(#bk4)" transform="rotate(-3 88 72)" />
              <rect x="18" y="64" width="140" height="3" fill="rgba(255,255,255,0.25)" transform="rotate(-3 88 72)" />
              <rect x="28" y="24" width="120" height="32" rx="4" fill="url(#bk5)" transform="rotate(2 88 40)" />
              <rect x="28" y="32" width="120" height="3" fill="rgba(255,255,255,0.25)" transform="rotate(2 88 40)" />
            </g>

            <g transform="translate(420 244) rotate(-4)">
              <rect x="0" y="0" width="120" height="22" rx="3" fill="url(#bk3)" />
              <rect x="0" y="5" width="120" height="2" fill="rgba(255,255,255,0.3)" />
            </g>
            <g transform="translate(900 250) rotate(3)">
              <rect x="0" y="0" width="140" height="22" rx="3" fill="url(#bk4)" />
              <rect x="0" y="5" width="140" height="2" fill="rgba(255,255,255,0.3)" />
            </g>

            <circle cx="60" cy="80" r="4" fill="#E98300" opacity="0.7" />
            <circle cx="380" cy="60" r="5" fill="#8C1515" opacity="0.55" />
            <circle cx="560" cy="120" r="3" fill="#0098DB" opacity="0.75" />
            <circle cx="900" cy="50" r="4" fill="#6FA287" opacity="0.7" />
            <circle cx="1080" cy="90" r="3.5" fill="#E98300" opacity="0.7" />
            <circle cx="1380" cy="70" r="4" fill="#8C1515" opacity="0.55" />
            <circle cx="320" cy="220" r="3" fill="#175E54" opacity="0.7" />
            <circle cx="1380" cy="220" r="3" fill="#0098DB" opacity="0.7" />
          </svg>
        </div>
        <h1 className="brand-title">Welcome to Book Club</h1>
        <p className="brand-tagline brand-tagline-accent" style={{ marginBottom: 8 }}>
          Your one stop for any kind of book reading using voice enabled reading service.
        </p>
        <p className="brand-tagline">Choose how you'd like to begin</p>
        <div className="role-grid">
          {Object.entries(ROLES).map(([key, r]) => (
            <div key={key} className="role-card" onClick={() => setRole(key)}>
              <div className="role-icon">{r.icon}</div>
              <div className="role-name">{r.label}</div>
              <p className="role-desc">{r.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
