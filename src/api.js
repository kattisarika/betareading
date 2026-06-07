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

export async function superAdminLogin({ userId, email, name }) {
  const res = await fetch(`${API_BASE}/api/super-admin-login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, email, name }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Not authorized');
  return res.json();
}

async function adminGet(path, adminUserId, extraParams = {}) {
  const params = new URLSearchParams({ adminUserId, ...extraParams });
  const res = await fetch(`${API_BASE}${path}?${params.toString()}`);
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Request failed');
  return res.json();
}

async function adminPost(path, adminUserId, body = {}) {
  const res = await fetch(`${API_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ adminUserId, ...body }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Request failed');
  return res.json();
}

export const adminApi = {
  users: (adminUserId) => adminGet('/api/admin/users', adminUserId),
  books: (adminUserId) => adminGet('/api/admin/books', adminUserId),
  pings: (adminUserId) => adminGet('/api/admin/pings', adminUserId),
  messages: (adminUserId, params = {}) => adminGet('/api/admin/messages', adminUserId, params),
  reviews: (adminUserId) => adminGet('/api/admin/reviews', adminUserId),
  groupMessages: (adminUserId, params = {}) => adminGet('/api/admin/group-messages', adminUserId, params),
  stats: (adminUserId) => adminGet('/api/admin/stats', adminUserId),
  adminMessages: (adminUserId) => adminGet('/api/admin/admin-messages', adminUserId),
  blockUser: (adminUserId, userId, reason = '') =>
    adminPost(`/api/admin/users/${encodeURIComponent(userId)}/block`, adminUserId, { reason }),
  unblockUser: (adminUserId, userId) =>
    adminPost(`/api/admin/users/${encodeURIComponent(userId)}/unblock`, adminUserId),
  sendMessage: (adminUserId, recipientUserId, text) =>
    adminPost('/api/admin/messages/send', adminUserId, { recipientUserId, text }),
  rescanBook: (adminUserId, bookId) =>
    adminPost(`/api/admin/books/${encodeURIComponent(bookId)}/rescan`, adminUserId),
  rescanAll: (adminUserId) =>
    adminPost('/api/admin/rescan-all', adminUserId),
};

export function flagCategoryList(contentFlags) {
  if (!contentFlags || typeof contentFlags !== 'object') return [];
  return Object.entries(contentFlags)
    .map(([key, v]) => ({
      key,
      label: v?.label || key,
      count: Number(v?.count) || 0,
      excerpts: Array.isArray(v?.excerpts) ? v.excerpts : [],
    }))
    .filter((f) => f.count > 0)
    .sort((a, b) => b.count - a.count);
}

export async function checkAccess({ userId, email }) {
  const res = await fetch(`${API_BASE}/api/check-access`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, email }),
  });
  const data = await res.json().catch(() => ({}));
  if (res.status === 403 && data?.blocked) {
    const err = new Error(data.error || 'Your access has been revoked.');
    err.blocked = true;
    throw err;
  }
  if (!res.ok) throw new Error(data?.error || 'Access check failed');
  return data;
}

export async function getInbox(userId) {
  const res = await fetch(`${API_BASE}/api/inbox?userId=${encodeURIComponent(userId)}`);
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed to load inbox');
  return res.json();
}

export async function markInboxRead(userId, messageId) {
  const res = await fetch(`${API_BASE}/api/inbox/read`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, messageId }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed to mark read');
  return res.json();
}

export async function listGroups(userId) {
  const res = await fetch(`${API_BASE}/api/groups?userId=${encodeURIComponent(userId)}`);
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed to load groups');
  return res.json();
}

export async function joinGroup(userId, genre) {
  const res = await fetch(`${API_BASE}/api/groups/${encodeURIComponent(genre)}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed to join group');
  return res.json();
}

export async function leaveGroup(userId, genre) {
  const res = await fetch(`${API_BASE}/api/groups/${encodeURIComponent(genre)}/leave`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed to leave group');
  return res.json();
}

export async function listGroupMembers(userId, genre) {
  const res = await fetch(`${API_BASE}/api/groups/${encodeURIComponent(genre)}/members?userId=${encodeURIComponent(userId)}`);
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed to load members');
  return res.json();
}

export async function listGroupMessages(userId, genre) {
  const res = await fetch(`${API_BASE}/api/groups/${encodeURIComponent(genre)}/messages?userId=${encodeURIComponent(userId)}`);
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed to load messages');
  return res.json();
}

export async function sendGroupMessage(userId, genre, text) {
  const res = await fetch(`${API_BASE}/api/groups/${encodeURIComponent(genre)}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, text }),
  });
  if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || 'Failed to send message');
  return res.json();
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result || '');
      const i = result.indexOf(',');
      resolve(i >= 0 ? result.slice(i + 1) : result);
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

export const linkedinApi = {
  status: async (userId) => {
    const r = await fetch(`${API_BASE}/api/linkedin/status?userId=${encodeURIComponent(userId)}`);
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Failed to load LinkedIn status');
    return r.json();
  },
  authUrl: async (userId) => {
    const r = await fetch(`${API_BASE}/api/linkedin/auth-url?userId=${encodeURIComponent(userId)}`);
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Failed to get auth URL');
    return r.json();
  },
  disconnect: async (userId) => {
    const r = await fetch(`${API_BASE}/api/linkedin/disconnect`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId }),
    });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Failed to disconnect');
    return r.json();
  },
  post: async ({ userId, text, imageFile }) => {
    let imageBase64, imageContentType;
    if (imageFile) {
      imageBase64 = await fileToBase64(imageFile);
      imageContentType = imageFile.type || 'image/jpeg';
    }
    const r = await fetch(`${API_BASE}/api/linkedin/post`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, text, imageBase64, imageContentType }),
    });
    if (!r.ok) throw new Error((await r.json().catch(() => ({}))).error || 'Failed to post to LinkedIn');
    return r.json();
  },
};


