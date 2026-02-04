/**
 * Setup for integration tests: load .env before tests run.
 * Ensures REPLICATE_API_TOKEN and other vars are available in the test environment.
 */
import path from 'path';
import { config } from 'dotenv';
config({ path: path.resolve(process.cwd(), '.env'), override: true, quiet: true });
