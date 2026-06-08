import { randomBytes as nodeRandomBytes, createHash as nodeCreateHash } from 'node:crypto';

const SCOPES = ['tweet.read', 'tweet.write', 'users.read', 'offline.access'].join(' ');
const AUTH_URL = 'https://twitter.com/i/oauth2/authorize';
const TOKEN_URL = 'https://api.twitter.com/2/oauth2/token';
const ME_URL = 'https://api.twitter.com/2/users/me';
const TWEETS_URL = 'https://api.twitter.com/2/tweets';
const MEDIA_UPLOAD_URL = 'https://api.twitter.com/2/media/upload';

function base64url(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export function createPkcePair() {
  const verifier = base64url(nodeRandomBytes(32));
  const challenge = base64url(nodeCreateHash('sha256').update(verifier).digest());
  return { verifier, challenge };
}

export function getAuthUrl({ clientId, redirectUri, state, codeChallenge }) {
  const p = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: SCOPES,
    state,
    code_challenge: codeChallenge,
    code_challenge_method: 'S256',
  });
  return `${AUTH_URL}?${p.toString()}`;
}

function basicAuth(clientId, clientSecret) {
  return 'Basic ' + Buffer.from(`${clientId}:${clientSecret}`).toString('base64');
}

export async function exchangeCode({ code, clientId, clientSecret, redirectUri, codeVerifier }) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    code_verifier: codeVerifier,
  });
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: basicAuth(clientId, clientSecret),
    },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`Twitter token exchange failed: ${await res.text()}`);
  const tok = await res.json();
  const meRes = await fetch(ME_URL, { headers: { Authorization: `Bearer ${tok.access_token}` } });
  if (!meRes.ok) throw new Error(`Twitter users/me failed: ${await meRes.text()}`);
  const me = (await meRes.json()).data || {};
  return {
    accessToken: tok.access_token,
    refreshToken: tok.refresh_token,
    expiresInSeconds: tok.expires_in,
    scope: tok.scope,
    userId: me.id,
    username: me.username,
    name: me.name,
  };
}

export async function refreshAccessToken({ refreshToken, clientId, clientSecret }) {
  const body = new URLSearchParams({
    grant_type: 'refresh_token',
    refresh_token: refreshToken,
    client_id: clientId,
  });
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: basicAuth(clientId, clientSecret),
    },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`Twitter token refresh failed: ${await res.text()}`);
  const tok = await res.json();
  return {
    accessToken: tok.access_token,
    refreshToken: tok.refresh_token || refreshToken,
    expiresInSeconds: tok.expires_in,
    scope: tok.scope,
  };
}

export async function uploadMedia({ accessToken, imageBuffer, contentType }) {
  const form = new FormData();
  form.append('media', new Blob([imageBuffer], { type: contentType || 'image/jpeg' }));
  const res = await fetch(MEDIA_UPLOAD_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}` },
    body: form,
  });
  if (!res.ok) throw new Error(`Twitter media upload failed: ${res.status} ${await res.text()}`);
  const j = await res.json();
  const id = j.media_id_string || j.data?.id || j.id;
  if (!id) throw new Error('Twitter media upload returned no media id');
  return String(id);
}

export async function postTweet({ accessToken, text, mediaIds }) {
  const body = { text };
  if (mediaIds && mediaIds.length) body.media = { media_ids: mediaIds };
  const res = await fetch(TWEETS_URL, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`Twitter post failed: ${res.status} ${await res.text()}`);
  const j = await res.json();
  return j.data?.id || null;
}

export function truncateForTwitter(text, limit = 280) {
  const s = String(text || '');
  if (s.length <= limit) return s;
  return s.slice(0, limit - 1) + '…';
}
