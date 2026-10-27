import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  DATABASE_PATH: z.string().min(1).default("./data/portal.db"),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  SESSION_HOURS: z.coerce.number().positive().default(8),
  PORT: z.coerce.number().default(4000),
  CLIENT_ORIGIN: z.string().default("http://localhost:5173"),
  NODE_ENV: z.string().default("development"),
});

export const env = schema.parse(process.env);
