const express = require('express');
const axios = require('axios');
const cors = require('cors');
const path = require('path');
const app = express();

app.use(cors());

// インスタンスリスト
const INSTANCES = [
  'https://vid.puffyan.us',
  'https://yewtu.be',
  'https://inv.vern.cc',
  'https://invidious.snopyta.org'
];
let instanceIndex = 0;

// Invidious API 共通処理
async function fetchInvidious(endpoint, params = {}) {
  let attempts = 0;
  while (attempts < INSTANCES.length) {
    try {
      const baseUrl = INSTANCES[instanceIndex];
      const res = await axios.get(`${baseUrl}/api/v1${endpoint}`, { params, timeout: 8000 });
      return res.data;
    } catch (e) {
      instanceIndex = (instanceIndex + 1) % INSTANCES.length;
      attempts++;
    }
  }
  throw new Error('All instances failed');
}

// API: 検索
app.get('/api/search', async (req, res) => {
  try {
    const data = await fetchInvidious('/search', { q: req.query.q, page: req.query.page || 1, hl: 'ja' });
    const items = data.map(item => ({
      id: { kind: item.type === 'channel' ? 'youtube#channel' : 'youtube#video', videoId: item.videoId, channelId: item.authorId },
      snippet: { title: item.title, channelTitle: item.author, thumbnails: { medium: { url: item.videoThumbnails ? item.videoThumbnails[0].url : '' } } }
    }));
    res.json({ items, nextPage: parseInt(req.query.page || 1) + 1 });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// API: 動画詳細
app.get('/api/videos', async (req, res) => {
  try {
    const data = await fetchInvidious(`/videos/${req.query.id}`);
    res.json({ items: [{ snippet: { title: data.title, channelId: data.authorId, channelTitle: data.author, publishedAt: new Date(data.published * 1000).toISOString() } }] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// API: コメント
app.get('/api/comments', async (req, res) => {
  try {
    const data = await fetchInvidious(`/comments/${req.query.id}`);
    const items = (data.comments || []).map(c => ({
      snippet: { topLevelComment: { snippet: { authorDisplayName: c.author, publishedAt: new Date(c.published * 1000).toISOString(), textDisplay: c.content } } }
    }));
    res.json({ items });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// API: チャンネル
app.get('/api/channels', async (req, res) => {
  try {
    const data = await fetchInvidious(`/channels/${req.query.id}`);
    res.json({ items: [{ snippet: { title: data.author, description: data.description, thumbnails: { default: { url: data.authorThumbnails ? data.authorThumbnails[0].url : '' } } }, statistics: { subscriberCount: data.subCount } }] });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ★ HTMLを返す設定
// リポジトリ内のファイルを直接返す
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'index.html')));
app.get('/watch.html', (req, res) => res.sendFile(path.join(__dirname, 'watch.html')));
app.get('/channel.html', (req, res) => res.sendFile(path.join(__dirname, 'channel.html')));

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Server is running on port ${PORT}`));
