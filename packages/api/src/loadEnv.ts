/**
 * Load env before any other app code. Must be the first import in index.ts
 * so that process.env is set before @recete/shared (and others) read it.
 */
import path from 'path';
import { fileURLToPath } from 'url';
import { config as loadEnv } from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// quiet: dotenv 17+ logs every file it loads; three loads per start is noise.
loadEnv({ path: path.resolve(__dirname, '../../../.env'), quiet: true });
loadEnv({ path: path.resolve(__dirname, '../../.env'), quiet: true });
loadEnv({ quiet: true });
