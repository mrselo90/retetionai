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

app.listen(port, () => {
  console.log(`[shopify-shell] http://localhost:${port}`);
});
