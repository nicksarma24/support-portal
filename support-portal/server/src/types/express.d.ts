import type { Role } from "../lib/schemas";

declare global {
  namespace Express {
    interface Request {
      user?: { id: string; role: Role };
    }
  }
}
export {};
