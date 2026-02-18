/**
 * Load env before any other app code. Must be the first import in index.ts
 * so that process.env is set before @recete/shared (and others) read it.
 */
import path from 'path';
import { fileURLToPath } from 'url';
import { config as loadEnv } from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
loadEnv({ path: path.resolve(__dirname, '../../../.env') });
loadEnv({ path: path.resolve(__dirname, '../../.env') });
loadEnv();
