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
    blocked: { type: Boolean, default: false, index: true },
    blockedAt: { type: Date },
    blockedReason: { type: String, trim: true },
    blockedBy: { type: String }, // super admin userId
    loginCount: { type: Number, default: 0 },
    firstLoginAt: { type: Date },
    lastLoginAt: { type: Date, index: true },
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
    contentScanStatus: { type: String, enum: ['pending', 'scanned', 'failed'], default: 'pending' },
    contentScanAt: { type: Date },
    contentScanError: { type: String },
    contentFlags: { type: mongoose.Schema.Types.Mixed, default: undefined },
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


const BlockedEmailSchema = new mongoose.Schema(
  {
    email: { type: String, required: true, unique: true, index: true, lowercase: true, trim: true },
    blockedBy: { type: String }, // super admin userId
    reason: { type: String, trim: true },
  },
  { timestamps: true }
);

export const BlockedEmail =
  mongoose.models.BlockedEmail || mongoose.model('BlockedEmail', BlockedEmailSchema);

const AdminMessageSchema = new mongoose.Schema(
  {
    adminUserId: { type: String, required: true },
    adminName: { type: String },
    recipientUserId: { type: String, required: true, index: true },
    recipientEmail: { type: String, lowercase: true, trim: true },
    recipientName: { type: String },
    text: { type: String, required: true, trim: true },
    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);

export const AdminMessage =
  mongoose.models.AdminMessage || mongoose.model('AdminMessage', AdminMessageSchema);

const GroupMembershipSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, index: true },
    genre: { type: String, required: true, index: true },
    userName: { type: String },
    userEmail: { type: String, lowercase: true, trim: true },
    ageGroup: { type: String },
  },
  { timestamps: true }
);

GroupMembershipSchema.index({ userId: 1, genre: 1 }, { unique: true });

export const GroupMembership =
  mongoose.models.GroupMembership || mongoose.model('GroupMembership', GroupMembershipSchema);

const GroupMessageSchema = new mongoose.Schema(
  {
    genre: { type: String, required: true, index: true },
    fromUserId: { type: String, required: true, index: true },
    fromName: { type: String },
    fromRole: { type: String, enum: ['reader', 'author'], default: 'reader' },
    text: { type: String, required: true, trim: true },
  },
  { timestamps: true }
);

GroupMessageSchema.index({ genre: 1, createdAt: 1 });

export const GroupMessage =
  mongoose.models.GroupMessage || mongoose.model('GroupMessage', GroupMessageSchema);

const LinkedInConnectionSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },
    personUrn: { type: String, required: true },
    accessToken: { type: String, required: true },
    expiresAt: { type: Date, required: true },
    scope: { type: String },
    name: { type: String },
    email: { type: String },
  },
  { timestamps: true }
);

export const LinkedInConnection =
  mongoose.models.LinkedInConnection || mongoose.model('LinkedInConnection', LinkedInConnectionSchema);

const TwitterConnectionSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true, index: true },
    twitterUserId: { type: String, required: true },
    username: { type: String },
    name: { type: String },
    accessToken: { type: String, required: true },
    refreshToken: { type: String },
    expiresAt: { type: Date, required: true },
    scope: { type: String },
  },
  { timestamps: true }
);

export const TwitterConnection =
  mongoose.models.TwitterConnection || mongoose.model('TwitterConnection', TwitterConnectionSchema);
