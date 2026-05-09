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

function Bookshelf() {
  const sections = [
    [
      { x: 14, w: 11, h: 175, c: 1 }, { x: 26, w: 13, h: 188, c: 4 },
      { x: 40, w: 10, h: 170, c: 5 }, { x: 51, w: 12, h: 182, c: 2 },
      { x: 64, w: 11, h: 168, c: 3 }, { x: 76, w: 13, h: 185, c: 1 },
      { x: 90, w: 8,  h: 165, c: 4 },
    ],
    [
      { x: 14, w: 12, h: 180, c: 5 }, { x: 27, w: 10, h: 168, c: 3 },
      { x: 38, w: 13, h: 188, c: 2 }, { x: 52, w: 11, h: 175, c: 1 },
      { x: 64, w: 12, h: 184, c: 4 }, { x: 77, w: 10, h: 170, c: 5 },
      { x: 88, w: 10, h: 178, c: 2 },
    ],
    [
      { x: 14, w: 13, h: 186, c: 3 }, { x: 28, w: 11, h: 174, c: 1 },
      { x: 40, w: 12, h: 182, c: 4 }, { x: 53, w: 10, h: 168, c: 5 },
      { x: 64, w: 13, h: 188, c: 2 }, { x: 78, w: 11, h: 176, c: 3 },
      { x: 90, w: 8,  h: 165, c: 1 },
    ],
    [
      { x: 14, w: 11, h: 172, c: 2 }, { x: 26, w: 13, h: 188, c: 5 },
      { x: 40, w: 10, h: 168, c: 1 }, { x: 51, w: 12, h: 184, c: 3 },
      { x: 64, w: 11, h: 174, c: 4 }, { x: 76, w: 13, h: 186, c: 2 },
      { x: 90, w: 8,  h: 168, c: 5 },
    ],
    [
      { x: 14, w: 12, h: 178, c: 4 }, { x: 27, w: 10, h: 170, c: 2 },
      { x: 38, w: 13, h: 186, c: 1 }, { x: 52, w: 11, h: 174, c: 5 },
      { x: 64, w: 12, h: 184, c: 3 }, { x: 77, w: 11, h: 178, c: 4 },
      { x: 89, w: 9,  h: 168, c: 1 },
    ],
  ];
  const planks = [200, 400, 600, 800, 1000];
  return (
    <svg viewBox="0 0 110 1000" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="wood-frame" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="#3D1F0A" />
          <stop offset="50%" stopColor="#7A4A1F" />
          <stop offset="100%" stopColor="#3D1F0A" />
        </linearGradient>
        <linearGradient id="wood-plank" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7A4A1F" />
          <stop offset="100%" stopColor="#3D1F0A" />
        </linearGradient>
        <linearGradient id="sb1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#A82020" /><stop offset="100%" stopColor="#651014" />
        </linearGradient>
        <linearGradient id="sb2" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F39C2F" /><stop offset="100%" stopColor="#B8650F" />
        </linearGradient>
        <linearGradient id="sb3" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#33ABE0" /><stop offset="100%" stopColor="#007C92" />
        </linearGradient>
        <linearGradient id="sb4" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#7DB397" /><stop offset="100%" stopColor="#175E54" />
        </linearGradient>
        <linearGradient id="sb5" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#C28432" /><stop offset="100%" stopColor="#5E3032" />
        </linearGradient>
      </defs>
      <rect x="0" y="0" width="110" height="1000" fill="url(#wood-frame)" />
      <rect x="0" y="0" width="14" height="1000" fill="#3D1F0A" />
      <rect x="96" y="0" width="14" height="1000" fill="#3D1F0A" />
      <rect x="0" y="0" width="110" height="12" fill="#5E3014" />
      {planks.map((y, i) => (
        <g key={`p${i}`}>
          <rect x="0" y={y} width="110" height="9" fill="url(#wood-plank)" />
          <rect x="0" y={y + 9} width="110" height="2" fill="rgba(0,0,0,0.35)" />
        </g>
      ))}
      {sections.map((books, i) => (
        <g key={`s${i}`} transform={`translate(0 ${planks[i]})`}>
          {books.map((b, j) => (
            <rect key={j} x={b.x} y={-b.h} width={b.w} height={b.h} rx="1.5" fill={`url(#sb${b.c})`} />
          ))}
        </g>
      ))}
    </svg>
  );
}

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
    <div className="app-shell landing-shell">
      <aside className="bookshelf bookshelf-left" aria-hidden="true">
        <Bookshelf />
      </aside>
      <aside className="bookshelf bookshelf-right" aria-hidden="true">
        <Bookshelf />
      </aside>
      <div className="container landing-container">
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
        <p className="brand-community">A platform connecting authors with beta readers</p>
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
        <footer className="landing-footer">
          <div className="footer-inner">
            <div className="footer-brand">
              <span className="footer-logo">📚 Book Club</span>
              <p className="footer-tag">Voice-enabled reading for every story.</p>
            </div>
            <div className="footer-cols">
              <div className="footer-col">
                <h4>Product</h4>
                <a href="#authors">For Authors</a>
                <a href="#readers">For Readers</a>
                <a href="#voice">Voice Reader</a>
              </div>
              <div className="footer-col">
                <h4>Company</h4>
                <a href="#about">About</a>
                <a href="#contact">Contact</a>
                <a href="#privacy">Privacy</a>
              </div>
              <div className="footer-col">
                <h4>Connect</h4>
                <a href="#twitter">Twitter</a>
                <a href="#instagram">Instagram</a>
                <a href="#github">GitHub</a>
              </div>
            </div>
          </div>
          <div className="footer-bottom">
            © {new Date().getFullYear()} Book Club · Made with <span aria-hidden="true">❤️</span> for readers everywhere.
          </div>
        </footer>
      </div>
    </div>
  );
}
