import * as dotenv from 'dotenv';
import { resolve } from 'path';

// Load .env.test before any test module boots so process.env vars
// are available when NestJS reads JWT_SECRET and DATABASE_URL.
dotenv.config({ path: resolve(__dirname, '../.env.test') });
