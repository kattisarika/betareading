const API_BASE = import.meta.env.VITE_API_BASE_URL ?? (import.meta.env.DEV ? 'http://localhost:3001' : '');

export function getUserId(user) {
  return user?.sub || user?.email || 'anonymous';
}

export async function listBooks(userId) {
  const res = await fetch(`${API_BASE}/api/books?userId=${encodeURIComponent(userId)}`);
  if (!res.ok) throw new Error((await res.json()).error || 'Failed to list books');
  return res.json();
}

export async function listBooksByGenre(genre) {
  const res = await fetch(`${API_BASE}/api/books/by-genre?genre=${encodeURIComponent(genre)}`);
  if (!res.ok) throw new Error((await res.json()).error || 'Failed to list books');
  return res.json();
}

export async function findBetaReaders(genre) {
  const qs = genre ? `?genre=${encodeURIComponent(genre)}` : '';
  const res = await fetch(`${API_BASE}/api/readers${qs}`);
  if (!res.ok) throw new Error((await res.json()).error || 'Failed to find readers');
  return res.json();
}

export async function pingReader(payload) {
  const res = await fetch(`${API_BASE}/api/pings`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error((await res.json()).error || 'Failed to ping reader');
  return res.json();
}

export async function listPings({ readerUserId, authorUserId }) {
  const params = new URLSearchParams();
  if (readerUserId) params.set('readerUserId', readerUserId);
  if (authorUserId) params.set('authorUserId', authorUserId);
  const res = await fetch(`${API_BASE}/api/pings?${params.toString()}`);
  if (!res.ok) throw new Error((await res.json()).error || 'Failed to load pings');
  return res.json();
}

export async function listMessages(params) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${API_BASE}/api/messages?${qs}`);
  if (!res.ok) throw new Error((await res.json()).error || 'Failed to load messages');
  return res.json();
}

export async function sendMessage(payload) {
  const res = await fetch(`${API_BASE}/api/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error((await res.json()).error || 'Failed to send message');
  return res.json();
}

export async function listReviews(params) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${API_BASE}/api/reviews?${qs}`);
  if (!res.ok) throw new Error((await res.json()).error || 'Failed to load reviews');
  return res.json();
}

export async function submitReview(payload) {
  const res = await fetch(`${API_BASE}/api/reviews`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error((await res.json()).error || 'Failed to submit review');
  return res.json();
}

export async function generateBookAudio(bookId, userId) {
  const body = userId ? { userId } : {};
  const res = await fetch(`${API_BASE}/api/books/${encodeURIComponent(bookId)}/generate-audio`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error((await res.json()).error || 'Failed to start audio generation');
  return res.json();
}

export async function deleteBook(userId, key) {
  const res = await fetch(
    `${API_BASE}/api/books?userId=${encodeURIComponent(userId)}&key=${encodeURIComponent(key)}`,
    { method: 'DELETE' }
  );
  if (!res.ok) throw new Error((await res.json()).error || 'Delete failed');
  return res.json();
}

export async function presignUpload({ userId, filename, contentType, title, description }) {
  const res = await fetch(`${API_BASE}/api/presign-upload`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, filename, contentType, title, description }),
  });
  if (!res.ok) throw new Error((await res.json()).error || 'Failed to get upload URL');
  return res.json();
}

export async function getUserProfile(userId) {
  const res = await fetch(`${API_BASE}/api/user-profile?userId=${encodeURIComponent(userId)}`);
  if (!res.ok) throw new Error((await res.json()).error || 'Failed to load profile');
  return res.json();
}

export async function saveUserProfile({ userId, email, name, role, genre, genres, favoriteAuthors, ageGroup, qualifications }) {
  const res = await fetch(`${API_BASE}/api/user-profile`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, email, name, role, genre, genres, favoriteAuthors, ageGroup, qualifications }),
  });
  if (!res.ok) throw new Error((await res.json()).error || 'Failed to save profile');
  return res.json();
}

export async function saveBook({ userId, title, description, genre, genres, s3Key, size, authorEmail, authorName }) {
  const res = await fetch(`${API_BASE}/api/books`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, title, description, genre, genres, s3Key, size, authorEmail, authorName }),
  });
  if (!res.ok) throw new Error((await res.json()).error || 'Failed to save book');
  return res.json();
}

export function uploadToS3(url, file, onProgress) {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', url);
    xhr.setRequestHeader('Content-Type', 'application/pdf');
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable && onProgress) onProgress((e.loaded / e.total) * 100);
    };
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve();
      else reject(new Error(`S3 upload failed (${xhr.status})`));
    };
    xhr.onerror = () => reject(new Error('Network error during S3 upload'));
    xhr.send(file);
  });
}
