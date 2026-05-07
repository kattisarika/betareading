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
