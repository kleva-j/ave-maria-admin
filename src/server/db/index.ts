import { drizzle } from "drizzle-orm/postgres-js";
import { env } from "@/env.mjs";

import postgres from "postgres";

export const client = postgres(env.DATABASE_URL);
export const db = drizzle(client, { logger: true });
