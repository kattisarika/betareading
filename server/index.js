import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import dotenv from 'dotenv';
const __dirname = dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: join(__dirname, '.env') });

import express from 'express';
import cors from 'cors';
import { connectMongo, UserProfile, Book, Ping, Message, Review, BlockedEmail, AdminMessage, GroupMembership, GroupMessage, LinkedInConnection } from './db.js';
import {
  S3Client,
  ListObjectsV2Command,
  HeadObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { generateAudioForBook, scanBookContent } from './tts.js';
import { getAuthUrl as linkedinAuthUrl, exchangeCode as linkedinExchange, postTextOnly as linkedinPostText, postWithImage as linkedinPostImage } from './linkedin.js';

const TTS_AUTO = String(process.env.TTS_AUTO || 'true').toLowerCase() === 'true';

const {
  PORT = 3001,
  CORS_ORIGIN = 'http://localhost:5173',
  AWS_REGION,
  AWS_S3_BUCKET,
  AWS_ACCESS_KEY_ID,
  AWS_SECRET_ACCESS_KEY,
  MONGODB_URI,
  SUPER_ADMIN_EMAIL = '',
  LINKEDIN_CLIENT_ID,
  LINKEDIN_CLIENT_SECRET,
  LINKEDIN_REDIRECT_URI,
  GOOGLE_BOOKS_API_KEY,
} = process.env;

const LINKEDIN_CONFIGURED = Boolean(LINKEDIN_CLIENT_ID && LINKEDIN_CLIENT_SECRET && LINKEDIN_REDIRECT_URI);
if (!LINKEDIN_CONFIGURED) {
  console.warn('⚠️  LinkedIn env vars missing — Post Content → LinkedIn will be disabled.');
}

const SUPER_ADMIN_EMAIL_NORMALIZED = SUPER_ADMIN_EMAIL.trim().toLowerCase();

if (MONGODB_URI) {
  connectMongo(MONGODB_URI).catch((e) => console.error('Mongo connect error:', e.message));
} else {
  console.warn('⚠️  MONGODB_URI not set — reader profile endpoints will fail.');
}

if (!AWS_REGION || !AWS_S3_BUCKET || !AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
  console.warn('⚠️  Missing AWS env vars in server/.env — uploads will fail.');
}

const s3 = new S3Client({
  region: AWS_REGION,
  credentials: { accessKeyId: AWS_ACCESS_KEY_ID, secretAccessKey: AWS_SECRET_ACCESS_KEY },
});

const app = express();
app.use(cors({ origin: CORS_ORIGIN }));
app.use(express.json({ limit: '12mb' }));

const SIGN_EXPIRES = 60 * 5; // 5 minutes

const sanitize = (s) => String(s || '').replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 200);
const userPrefix = (userId) => `books/${sanitize(userId) || 'anonymous'}/`;

// Genre taxonomy — shared by readers (interests) and books (tags)
const ROLES = ['reader', 'author'];
const GENRES = ['fiction', 'non_fiction'];
const FICTION_SUBGENRES = [
  'action', 'adventure', 'drama', 'erotica', 'fantasy', 'historical_fiction',
  'horror', 'humor', 'lgbtq', 'literary_fiction', 'mystery', 'other', 'poetry',
  'romance', 'scifi', 'thriller', 'young_adult', 'kids',
];
const NON_FICTION_SUBGENRES = [
  'memoir', 'biography', 'self_help', 'history', 'science', 'business',
  'cooking', 'travel',
];
const ALL_READER_GENRES = new Set([...GENRES, ...FICTION_SUBGENRES, ...NON_FICTION_SUBGENRES]);
const ALL_SUBGENRES = [...FICTION_SUBGENRES, ...NON_FICTION_SUBGENRES];
const ALL_SUBGENRES_SET = new Set(ALL_SUBGENRES);
const READER_AGE_GROUPS = new Set(['kids', 'preteens_13', 'teenager_18', 'adults_25']);

function deriveBroadGenre(genres) {
  if (!Array.isArray(genres) || genres.length === 0) return null;
  if (genres.some((g) => FICTION_SUBGENRES.includes(g))) return 'fiction';
  if (genres.includes('non_fiction') || genres.some((g) => NON_FICTION_SUBGENRES.includes(g))) return 'non_fiction';
  return null;
}

async function audioUrlFor(book) {
  if (!book.audioS3Key || book.audioStatus !== 'ready') return null;
  return getSignedUrl(
    s3,
    new GetObjectCommand({ Bucket: AWS_S3_BUCKET, Key: book.audioS3Key }),
    { expiresIn: SIGN_EXPIRES }
  );
}

async function audioChaptersFor(book) {
  if (book.audioStatus !== 'ready' || !Array.isArray(book.audioChapters) || !book.audioChapters.length) return null;
  return Promise.all(book.audioChapters.map(async (ch) => ({
    title: ch.title,
    chars: ch.chars,
    audioUrl: await getSignedUrl(
      s3,
      new GetObjectCommand({ Bucket: AWS_S3_BUCKET, Key: ch.audioS3Key }),
      { expiresIn: SIGN_EXPIRES }
    ),
  })));
}

