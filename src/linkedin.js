/**
 * LinkedIn API — OAuth2 auth flow + image upload + UGC post creation
 */
const axios  = require('axios');
const fs     = require('fs-extra');
const logger = require('./logger');

class LinkedIn {
  constructor(cfg) {
    this.clientId     = cfg.liClientId     || '';
    this.clientSecret = cfg.liClientSecret || '';
    this.redirectUri  = cfg.liRedirectUri  || 'http://localhost:3000/auth/linkedin/callback';
    this.accessToken  = cfg.liAccessToken  || '';
    this.personUrn    = cfg.liPersonUrn    || '';
  }

  /* ── Step 1: Build authorization URL ────────────────────────── */
  getAuthUrl() {
    if (!this.clientId) return null;
    const scope = encodeURIComponent('openid profile w_member_social');
    return (
      `https://www.linkedin.com/oauth/v2/authorization` +
      `?response_type=code` +
      `&client_id=${this.clientId}` +
      `&redirect_uri=${encodeURIComponent(this.redirectUri)}` +
      `&scope=${scope}` +
      `&state=gfgbot${Date.now()}`
    );
  }

  /* ── Step 2: Exchange code for access token ──────────────────── */
  async exchangeCode(code) {
    logger.info('Exchanging auth code for access token...');
    const params = new URLSearchParams({
      grant_type:    'authorization_code',
      code,
      redirect_uri:  this.redirectUri,
      client_id:     this.clientId,
      client_secret: this.clientSecret,
    });
    const res = await axios.post(
      'https://www.linkedin.com/oauth/v2/accessToken',
      params.toString(),
      { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } }
    );
    this.accessToken = res.data.access_token;
    logger.info('Access token obtained successfully.');
    return this.accessToken;
  }

  /* ── Step 3: Fetch person URN ────────────────────────────────── */
  async fetchPersonUrn() {
    logger.info('Fetching LinkedIn person URN...');
    const res = await axios.get('https://api.linkedin.com/v2/userinfo', {
      headers: { Authorization: `Bearer ${this.accessToken}` }
    });
    this.personUrn = `urn:li:person:${res.data.sub}`;
    logger.info('Person URN: ' + this.personUrn);
    return this.personUrn;
  }

  /* ── Upload one image, return asset URN ──────────────────────── */
  async _uploadImage(filePath) {
    logger.info('Uploading image: ' + filePath);

    // Register
    const reg = await axios.post(
      'https://api.linkedin.com/v2/assets?action=registerUpload',
      {
        registerUploadRequest: {
          recipes: ['urn:li:digitalmediaRecipe:feedshare-image'],
          owner:   this.personUrn,
          serviceRelationships: [{
            relationshipType: 'OWNER',
            identifier: 'urn:li:userGeneratedContent'
          }]
        }
      },
      { headers: { Authorization: `Bearer ${this.accessToken}`, 'Content-Type': 'application/json' } }
    );

    const uploadUrl = reg.data.value.uploadMechanism[
      'com.linkedin.digitalmedia.uploading.MediaUploadHttpRequest'
    ].uploadUrl;
    const asset = reg.data.value.asset;

    // Upload binary
    const buf = fs.readFileSync(filePath);
    await axios.put(uploadUrl, buf, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/octet-stream'
      },
      maxBodyLength: Infinity,
      maxContentLength: Infinity
    });

    logger.info('Image uploaded → ' + asset);
    return asset;
  }

  /* ── Create LinkedIn post with images ─────────────────────────── */
  async post(text, imagePaths = []) {
    logger.info('Creating LinkedIn post...');

    const media = [];
    for (const imgPath of imagePaths) {
      if (!fs.existsSync(imgPath)) { logger.warn('Image not found, skipping: ' + imgPath); continue; }
      try {
        const asset = await this._uploadImage(imgPath);
        media.push({
          status: 'READY',
          description: { text: 'GFG Problem of the Day' },
          media: asset,
          title: { text: 'GeeksforGeeks POTD' }
        });
      } catch (e) {
        logger.warn('Image upload failed, skipping: ' + e.message);
      }
    }

    const body = {
      author: this.personUrn,
      lifecycleState: 'PUBLISHED',
      specificContent: {
        'com.linkedin.ugc.ShareContent': {
          shareCommentary:    { text },
          shareMediaCategory: media.length > 0 ? 'IMAGE' : 'NONE',
          ...(media.length > 0 && { media })
        }
      },
      visibility: { 'com.linkedin.ugc.MemberNetworkVisibility': 'PUBLIC' }
    };

    const res = await axios.post('https://api.linkedin.com/v2/ugcPosts', body, {
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        'Content-Type': 'application/json',
        'X-Restli-Protocol-Version': '2.0.0'
      }
    });

    const postId = res.headers['x-restli-id'] || res.data?.id || 'unknown';
    logger.info('LinkedIn post created! ID: ' + postId);
    return postId;
  }

  isConfigured()    { return !!(this.clientId && this.clientSecret); }
  isAuthenticated() { return !!(this.accessToken && this.personUrn); }
}

module.exports = LinkedIn;
