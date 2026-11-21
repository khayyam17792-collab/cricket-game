import express, {
  type Express,
  type NextFunction,
  type Request,
  type Response,
} from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createCricketRouter } from './routes/cricketRoutes.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const rootDir = path.resolve(__dirname, '..');
const distDir = path.join(rootDir, 'dist');
const publicDir = path.join(rootDir, 'public');
const indexHtmlPath = path.join(distDir, 'index.html');

export function resolveIsProduction(): boolean {
  const hasBuiltDist = fs.existsSync(indexHtmlPath);
  const runningUnderTsx = process.execArgv.some((arg) => arg.includes('tsx'));
  const isExplicitDev =
    process.env.NODE_ENV === 'development' ||
    process.env.npm_lifecycle_event === 'dev' ||
    runningUnderTsx;
  return process.env.NODE_ENV === 'production' || (hasBuiltDist && !isExplicitDev);
}

export async function createServerApp(): Promise<{
  app: Express;
  isProd: boolean;
}> {
  const isProd = resolveIsProduction();
  const app = express();

  app.disable('x-powered-by');
  app.use(express.json({ limit: '1mb' }));

  app.get(['/healthz', '/api/health'], (_req, res) => {
    res
      .status(200)
      .json({ ok: true, mode: isProd ? 'production' : 'development' });
  });

  // Explicit favicon routes so browsers never get 404/500 in dev or production
  app.get('/favicon.ico', (_req, res) => {
    const prodIcon = path.join(distDir, 'favicon.ico');
    const pubIcon = path.join(publicDir, 'favicon.ico');
    const target = fs.existsSync(prodIcon) ? prodIcon : pubIcon;
    if (fs.existsSync(target)) {
      res.type('image/x-icon').sendFile(target);
      return;
    }
    res.status(204).end();
  });

  app.get('/favicon.svg', (_req, res) => {
    const prodSvg = path.join(distDir, 'favicon.svg');
    const pubSvg = path.join(publicDir, 'favicon.svg');
    const target = fs.existsSync(prodSvg) ? prodSvg : pubSvg;
    if (fs.existsSync(target)) {
      res.type('image/svg+xml').sendFile(target);
      return;
    }
    res.status(204).end();
  });

  app.use('/api', createCricketRouter());

  if (isProd && fs.existsSync(indexHtmlPath)) {
    app.use(express.static(distDir, { index: 'index.html' }));
    app.use((req, res, next) => {
      if (req.method !== 'GET' || req.path.startsWith('/api/')) {
        next();
        return;
      }
      if (req.path.startsWith('/assets/')) {
        res.status(404).end();
        return;
      }
      res.sendFile(indexHtmlPath, (err) => {
        if (err && !res.headersSent) {
          console.error('Failed to send index.html:', err);
          res.status(500).send('Unable to load application.');
        }
      });
    });
  } else {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error('Unhandled Express error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Internal server error' });
    }
  });

  return { app, isProd };
}
