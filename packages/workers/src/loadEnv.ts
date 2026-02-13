import path from 'path';
import { fileURLToPath } from 'url';
import { config as loadEnv } from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load monorepo root .env first, then package .env
// We need to resolve from dist/ because this file will be compiled to dist/loadEnv.js
loadEnv({ path: path.resolve(__dirname, '../../../.env') });
loadEnv({ path: path.resolve(__dirname, '../../.env') });
loadEnv();

console.log('✅ Environment variables loaded via loadEnv.js');
