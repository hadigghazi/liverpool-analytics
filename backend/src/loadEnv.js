import dotenv from 'dotenv';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
// Repo root, then local backend .env (optional) for per-service overrides
dotenv.config({ path: join(__dirname, '../..', '.env') });
dotenv.config({ path: join(__dirname, '..', '.env') });

export const defaultSeason = process.env.CURRENT_SEASON || '2425';
