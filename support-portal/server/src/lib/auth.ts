import { env } from "../env";

export const COOKIE_NAME = "sp_token";
export const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: env.NODE_ENV === "production",
  path: "/",
};
