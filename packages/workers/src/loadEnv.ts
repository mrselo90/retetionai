import path from 'path';
import { fileURLToPath } from 'url';
import { config as loadEnv } from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load monorepo root .env first, then package .env
// We need to resolve from dist/ because this file will be compiled to dist/loadEnv.js
// quiet: dotenv 17+ logs every file it loads; three loads per start is noise.
loadEnv({ path: path.resolve(__dirname, '../../../.env'), quiet: true });
loadEnv({ path: path.resolve(__dirname, '../../.env'), quiet: true });
loadEnv({ quiet: true });

console.log('✅ Environment variables loaded via loadEnv.js');
