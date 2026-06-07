const SCOPES = ['openid', 'profile', 'email', 'w_member_social'].join(' ');
const AUTH_URL = 'https://www.linkedin.com/oauth/v2/authorization';
const TOKEN_URL = 'https://www.linkedin.com/oauth/v2/accessToken';
const USERINFO_URL = 'https://api.linkedin.com/v2/userinfo';
const UGC_POSTS_URL = 'https://api.linkedin.com/v2/ugcPosts';
const REGISTER_UPLOAD_URL = 'https://api.linkedin.com/v2/assets?action=registerUpload';

export function getAuthUrl({ clientId, redirectUri, state }) {
  const p = new URLSearchParams({
    response_type: 'code',
    client_id: clientId,
    redirect_uri: redirectUri,
    state,
    scope: SCOPES,
  });
  return `${AUTH_URL}?${p.toString()}`;
}

export async function exchangeCode({ code, clientId, clientSecret, redirectUri }) {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
    client_id: clientId,
    client_secret: clientSecret,
  });
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  });
  if (!res.ok) throw new Error(`LinkedIn token exchange failed: ${await res.text()}`);
  const tok = await res.json();
  const meRes = await fetch(USERINFO_URL, { headers: { Authorization: `Bearer ${tok.access_token}` } });
  if (!meRes.ok) throw new Error(`LinkedIn userinfo failed: ${await meRes.text()}`);
  const me = await meRes.json();
  return {
    accessToken: tok.access_token,
    expiresInSeconds: tok.expires_in,
    scope: tok.scope,
    sub: me.sub,
    name: me.name,
    email: me.email,
  };
}

const POST_HEADERS = (token) => ({
  Authorization: `Bearer ${token}`,
  'Content-Type': 'application/json',
  'X-Restli-Protocol-Version': '2.0.0',
});

export async function postTextOnly({ accessToken, personUrn, text }) {
  const body = {
    author: `urn:li:person:${personUrn}`,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text },
        shareMediaCategory: 'NONE',
      },
    },
    visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
  };
  const res = await fetch(UGC_POSTS_URL, {
    method: 'POST',
    headers: POST_HEADERS(accessToken),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`LinkedIn post failed: ${res.status} ${await res.text()}`);
  return res.headers.get('x-restli-id') || null;
}

export async function postWithImage({ accessToken, personUrn, text, imageBuffer, contentType }) {
  const regBody = {
    registerUploadRequest: {
      recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
      owner: `urn:li:person:${personUrn}`,
      serviceRelationships: [{ relationshipType: 'OWNER', identifier: 'urn:li:userGeneratedContent' }],
    },
  };
  const regRes = await fetch(REGISTER_UPLOAD_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(regBody),
  });
  if (!regRes.ok) throw new Error(`LinkedIn registerUpload failed: ${await regRes.text()}`);
  const reg = await regRes.json();
  const uploadUrl =
    reg.value.uploadMechanism['com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'].uploadUrl;
  const asset = reg.value.asset;

  const upRes = await fetch(uploadUrl, {
    method: 'PUT',
    headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': contentType },
    body: imageBuffer,
  });
  if (!upRes.ok && upRes.status !== 201) {
    throw new Error(`LinkedIn image upload failed: ${upRes.status} ${await upRes.text()}`);
  }

  const postBody = {
    author: `urn:li:person:${personUrn}`,
    lifecycleState: 'PUBLISHED',
    specificContent: {
      'com.linkedin.ugc.ShareContent': {
        shareCommentary: { text },
        shareMediaCategory: 'IMAGE',
        media: [{ status: 'READY', description: { text: '' }, media: asset, title: { text: '' } }],
      },
    },
    visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' },
  };
  const postRes = await fetch(UGC_POSTS_URL, {
    method: 'POST',
    headers: POST_HEADERS(accessToken),
    body: JSON.stringify(postBody),
  });
  if (!postRes.ok) throw new Error(`LinkedIn post failed: ${postRes.status} ${await postRes.text()}`);
  return postRes.headers.get('x-restli-id') || null;
}
