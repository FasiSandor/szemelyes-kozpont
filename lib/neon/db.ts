import { neon } from "@neondatabase/serverless";

export function isNeonConfigured() {
  return Boolean(process.env.DATABASE_URL);
}

export function sql() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("Neon DATABASE_URL nincs még beállítva.");
  return neon(url);
}
