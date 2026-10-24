// Production server for the Shopify app (pnpm start). Same setup as
// react-router-serve, which this replaces, except the request log: its
// morgan("tiny") logged full URLs, including the admin's id_token, hmac and
// session on every embedded load. Here the URL is redacted first.
import path from 'node:path';
import process from 'node:process';
import url from 'node:url';
import { createRequestHandler } from '@react-router/express';
import compression from 'compression';
import express from 'express';
import morgan from 'morgan';
import { redactUrlForLog } from './server/logUrl.mjs';

process.env.NODE_ENV = process.env.NODE_ENV ?? 'production';

const buildPath = path.resolve(process.argv[2] || './build/server/index.js');
const build = await import(url.pathToFileURL(buildPath).href);
const port = Number(process.env.PORT) || 3000;

morgan.token('safe-url', (req) => redactUrlForLog(req.originalUrl || req.url));

const app = express();
app.disable('x-powered-by');
app.use(compression());
app.use(
  path.posix.join(build.publicPath, 'assets'),
  express.static(path.join(build.assetsBuildDirectory, 'assets'), { immutable: true, maxAge: '1y' })
);
app.use(build.publicPath, express.static(build.assetsBuildDirectory));
app.use(express.static('public', { maxAge: '1h' }));
// morgan's "tiny" format with the redacted URL.
app.use(morgan(':method :safe-url :status :res[content-length] - :response-time ms'));
app.all('*', createRequestHandler({ build, mode: process.env.NODE_ENV }));

const server = app.listen(port, () => {
  console.log(`[shopify-shell] http://localhost:${port}`);
});

// PM2 runs several of these (cluster) and reloads them one at a time on deploy:
// it starts the new process, waits until it listens, then sends SIGINT here.
// Stop taking connections, let requests in flight and background jobs finish
// their current step, then exit. PM2's kill_timeout (ecosystem.config.cjs)
// bounds how long this may take.
let shuttingDown = false;
async function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`[shopify-shell] ${signal}: finishing requests in flight`);
  const closed = new Promise((resolve) => server.close(resolve));
  await Promise.all([closed, build.entry?.module?.drainBackgroundWork?.()]);
  process.exit(0);
}
process.on('SIGINT', () => void shutdown('SIGINT'));
process.on('SIGTERM', () => void shutdown('SIGTERM'));
