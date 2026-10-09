import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const UPSTREAM_API = 'https://oshinoko-chapter-api.vercel.app/manga/oshinoko';

// In-memory cache so subsequent page loads are instantaneous
let cachedMangaData: unknown = null;
let lastFetchTime = 0;
const CACHE_TTL_MS = 10 * 60 * 1000; // 10 minutes

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Server-side proxy route to bypass browser CORS restrictions
  app.get('/api/manga', async (_req, res) => {
    try {
      const now = Date.now();
      if (cachedMangaData && now - lastFetchTime < CACHE_TTL_MS) {
        return res.json(cachedMangaData);
      }

      const upstreamRes = await fetch(UPSTREAM_API, {
        headers: {
          Accept: 'application/json',
          'User-Agent': 'OshiNoKo-Book-Reader/1.0',
        },
      });

      if (!upstreamRes.ok) {
        throw new Error(`Upstream API returned status ${upstreamRes.status}`);
      }

      const data = await upstreamRes.json();
      cachedMangaData = data;
      lastFetchTime = now;

      res.json(data);
    } catch (error: unknown) {
      console.error('Error fetching from upstream manga API:', error);
      if (cachedMangaData) {
        return res.json(cachedMangaData);
      }
      res.status(502).json({
        error: 'Failed to fetch manga chapters from upstream API',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
