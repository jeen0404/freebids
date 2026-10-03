import 'dotenv/config';
import fs from 'node:fs';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { assertProductionReady } from './src/server/launchChecks';
import { createApp, serveHtml } from './src/server/app';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function startServer() {
  assertProductionReady();

  const app = createApp();
  const PORT = Number(process.env.PORT) || 3000;

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });
    app.use(vite.middlewares);
    serveHtml(app, async (req) => {
      const raw = await fs.promises.readFile(path.resolve(__dirname, 'index.html'), 'utf-8');
      return vite.transformIndexHtml(req.originalUrl, raw);
    });
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    const template = fs.readFileSync(path.resolve(distPath, 'index.html'), 'utf-8');
    app.use('/assets', express.static(path.resolve(distPath, 'assets'), { immutable: true, maxAge: '1y' }));
    app.use(express.static(distPath, { index: false, maxAge: '1h' }));
    serveHtml(app, async () => template);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`FreeBids server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
