import { env } from "@/env.mjs";
import { pgTableCreator } from "drizzle-orm/pg-core";

const projectName = env.PROJECT_NAME;

export const myPgTable = pgTableCreator(
  (tableName) => `${projectName}_${tableName}`,
);
