import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { PollyClient, SynthesizeSpeechCommand } from '@aws-sdk/client-polly';
import { PDFParse } from 'pdf-parse';
import { Book } from './db.js';

const POLLY_VOICE = process.env.POLLY_VOICE || 'Joanna';
const POLLY_ENGINE = process.env.POLLY_ENGINE || 'neural';
const TTS_MAX_CHARS = Number(process.env.TTS_MAX_CHARS || 600000);
const CHUNK_CHARS = 2800;

let polly = null;
function getPolly(region) {
  if (!polly) {
    polly = new PollyClient({
      region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      },
    });
  }
  return polly;
}

async function streamToBuffer(stream) {
  if (!stream) return Buffer.alloc(0);
  if (typeof stream.transformToByteArray === 'function') {
    return Buffer.from(await stream.transformToByteArray());
  }
  const chunks = [];
  for await (const chunk of stream) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
  return Buffer.concat(chunks);
}

function chunkText(text, max = CHUNK_CHARS) {
  const clean = text.replace(/\s+/g, ' ').trim();
  if (!clean) return [];
  const sentences = clean.match(/[^.!?]+[.!?]+|\S[^.!?]*$/g) || [clean];
  const chunks = [];
  let buf = '';
  for (const s of sentences) {
    if ((buf + ' ' + s).trim().length > max) {
      if (buf) chunks.push(buf.trim());
      if (s.length > max) {
        for (let i = 0; i < s.length; i += max) chunks.push(s.slice(i, i + max));
        buf = '';
      } else {
        buf = s;
      }
    } else {
      buf = buf ? `${buf} ${s}` : s;
    }
  }
  if (buf.trim()) chunks.push(buf.trim());
  return chunks;
}

const CHAPTER_RE = /^\s*(prologue|epilogue|introduction|foreword|preface|part\s+(?:[ivxlc]+|\d+|one|two|three|four|five|six|seven|eight|nine|ten)|chapter\s+(?:[ivxlc]+|\d+|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|thirteen|fourteen|fifteen|sixteen|seventeen|eighteen|nineteen|twenty)(?:\s*[:\-\u2014\.].*)?)\s*$/i;

function splitIntoChapters(text) {
  const lines = text.split(/\r?\n/);
  const headings = [];
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim();
    if (!trimmed) continue;
    if (trimmed.length > 80) continue;
    if (CHAPTER_RE.test(trimmed)) headings.push({ index: i, title: trimmed });
  }
  if (headings.length < 2) return [{ title: 'Audiobook', content: text }];
  const chapters = [];
  if (headings[0].index > 0) {
    const intro = lines.slice(0, headings[0].index).join('\n').trim();
    if (intro.length > 200) chapters.push({ title: 'Front Matter', content: intro });
  }
  for (let i = 0; i < headings.length; i++) {
    const start = headings[i].index;
    const end = i + 1 < headings.length ? headings[i + 1].index : lines.length;
    const body = lines.slice(start + 1, end).join('\n').trim();
    if (body) chapters.push({ title: headings[i].title, content: body });
  }
  return chapters;
}

async function synthesizeText(client, text) {
  const chunks = chunkText(text);
  const buffers = [];
  for (const c of chunks) {
    const out = await client.send(new SynthesizeSpeechCommand({
      Engine: POLLY_ENGINE, OutputFormat: 'mp3', Text: c, VoiceId: POLLY_VOICE,
    }));
    buffers.push(await streamToBuffer(out.AudioStream));
  }
  return { mp3: Buffer.concat(buffers), chunkCount: chunks.length };
}

export async function generateAudioForBook({ s3, bucket, region, bookId }) {
  const book = await Book.findById(bookId);
  if (!book) throw new Error(`Book ${bookId} not found`);

  await Book.updateOne(
    { _id: bookId },
    { $set: { audioStatus: 'processing', audioError: null } }
  );

  try {
    const pdfObj = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: book.s3Key }));
    const pdfBuffer = await streamToBuffer(pdfObj.Body);
    const parser = new PDFParse({ data: pdfBuffer });
    const parsed = await parser.getText();
    await parser.destroy().catch(() => {});
    const text = (parsed?.text || '').trim();
    if (!text) throw new Error('No extractable text in PDF');
    if (text.length > TTS_MAX_CHARS) {
      throw new Error(`Text length ${text.length} exceeds TTS_MAX_CHARS=${TTS_MAX_CHARS}`);
    }

    const chapters = splitIntoChapters(text);
    const client = getPolly(region);
    const audioChapters = [];
    let totalChunks = 0;

    for (let i = 0; i < chapters.length; i++) {
      const { title, content } = chapters[i];
      const chars = content.length;
      const { mp3, chunkCount } = await synthesizeText(client, content);
      totalChunks += chunkCount;
      const audioKey = `${book.s3Key}.ch${String(i).padStart(3, '0')}.mp3`;
      await s3.send(new PutObjectCommand({
        Bucket: bucket, Key: audioKey, Body: mp3, ContentType: 'audio/mpeg',
      }));
      audioChapters.push({ title, audioS3Key: audioKey, chars });
    }

    const update = {
      audioStatus: 'ready',
      audioChars: text.length,
      audioError: null,
      audioChapters,
    };
    if (audioChapters.length === 1) update.audioS3Key = audioChapters[0].audioS3Key;
    else update.audioS3Key = null;

    await Book.updateOne({ _id: bookId }, { $set: update });
    console.log(`✅ TTS ready for book ${bookId} (${text.length} chars, ${chapters.length} chapter${chapters.length > 1 ? 's' : ''}, ${totalChunks} Polly calls)`);
  } catch (err) {
    console.error(`❌ TTS failed for book ${bookId}:`, err.message);
    await Book.updateOne(
      { _id: bookId },
      { $set: { audioStatus: 'failed', audioError: err.message } }
    );
    throw err;
  }
}
