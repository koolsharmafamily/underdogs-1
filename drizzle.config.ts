import { defineConfig } from "drizzle-kit";

// Only used to generate SQL migrations (`npm run db:generate`).
// The app applies them itself on start: see src/lib/db/migrate.ts.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/lib/db/schema.ts",
  out: "./drizzle",
  casing: "snake_case",
});
