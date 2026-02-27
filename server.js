const express = require('express');
const axios = require('axios');
const cors = require('cors');
const app = express();

app.use(cors());

const INSTANCES = [
  'https://vid.puffyan.us',
  'https://yewtu.be',
  'https://inv.vern.cc',
  'https://invidious.snopyta.org'
];
let instanceIndex = 0;

async function fetchInvidious(endpoint, params = {}) {
  let attempts = 0;
  while (attempts < INSTANCES.length) {
    try {
      const baseUrl = INSTANCES[instanceIndex];
      const res = await axios.get(`${baseUrl}/api/v1${endpoint}`, { 
        params, 
        timeout: 8000 // タイムアウトを少し長めに設定
      });
      return res.data;
    } catch (e) {
      console.log(`Instance failed: ${INSTANCES[instanceIndex]}, trying next...`);
      instanceIndex = (instanceIndex + 1) % INSTANCES.length;
      attempts++;
    }
  }
  throw new Error('All Invidious instances are currently unavailable.');
}

app.get('/api/search', async (req, res) => {
  try {
    const data = await fetchInvidious('/search', { q: req.query.q, page: req.query.page || 1, hl: 'ja' });
    const items = data.map(item => ({
      id: { 
        kind: item.type === 'channel' ? 'youtube#channel' : 'youtube#video', 
        videoId: item.videoId, 
        channelId: item.authorId 
      },
      snippet: { 
        title: item.title, 
        channelTitle: item.author, 
        thumbnails: { medium: { url: item.videoThumbnails ? item.videoThumbnails[0].url : '' } } 
      }
    }));
    res.json({ items, nextPage: parseInt(req.query.page || 1) + 1 });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// 動画詳細
app.get('/api/videos', async (req, res) => {
  try {
    const data = await fetchInvidious(`/videos/${req.query.id}`);
    res.json({
      items: [{
        snippet: {
          title: data.title,
          channelId: data.authorId,
          channelTitle: data.author,
          publishedAt: new Date(data.published * 1000).toISOString()
        }
      }]
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// コメント
app.get('/api/comments', async (req, res) => {
  try {
    const data = await fetchInvidious(`/comments/${req.query.id}`);
    const items = (data.comments || []).map(c => ({
      snippet: { topLevelComment: { snippet: { authorDisplayName: c.author, publishedAt: new Date(c.published * 1000).toISOString(), textDisplay: c.content } } }
    }));
    res.json({ items });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// チャンネル情報
app.get('/api/channels', async (req, res) => {
  try {
    const id = req.query.id;
    const data = await fetchInvidious(`/channels/${id}`);
    res.json({
      items: [{
        snippet: { 
          title: data.author, 
          description: data.description, 
          thumbnails: { default: { url: data.authorThumbnails ? data.authorThumbnails[0].url : '' } } 
        },
        statistics: { subscriberCount: data.subCount }
      }]
    });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ヘルスチェック用
app.get('/', (req, res) => res.send('Server is Running!'));

// Render対応ポート設定
const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
