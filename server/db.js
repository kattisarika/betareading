import mongoose from 'mongoose';

let connectPromise = null;

export function connectMongo(uri) {
  if (!uri) return Promise.reject(new Error('MONGODB_URI not set'));
  if (!connectPromise) {
    connectPromise = mongoose.connect(uri).then(() => {
      console.log('✅ Connected to MongoDB');
    }).catch((err) => {
      connectPromise = null;
      throw err;
    });
  }
  return connectPromise;
}

const UserProfileSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },
    email: { type: String },
    name: { type: String },
    role: { type: String, enum: ['reader', 'author', 'super_admin'], required: true },
    genre: { type: String, enum: ['fiction', 'non_fiction'] }, // readers only — broad category derived from genres
    genres: { type: [String], default: undefined }, // readers only — subgenres
    favoriteAuthors: { type: String, trim: true }, // readers only — authors/books they read
    ageGroup: { type: String, enum: ['kids', 'preteens_13', 'teenager_18', 'adults_25'] }, // readers only
    qualifications: { type: String, trim: true }, // readers only — qualifications or what they're studying
  },
  { timestamps: true }
);

export const UserProfile =
  mongoose.models.UserProfile || mongoose.model('UserProfile', UserProfileSchema);

const BookSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    role: { type: String, enum: ['author'], default: 'author', required: true },
    title: { type: String, required: true, trim: true },
    description: { type: String, trim: true },
    genre: { type: String, enum: ['fiction', 'non_fiction'], required: true }, // broad category derived from genres
    genres: { type: [String], default: undefined }, // optional subgenres
    s3Key: { type: String, required: true, unique: true },
    size: { type: Number },
    contentType: { type: String, default: 'application/pdf' },
    authorEmail: { type: String },
    authorName: { type: String },
    audioS3Key: { type: String },
    audioStatus: { type: String, enum: ['pending', 'processing', 'ready', 'failed'], default: 'pending' },
    audioError: { type: String },
    audioChars: { type: Number },
    audioChapters: {
      type: [{
        title: { type: String },
        audioS3Key: { type: String },
        chars: { type: Number },
      }],
      default: undefined,
    },
  },
  { timestamps: true }
);

export const Book = mongoose.models.Book || mongoose.model('Book', BookSchema);

const PingSchema = new mongoose.Schema(
  {
    bookId: { type: String, required: true },
    bookTitle: { type: String, required: true },
    bookGenre: { type: String, enum: ['fiction', 'non_fiction'], required: true },
    authorUserId: { type: String, required: true, index: true },
    authorName: { type: String },
    authorEmail: { type: String },
    readerUserId: { type: String, required: true, index: true },
    readerName: { type: String },
    message: { type: String },
    status: { type: String, enum: ['pending', 'accepted', 'declined'], default: 'pending' },
  },
  { timestamps: true }
);

PingSchema.index({ bookId: 1, readerUserId: 1 }, { unique: true });

export const Ping = mongoose.models.Ping || mongoose.model('Ping', PingSchema);

const MessageSchema = new mongoose.Schema(
  {
    bookId: { type: String, required: true, index: true },
    bookTitle: { type: String, required: true },
    authorUserId: { type: String, required: true, index: true },
    authorName: { type: String },
    readerUserId: { type: String, required: true, index: true },
    readerName: { type: String },
    fromUserId: { type: String, required: true },
    fromName: { type: String },
    fromRole: { type: String, enum: ['author', 'reader'], required: true },
    text: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

MessageSchema.index({ readerUserId: 1, authorUserId: 1, bookId: 1, createdAt: 1 });

export const Message = mongoose.models.Message || mongoose.model('Message', MessageSchema);

const ReviewSchema = new mongoose.Schema(
  {
    bookId: { type: String, required: true, index: true },
    bookTitle: { type: String },
    bookOwnerUserId: { type: String, index: true }, // author's userId
    reviewerUserId: { type: String, required: true, index: true },
    reviewerName: { type: String },
    rating: { type: Number, required: true, min: 1, max: 5 },
    text: { type: String, trim: true, default: '' },
  },
  { timestamps: true }
);

ReviewSchema.index({ bookId: 1, reviewerUserId: 1 }, { unique: true });

export const Review = mongoose.models.Review || mongoose.model('Review', ReviewSchema);