function kickOffTTS(bookId) {
  if (!TTS_AUTO) return;
  generateAudioForBook({ s3, bucket: AWS_S3_BUCKET, region: AWS_REGION, bookId })
    .catch((e) => console.error('TTS background error:', e.message));
}

app.get('/health', (_req, res) => res.json({ ok: true }));

// 1. Get a pre-signed URL to PUT a PDF directly to S3
app.post('/api/presign-upload', async (req, res) => {
  try {
    const { userId, filename, contentType, title = '', description = '' } = req.body || {};
    if (!filename) return res.status(400).json({ error: 'filename required' });
    if (contentType && contentType !== 'application/pdf') {
      return res.status(400).json({ error: 'Only application/pdf allowed' });
    }
    const key = `${userPrefix(userId)}${Date.now()}-${sanitize(filename)}`;
    const cmd = new PutObjectCommand({
      Bucket: AWS_S3_BUCKET,
      Key: key,
      ContentType: 'application/pdf',
      Metadata: { title: encodeURIComponent(title), description: encodeURIComponent(description) },
    });
    const url = await getSignedUrl(s3, cmd, { expiresIn: SIGN_EXPIRES });
    res.json({ url, key });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 2. List a user's books from MongoDB with pre-signed GET URLs for viewing
app.get('/api/books', async (req, res) => {
  try {
    const userId = req.query.userId;
    if (!userId) return res.status(400).json({ error: 'userId required' });
    const docs = await Book.find({ userId }).sort({ createdAt: -1 }).lean();
    const items = await Promise.all(docs.map(async (b) => {
      const [viewUrl, audioUrl, audioChapters] = await Promise.all([
        getSignedUrl(
          s3,
          new GetObjectCommand({ Bucket: AWS_S3_BUCKET, Key: b.s3Key }),
          { expiresIn: SIGN_EXPIRES }
        ),
        audioUrlFor(b),
        audioChaptersFor(b),
      ]);
      return {
        key: b.s3Key,
        id: String(b._id),
        title: b.title,
        description: b.description || '',
        genre: b.genre,
        genres: b.genres || [],
        size: b.size,
        updated: b.updatedAt || b.createdAt,
        viewUrl,
        audioUrl,
        audioChapters,
        audioStatus: b.audioStatus || 'pending',
        audioError: b.audioError || null,
        contentFlags: b.contentFlags || null,
        contentScanStatus: b.contentScanStatus || 'pending',
      };
    }));
    res.json({ items });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 3. Save book metadata after S3 upload completes
app.post('/api/books', async (req, res) => {
  try {
    const { userId, title, description, genre, genres, s3Key, size, authorEmail, authorName } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'userId required' });
    if (!title || !title.trim()) return res.status(400).json({ error: 'title required' });
    if (!s3Key || !s3Key.startsWith(userPrefix(userId))) {
      return res.status(400).json({ error: 'Invalid s3Key' });
    }
    let normalizedGenres = null;
    let broadGenre = null;
    if (Array.isArray(genres) && genres.length) {
      normalizedGenres = Array.from(new Set(genres.filter((g) => ALL_READER_GENRES.has(g))));
      if (!normalizedGenres.length) return res.status(400).json({ error: 'No valid genres provided' });
      broadGenre = deriveBroadGenre(normalizedGenres);
    } else if (GENRES.includes(genre)) {
      broadGenre = genre;
      normalizedGenres = [genre];
    } else {
      return res.status(400).json({ error: 'Invalid genre/genres' });
    }
    const book = await Book.create({
      userId,
      role: 'author',
      title: title.trim(),
      description: (description || '').trim(),
      genre: broadGenre,
      genres: normalizedGenres,
      s3Key,
      size,
      authorEmail,
      authorName,
      audioStatus: 'pending',
    });
    res.json({ book });
    kickOffTTS(String(book._id));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 3c. Manually (re-)trigger audio generation for a book — useful for books
// uploaded before the TTS feature existed, or to retry after a failure.
app.post('/api/books/:id/generate-audio', async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body || {};
    const book = await Book.findById(id);
    if (!book) return res.status(404).json({ error: 'Book not found' });
    if (userId && book.userId !== userId) return res.status(403).json({ error: 'Forbidden' });
    if (book.audioStatus === 'processing') {
      return res.json({ ok: true, status: 'processing' });
    }
    await Book.updateOne({ _id: id }, { $set: { audioStatus: 'pending', audioError: null } });
    res.json({ ok: true, status: 'pending' });
    generateAudioForBook({ s3, bucket: AWS_S3_BUCKET, region: AWS_REGION, bookId: id })
      .catch((e) => console.error('TTS background error:', e.message));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 3b. List all books in a given broad genre (for readers to browse).
// Matches books tagged with the broad category OR any subgenre within it.
app.get('/api/books/by-genre', async (req, res) => {
  try {
    const { genre } = req.query;
    if (!GENRES.includes(genre)) return res.status(400).json({ error: 'Invalid genre' });
    const matches = genre === 'fiction'
      ? ['fiction', ...FICTION_SUBGENRES]
      : ['non_fiction', ...NON_FICTION_SUBGENRES];
    const docs = await Book.find({
      $or: [{ genre }, { genres: { $in: matches } }],
    }).sort({ createdAt: -1 }).lean();
    const items = await Promise.all(docs.map(async (b) => {
      const [viewUrl, audioUrl, audioChapters] = await Promise.all([
        getSignedUrl(
          s3,
          new GetObjectCommand({ Bucket: AWS_S3_BUCKET, Key: b.s3Key }),
          { expiresIn: SIGN_EXPIRES }
        ),
        audioUrlFor(b),
        audioChaptersFor(b),
      ]);
      return {
        key: b.s3Key,
        id: String(b._id),
        title: b.title,
        description: b.description || '',
        genre: b.genre,
        genres: b.genres || [],
        size: b.size,
        updated: b.updatedAt || b.createdAt,
        authorName: b.authorName || '',
        authorUserId: b.userId,
        viewUrl,
        audioUrl,
        audioChapters,
        audioStatus: b.audioStatus || 'pending',
        audioError: b.audioError || null,
        contentFlags: b.contentFlags || null,
        contentScanStatus: b.contentScanStatus || 'pending',
      };
    }));
    res.json({ items });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 4. Delete a book from both MongoDB and S3 (key must belong to userId)
app.delete('/api/books', async (req, res) => {
  try {
    const { userId, key } = req.query;
    if (!userId || !key) return res.status(400).json({ error: 'userId and key required' });
    if (!key.startsWith(userPrefix(userId))) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const doc = await Book.findOne({ userId, s3Key: key }).lean();
    await Book.deleteOne({ userId, s3Key: key });
    await s3.send(new DeleteObjectCommand({ Bucket: AWS_S3_BUCKET, Key: key }));
    const audioKeys = new Set();
    if (doc?.audioS3Key) audioKeys.add(doc.audioS3Key);
    for (const ch of doc?.audioChapters || []) if (ch?.audioS3Key) audioKeys.add(ch.audioS3Key);
    for (const k of audioKeys) {
      try { await s3.send(new DeleteObjectCommand({ Bucket: AWS_S3_BUCKET, Key: k })); }
      catch (e) { console.warn('Failed to delete audio object:', k, e.message); }
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 4. User profile (MongoDB) — role + optional genre/genres for readers
app.get('/api/user-profile', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId required' });
    const profile = await UserProfile.findOne({ userId }).lean();
    res.json({ profile: profile || null });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// List readers matching a broad genre (used by authors to find beta readers).
// Matches either the legacy `genre` field or the new `genres` subgenre array.
app.get('/api/readers', async (req, res) => {
  try {
    const { genre } = req.query;
    const query = { role: 'reader' };
    if (genre) {
      if (!GENRES.includes(genre)) return res.status(400).json({ error: 'Invalid genre' });
      const matches = genre === 'fiction'
        ? ['fiction', ...FICTION_SUBGENRES]
        : ['non_fiction', ...NON_FICTION_SUBGENRES];
      query.$or = [{ genre }, { genres: { $in: matches } }];
    }
    const readers = await UserProfile.find(query)
      .select('userId name email genre genres createdAt')
      .sort({ createdAt: -1 })
      .lean();
    res.json({ readers });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/user-profile', async (req, res) => {
  try {
    const { userId, email, name, role, genre, genres, favoriteAuthors, ageGroup, qualifications } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'userId required' });
    if (!ROLES.includes(role)) return res.status(400).json({ error: 'Invalid role' });
    if (await isAccessRevoked({ userId, email })) {
      return res.status(403).json({ error: 'Your access has been revoked. Contact support if you believe this is in error.' });
    }
    let normalizedGenres = null;
    let broadGenre = null;
    let trimmedAuthors = '';
    let trimmedQualifications = '';
    if (role === 'reader') {
      if (Array.isArray(genres) && genres.length) {
        normalizedGenres = Array.from(new Set(genres.filter((g) => ALL_READER_GENRES.has(g))));
        if (!normalizedGenres.length) return res.status(400).json({ error: 'No valid genres provided' });
        broadGenre = deriveBroadGenre(normalizedGenres);
      } else if (GENRES.includes(genre)) {
        broadGenre = genre;
        normalizedGenres = [genre];
      } else {
        return res.status(400).json({ error: 'Invalid genre/genres for reader' });
      }
      trimmedAuthors = typeof favoriteAuthors === 'string' ? favoriteAuthors.trim() : '';
      if (!trimmedAuthors) return res.status(400).json({ error: 'favoriteAuthors required' });
      if (!READER_AGE_GROUPS.has(ageGroup)) return res.status(400).json({ error: 'Invalid ageGroup' });
      trimmedQualifications = typeof qualifications === 'string' ? qualifications.trim() : '';
      if (!trimmedQualifications) return res.status(400).json({ error: 'qualifications required' });
    }
    const update = { userId, email, name, role };
    if (role === 'reader') {
      update.genre = broadGenre;
      update.genres = normalizedGenres;
      update.favoriteAuthors = trimmedAuthors;
      update.ageGroup = ageGroup;
      update.qualifications = trimmedQualifications;
    } else {
      update.$unset = { genre: '', genres: '', favoriteAuthors: '', ageGroup: '', qualifications: '' };
    }
    const profile = await UserProfile.findOneAndUpdate(
      { userId },
      update,
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json({ profile });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 5. Pings (author -> reader beta-read invitation)
app.post('/api/pings', async (req, res) => {
  try {
    const {
      bookId, bookTitle, bookGenre,
      authorUserId, authorName, authorEmail,
      readerUserId, readerName,
      message,
    } = req.body || {};
    if (!bookId || !bookTitle || !authorUserId || !readerUserId) {
      return res.status(400).json({ error: 'bookId, bookTitle, authorUserId, readerUserId required' });
    }
    if (!GENRES.includes(bookGenre)) return res.status(400).json({ error: 'Invalid bookGenre' });
    const initialText =
      message ||
      `Hi ${readerName || 'there'}, I'd love your feedback on my book "${bookTitle}". Are you available to be my beta reader?`;
    const ping = await Ping.findOneAndUpdate(
      { bookId, readerUserId },
      {
        bookId, bookTitle, bookGenre,
        authorUserId, authorName, authorEmail,
        readerUserId, readerName,
        message: initialText,
        status: 'pending',
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    // Send the initial chat message from author -> reader
    const existing = await Message.findOne({ bookId, authorUserId, readerUserId, fromUserId: authorUserId });
    if (!existing) {
      await Message.create({
        bookId, bookTitle,
        authorUserId, authorName,
        readerUserId, readerName,
        fromUserId: authorUserId, fromName: authorName, fromRole: 'author',
        text: initialText,
      });
    }
    res.json({ ping });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 6. Chat messages
app.get('/api/messages', async (req, res) => {
  try {
    const { userId, bookId, authorUserId, readerUserId } = req.query;
    let query;
    if (bookId && authorUserId && readerUserId) {
      query = { bookId, authorUserId, readerUserId };
    } else if (userId) {
      query = { $or: [{ authorUserId: userId }, { readerUserId: userId }] };
    } else {
      return res.status(400).json({ error: 'userId or (bookId, authorUserId, readerUserId) required' });
    }
    const messages = await Message.find(query).sort({ createdAt: 1 }).lean();
    res.json({ messages });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/messages', async (req, res) => {
  try {
    const {
      bookId, bookTitle,
      authorUserId, authorName,
      readerUserId, readerName,
      fromUserId, fromName, fromRole,
      text,
    } = req.body || {};
    if (!bookId || !authorUserId || !readerUserId || !fromUserId || !text || !text.trim()) {
      return res.status(400).json({ error: 'bookId, authorUserId, readerUserId, fromUserId, text required' });
    }
    if (!['author', 'reader'].includes(fromRole)) {
      return res.status(400).json({ error: 'Invalid fromRole' });
    }
    if (fromUserId !== authorUserId && fromUserId !== readerUserId) {
      return res.status(403).json({ error: 'Sender is not part of this conversation' });
    }
    const msg = await Message.create({
      bookId, bookTitle,
      authorUserId, authorName,
      readerUserId, readerName,
      fromUserId, fromName, fromRole,
      text: text.trim(),
    });
    res.json({ message: msg });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/pings', async (req, res) => {
  try {
    const { readerUserId, authorUserId } = req.query;
    if (!readerUserId && !authorUserId) {
      return res.status(400).json({ error: 'readerUserId or authorUserId required' });
    }
    const query = {};
    if (readerUserId) query.readerUserId = readerUserId;
    if (authorUserId) query.authorUserId = authorUserId;
    const pings = await Ping.find(query).sort({ createdAt: -1 }).lean();
    res.json({ pings });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 7. Reviews — readers rate/comment on books; one review per (book, reviewer)
app.get('/api/reviews', async (req, res) => {
  try {
    const { bookId, reviewerUserId, bookOwnerUserId } = req.query;
    const query = {};
    if (bookId) query.bookId = bookId;
    if (reviewerUserId) query.reviewerUserId = reviewerUserId;
    if (bookOwnerUserId) query.bookOwnerUserId = bookOwnerUserId;
    if (!Object.keys(query).length) {
      return res.status(400).json({ error: 'bookId, reviewerUserId, or bookOwnerUserId required' });
    }
    const reviews = await Review.find(query).sort({ createdAt: -1 }).lean();
    res.json({ reviews });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/reviews', async (req, res) => {
  try {
    const { bookId, bookTitle, bookOwnerUserId, reviewerUserId, reviewerName, rating, text } = req.body || {};
    if (!bookId || !reviewerUserId) {
      return res.status(400).json({ error: 'bookId and reviewerUserId required' });
    }
    const numericRating = Number(rating);
    if (!Number.isInteger(numericRating) || numericRating < 1 || numericRating > 5) {
      return res.status(400).json({ error: 'rating must be an integer 1-5' });
    }
    const review = await Review.findOneAndUpdate(
      { bookId, reviewerUserId },
      {
        bookId, bookTitle, bookOwnerUserId,
        reviewerUserId, reviewerName,
        rating: numericRating,
        text: (text || '').trim(),
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json({ review });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 8. Super admin — single account gated by SUPER_ADMIN_EMAIL env var
function isSuperAdminEmail(email) {
  if (!SUPER_ADMIN_EMAIL_NORMALIZED) return false;
  return String(email || '').trim().toLowerCase() === SUPER_ADMIN_EMAIL_NORMALIZED;
}

async function isAccessRevoked({ userId, email } = {}) {
  const normEmail = String(email || '').trim().toLowerCase();
  if (normEmail && isSuperAdminEmail(normEmail)) return false;
  if (normEmail) {
    const blocked = await BlockedEmail.findOne({ email: normEmail }).lean();
    if (blocked) return true;
  }
  if (userId) {
    const profile = await UserProfile.findOne({ userId }).select('blocked email').lean();
    if (profile?.blocked) return true;
    if (profile?.email && !normEmail) {
      const blocked = await BlockedEmail.findOne({ email: String(profile.email).trim().toLowerCase() }).lean();
      if (blocked) return true;
    }
  }
  return false;
}

async function requireSuperAdmin(req, res) {
  const adminUserId = req.query.adminUserId || req.body?.adminUserId;
  if (!adminUserId) { res.status(401).json({ error: 'adminUserId required' }); return null; }
  const profile = await UserProfile.findOne({ userId: adminUserId }).lean();
  if (!profile || profile.role !== 'super_admin') {
    res.status(403).json({ error: 'Forbidden' });
    return null;
  }
  if (!isSuperAdminEmail(profile.email)) {
    res.status(403).json({ error: 'Forbidden' });
    return null;
  }
  return profile;
}

app.post('/api/super-admin-login', async (req, res) => {
  try {
    const { userId, email, name } = req.body || {};
    if (!userId || !email) return res.status(400).json({ error: 'userId and email required' });
    if (!SUPER_ADMIN_EMAIL_NORMALIZED) {
      return res.status(403).json({ error: 'Super admin not configured on this server' });
    }
    if (!isSuperAdminEmail(email)) {
      return res.status(403).json({ error: 'Not authorized' });
    }
    const now = new Date();
    const profile = await UserProfile.findOneAndUpdate(
      { userId },
      {
        $set: { userId, email, name, role: 'super_admin', lastLoginAt: now },
        $inc: { loginCount: 1 },
        $setOnInsert: { firstLoginAt: now },
        $unset: { genre: '', genres: '', favoriteAuthors: '', ageGroup: '', qualifications: '' },
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json({ profile });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/admin/users', async (req, res) => {
  try {
    if (!(await requireSuperAdmin(req, res))) return;
    const users = await UserProfile.find({}).sort({ createdAt: -1 }).lean();
    res.json({ users });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/admin/books', async (req, res) => {
  try {
    if (!(await requireSuperAdmin(req, res))) return;
    const books = await Book.find({})
      .select('userId title description genre genres authorEmail authorName audioStatus size createdAt updatedAt contentFlags contentScanStatus contentScanAt contentScanError')
      .sort({ createdAt: -1 })
      .lean();
    res.json({ books });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/admin/books/:bookId/rescan', async (req, res) => {
  try {
    if (!(await requireSuperAdmin(req, res))) return;
    const { bookId } = req.params;
    const result = await scanBookContent({ s3, bucket: AWS_S3_BUCKET, bookId });
    res.json({ ok: true, ...result });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/admin/rescan-all', async (req, res) => {
  try {
    if (!(await requireSuperAdmin(req, res))) return;
    const docs = await Book.find({}).select('_id').lean();
    res.json({ ok: true, queued: docs.length });
    // Run in background, sequentially, so we don't hammer S3 / pdf-parse.
    (async () => {
      let scanned = 0, failed = 0;
      for (const d of docs) {
        try {
          await scanBookContent({ s3, bucket: AWS_S3_BUCKET, bookId: String(d._id) });
          scanned += 1;
        } catch (err) {
          failed += 1;
          console.warn(`Rescan failed for book ${d._id}:`, err.message);
        }
      }
      console.log(`✅ Rescan-all done: ${scanned} scanned, ${failed} failed`);
    })().catch((e) => console.error('rescan-all background error:', e.message));
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/admin/pings', async (req, res) => {
  try {
    if (!(await requireSuperAdmin(req, res))) return;
    const pings = await Ping.find({}).sort({ createdAt: -1 }).lean();
    res.json({ pings });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/admin/messages', async (req, res) => {
  try {
    if (!(await requireSuperAdmin(req, res))) return;
    const { bookId, userId } = req.query;
    const query = {};
    if (bookId) query.bookId = bookId;
    if (userId) query.$or = [{ authorUserId: userId }, { readerUserId: userId }, { fromUserId: userId }];
    const messages = await Message.find(query).sort({ createdAt: -1 }).limit(2000).lean();
    res.json({ messages });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/admin/reviews', async (req, res) => {
  try {
    if (!(await requireSuperAdmin(req, res))) return;
    const reviews = await Review.find({}).sort({ createdAt: -1 }).lean();
    res.json({ reviews });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/admin/group-messages', async (req, res) => {
  try {
    if (!(await requireSuperAdmin(req, res))) return;
    const { genre } = req.query;
    const query = {};
    if (genre) query.genre = genre;
    const messages = await GroupMessage.find(query).sort({ createdAt: -1 }).limit(2000).lean();
    res.json({ messages });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// Public — called right after Google sign-in to gate access
app.post('/api/check-access', async (req, res) => {
  try {
    const { userId, email } = req.body || {};
    if (!userId && !email) return res.status(400).json({ error: 'userId or email required' });
    const blocked = await isAccessRevoked({ userId, email });
    if (blocked) {
      return res.status(403).json({
        blocked: true,
        error: 'Your access has been revoked. Contact support if you believe this is in error.',
      });
    }
    if (userId) {
      const now = new Date();
      UserProfile.updateOne(
        { userId },
        {
          $inc: { loginCount: 1 },
          $set: { lastLoginAt: now },
          $setOnInsert: { firstLoginAt: now },
        }
      ).catch((err) => console.warn('Login tracking failed:', err.message));
    }
    res.json({ blocked: false });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/admin/users/:userId/block', async (req, res) => {
  try {
    const admin = await requireSuperAdmin(req, res);
    if (!admin) return;
    const { userId } = req.params;
    const { reason } = req.body || {};
    const target = await UserProfile.findOne({ userId }).lean();
    if (!target) return res.status(404).json({ error: 'User not found' });
    if (isSuperAdminEmail(target.email)) {
      return res.status(400).json({ error: 'Cannot block the super admin' });
    }
    const normEmail = String(target.email || '').trim().toLowerCase();
    await UserProfile.updateOne(
      { userId },
      { $set: { blocked: true, blockedAt: new Date(), blockedReason: reason || '', blockedBy: admin.userId } }
    );
    if (normEmail) {
      await BlockedEmail.findOneAndUpdate(
        { email: normEmail },
        { email: normEmail, blockedBy: admin.userId, reason: reason || '' },
        { upsert: true, new: true, setDefaultsOnInsert: true }
      );
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/admin/users/:userId/unblock', async (req, res) => {
  try {
    const admin = await requireSuperAdmin(req, res);
    if (!admin) return;
    const { userId } = req.params;
    const target = await UserProfile.findOne({ userId }).lean();
    if (!target) return res.status(404).json({ error: 'User not found' });
    const normEmail = String(target.email || '').trim().toLowerCase();
    await UserProfile.updateOne(
      { userId },
      { $set: { blocked: false }, $unset: { blockedAt: '', blockedReason: '', blockedBy: '' } }
    );
    if (normEmail) {
      await BlockedEmail.deleteOne({ email: normEmail });
    }
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/admin/messages/send', async (req, res) => {
  try {
    const admin = await requireSuperAdmin(req, res);
    if (!admin) return;
    const { recipientUserId, text } = req.body || {};
    if (!recipientUserId || !text || !String(text).trim()) {
      return res.status(400).json({ error: 'recipientUserId and text required' });
    }
    const recipient = await UserProfile.findOne({ userId: recipientUserId }).lean();
    if (!recipient) return res.status(404).json({ error: 'Recipient not found' });
    const msg = await AdminMessage.create({
      adminUserId: admin.userId,
      adminName: admin.name || 'Super Admin',
      recipientUserId: recipient.userId,
      recipientEmail: recipient.email,
      recipientName: recipient.name,
      text: String(text).trim(),
    });
    res.json({ message: msg });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/admin/admin-messages', async (req, res) => {
  try {
    if (!(await requireSuperAdmin(req, res))) return;
    const messages = await AdminMessage.find({}).sort({ createdAt: -1 }).limit(2000).lean();
    res.json({ messages });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/inbox', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId required' });
    const messages = await AdminMessage.find({ recipientUserId: userId })
      .sort({ createdAt: -1 })
      .limit(200)
      .lean();
    const unreadCount = messages.filter((m) => !m.readAt).length;
    res.json({ messages, unreadCount });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/inbox/read', async (req, res) => {
  try {
    const { userId, messageId } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'userId required' });
    const filter = { recipientUserId: userId, readAt: null };
    if (messageId) filter._id = messageId;
    await AdminMessage.updateMany(filter, { $set: { readAt: new Date() } });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/admin/stats', async (req, res) => {
  try {
    if (!(await requireSuperAdmin(req, res))) return;
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const [
      totalUsers, totalAuthors, totalReaders, totalBooks, totalPings, totalMessages, totalReviews,
      activeLast24h, activeLast7d, loginAgg,
    ] = await Promise.all([
      UserProfile.countDocuments({}),
      UserProfile.countDocuments({ role: 'author' }),
      UserProfile.countDocuments({ role: 'reader' }),
      Book.countDocuments({}),
      Ping.countDocuments({}),
      Message.countDocuments({}),
      Review.countDocuments({}),
      UserProfile.countDocuments({ lastLoginAt: { $gte: oneDayAgo } }),
      UserProfile.countDocuments({ lastLoginAt: { $gte: sevenDaysAgo } }),
      UserProfile.aggregate([{ $group: { _id: null, total: { $sum: '$loginCount' } } }]),
    ]);
    const totalLogins = loginAgg[0]?.total || 0;
    res.json({
      totalUsers, totalAuthors, totalReaders,
      totalBooks, totalPings, totalMessages, totalReviews,
      totalLogins, activeLast24h, activeLast7d,
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});


// 9. Beta Reader Groups — one group per subgenre. Readers join manually.
// Authors can view (but not join) groups whose genre matches a book they've published.
async function authorPublishedGenresFor(userId) {
  const books = await Book.find({ userId, role: 'author' }).select('genres genre').lean();
  const set = new Set();
  for (const b of books) {
    if (Array.isArray(b.genres)) for (const g of b.genres) if (ALL_SUBGENRES_SET.has(g)) set.add(g);
  }
  return set;
}

app.get('/api/groups', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId required' });
    const profile = await UserProfile.findOne({ userId }).lean();
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    const role = profile.role;
    const [memberships, counts, authorGenres] = await Promise.all([
      role === 'reader' ? GroupMembership.find({ userId }).select('genre').lean() : Promise.resolve([]),
      GroupMembership.aggregate([{ $group: { _id: '$genre', count: { $sum: 1 } } }]),
      role === 'author' ? authorPublishedGenresFor(userId) : Promise.resolve(new Set()),
    ]);
    const myGenres = new Set(memberships.map((m) => m.genre));
    const countMap = new Map(counts.map((c) => [c._id, c.count]));
    const groups = ALL_SUBGENRES.map((genre) => ({
      genre,
      memberCount: countMap.get(genre) || 0,
      isMember: myGenres.has(genre),
      canView: role === 'reader' ? myGenres.has(genre) : (role === 'author' ? authorGenres.has(genre) : false),
    }));
    res.json({ groups, role });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/groups/:genre/join', async (req, res) => {
  try {
    const { genre } = req.params;
    const { userId } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'userId required' });
    if (!ALL_SUBGENRES_SET.has(genre)) return res.status(400).json({ error: 'Invalid genre' });
    const profile = await UserProfile.findOne({ userId }).lean();
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    if (profile.role !== 'reader') return res.status(403).json({ error: 'Only readers can join groups' });
    await GroupMembership.findOneAndUpdate(
      { userId, genre },
      {
        userId, genre,
        userName: profile.name,
        userEmail: profile.email,
        ageGroup: profile.ageGroup,
      },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/groups/:genre/leave', async (req, res) => {
  try {
    const { genre } = req.params;
    const { userId } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'userId required' });
    if (!ALL_SUBGENRES_SET.has(genre)) return res.status(400).json({ error: 'Invalid genre' });
    await GroupMembership.deleteOne({ userId, genre });
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.get('/api/groups/:genre/members', async (req, res) => {
  try {
    const { genre } = req.params;
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId required' });
    if (!ALL_SUBGENRES_SET.has(genre)) return res.status(400).json({ error: 'Invalid genre' });
    const profile = await UserProfile.findOne({ userId }).lean();
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    let allowed = false;
    if (profile.role === 'reader') {
      const member = await GroupMembership.findOne({ userId, genre }).lean();
      allowed = !!member;
    } else if (profile.role === 'author') {
      const authorGenres = await authorPublishedGenresFor(userId);
      allowed = authorGenres.has(genre);
    } else if (profile.role === 'super_admin') {
      allowed = true;
    }
    if (!allowed) return res.status(403).json({ error: 'Not allowed to view this group' });
    const members = await GroupMembership.find({ genre })
      .sort({ createdAt: 1 })
      .select('userId userName userEmail ageGroup createdAt')
      .lean();
    res.json({
      members: members.map((m) => ({
        userId: m.userId,
        name: m.userName || null,
        email: m.userEmail || null,
        ageGroup: m.ageGroup || null,
        joinedAt: m.createdAt,
      })),
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

async function isGroupMember(userId, genre) {
  const m = await GroupMembership.findOne({ userId, genre }).lean();
  return !!m;
}

app.get('/api/groups/:genre/messages', async (req, res) => {
  try {
    const { genre } = req.params;
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId required' });
    if (!ALL_SUBGENRES_SET.has(genre)) return res.status(400).json({ error: 'Invalid genre' });
    if (!(await isGroupMember(userId, genre))) {
      return res.status(403).json({ error: 'Join the group to view its chat' });
    }
    const messages = await GroupMessage.find({ genre })
      .sort({ createdAt: 1 })
      .limit(500)
      .lean();
    res.json({ messages });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

app.post('/api/groups/:genre/messages', async (req, res) => {
  try {
    const { genre } = req.params;
    const { userId, text } = req.body || {};
    if (!userId || !text || !text.trim()) return res.status(400).json({ error: 'userId and text required' });
    if (!ALL_SUBGENRES_SET.has(genre)) return res.status(400).json({ error: 'Invalid genre' });
    if (!(await isGroupMember(userId, genre))) {
      return res.status(403).json({ error: 'Join the group to post' });
    }
    const profile = await UserProfile.findOne({ userId }).lean();
    if (!profile) return res.status(404).json({ error: 'Profile not found' });
    const msg = await GroupMessage.create({
      genre,
      fromUserId: userId,
      fromName: profile.name,
      fromRole: profile.role === 'author' ? 'author' : 'reader',
      text: text.trim(),
    });
    res.json({ message: msg });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});





// ===== LinkedIn integration =====

function linkedinCallbackHtml(ok, message) {
  const safe = String(message || '').replace(/[<>&"']/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#39;' }[c]));
  return `<!doctype html><html><head><title>LinkedIn ${ok ? 'connected' : 'error'}</title>
<style>body{font-family:Roboto,system-ui,sans-serif;padding:48px;text-align:center;background:#e5e2d5;color:#0d4d3d}.err{color:#b91c1c}</style></head>
<body><h2 class="${ok ? '' : 'err'}">${ok ? '✅' : '❌'} ${safe}</h2>
<p>This window will close automatically.</p>
<script>try{window.opener&&window.opener.postMessage({source:'flipp-linkedin',ok:${ok ? 'true' : 'false'}}, '*');}catch(e){}setTimeout(()=>window.close(),1200);</script>
</body></html>`;
}

app.get('/api/linkedin/auth-url', (req, res) => {
  try {
    if (!LINKEDIN_CONFIGURED) return res.status(503).json({ error: 'LinkedIn not configured on server' });
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId required' });
    const url = linkedinAuthUrl({ clientId: LINKEDIN_CLIENT_ID, redirectUri: LINKEDIN_REDIRECT_URI, state: String(userId) });
    res.json({ url });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.get('/api/linkedin/callback', async (req, res) => {
  const { code, state, error, error_description } = req.query;
  if (error) return res.send(linkedinCallbackHtml(false, error_description || error));
  try {
    if (!LINKEDIN_CONFIGURED) throw new Error('LinkedIn not configured');
    if (!code) throw new Error('Missing code');
    const userId = String(state || '');
    if (!userId) throw new Error('Missing state');
    const result = await linkedinExchange({
      code, clientId: LINKEDIN_CLIENT_ID, clientSecret: LINKEDIN_CLIENT_SECRET, redirectUri: LINKEDIN_REDIRECT_URI,
    });
    await LinkedInConnection.findOneAndUpdate(
      { userId },
      {
        userId, personUrn: result.sub, accessToken: result.accessToken,
        expiresAt: new Date(Date.now() + (result.expiresInSeconds || 0) * 1000),
        scope: result.scope, name: result.name, email: result.email,
      },
      { upsert: true, new: true }
    );
    res.send(linkedinCallbackHtml(true, `Connected as ${result.name || result.email || 'LinkedIn user'}`));
  } catch (e) {
    res.status(500).send(linkedinCallbackHtml(false, e.message));
  }
});

app.get('/api/linkedin/status', async (req, res) => {
  try {
    const { userId } = req.query;
    if (!userId) return res.status(400).json({ error: 'userId required' });
    if (!LINKEDIN_CONFIGURED) return res.json({ configured: false, connected: false });
    const conn = await LinkedInConnection.findOne({ userId }).lean();
    if (!conn) return res.json({ configured: true, connected: false });
    res.json({
      configured: true,
      connected: true,
      name: conn.name,
      expiresAt: conn.expiresAt,
      expired: conn.expiresAt && new Date(conn.expiresAt) < new Date(),
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/linkedin/disconnect', async (req, res) => {
  try {
    const { userId } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'userId required' });
    await LinkedInConnection.deleteOne({ userId });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/linkedin/post', async (req, res) => {
  try {
    if (!LINKEDIN_CONFIGURED) return res.status(503).json({ error: 'LinkedIn not configured on server' });
    const { userId, text, imageBase64, imageContentType } = req.body || {};
    if (!userId) return res.status(400).json({ error: 'userId required' });
    if (!text || !String(text).trim()) return res.status(400).json({ error: 'text required' });
    const conn = await LinkedInConnection.findOne({ userId });
    if (!conn) return res.status(400).json({ error: 'LinkedIn not connected' });
    if (conn.expiresAt && new Date(conn.expiresAt) < new Date()) {
      return res.status(401).json({ error: 'LinkedIn token expired — please reconnect' });
    }
    let postId;
    if (imageBase64 && imageContentType) {
      const buf = Buffer.from(imageBase64, 'base64');
      postId = await linkedinPostImage({
        accessToken: conn.accessToken, personUrn: conn.personUrn,
        text: String(text).trim(), imageBuffer: buf, contentType: imageContentType,
      });
    } else {
      postId = await linkedinPostText({
        accessToken: conn.accessToken, personUrn: conn.personUrn, text: String(text).trim(),
      });
    }
    res.json({ ok: true, postId });
  } catch (e) {
    console.error('LinkedIn post error:', e.message);
    res.status(500).json({ error: e.message });
  }
});

// ===== Google Books proxy =====
app.get('/api/google-books', async (req, res) => {
  try {
    const { q, max } = req.query;
    if (!q || !String(q).trim()) return res.status(400).json({ error: 'q required' });
    const maxResults = Math.min(Math.max(parseInt(max, 10) || 24, 1), 40);
    const params = new URLSearchParams({
      q: String(q),
      maxResults: String(maxResults),
      printType: 'books',
    });
    if (GOOGLE_BOOKS_API_KEY) params.set('key', GOOGLE_BOOKS_API_KEY);
    const r = await fetch(`https://www.googleapis.com/books/v1/volumes?${params.toString()}`);
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return res.status(r.status).json({ error: data?.error?.message || `Google Books API error (${r.status})` });
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

if (process.env.NODE_ENV === 'production') {
  const distDir = join(__dirname, '..', 'dist');
  app.use(express.static(distDir));
  app.get(/^\/(?!api\/).*/, (req, res) => {
    res.sendFile(join(distDir, 'index.html'));
  });
}

app.listen(PORT, () => {
  console.log(`✅ BetaReading API listening on http://localhost:${PORT}`);
});
