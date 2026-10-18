/** Drops everything in the public schema and re-applies migrations. Local development only. */
import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");
if (!/localhost|127\.0\.0\.1/.test(url))
  throw new Error("Refusing to reset a non-local database");

const sql = postgres(url, { max: 1 });
await sql.unsafe("drop schema if exists public cascade");
await sql.unsafe("drop schema if exists drizzle cascade");
await sql.unsafe("create schema public");
await migrate(drizzle(sql), { migrationsFolder: "./src/db/migrations" });
await sql.end();
console.log("Database reset and migrated.");
