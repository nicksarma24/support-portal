import { RequestHandler } from "express";
import jwt from "jsonwebtoken";
import { env } from "../env";
import { COOKIE_NAME } from "../lib/auth";
import { asyncHandler, HttpError } from "../lib/http";
import { Role } from "../lib/schemas";
import { get } from "../db";

/**
 * Verifies the JWT cookie, then loads the user from the DB so that
 * deactivation and role changes take effect immediately (not at token expiry).
 */
export const authenticate: RequestHandler = asyncHandler(async (req, _res, next) => {
  const token = req.cookies?.[COOKIE_NAME];
  if (!token) throw new HttpError(401, "Authentication required");

  let sub: string;
  try {
    const payload = jwt.verify(token, env.JWT_SECRET) as jwt.JwtPayload;
    if (!payload.sub) throw new Error("no subject");
    sub = payload.sub;
  } catch {
    throw new HttpError(401, "Invalid or expired session");
  }

  const user = get<{ id: string; role: string; isActive: number }>(`SELECT id, role, isActive FROM "User" WHERE id = ?`, sub);
  if (!user || !user.isActive) throw new HttpError(401, "Invalid or expired session");

  req.user = { id: user.id, role: user.role as Role };
  next();
});

export const requireRole =
  (...roles: Role[]): RequestHandler =>
  (req, _res, next) => {
    if (!req.user) return next(new HttpError(401, "Authentication required"));
    if (!roles.includes(req.user.role)) return next(new HttpError(403, "You do not have permission to perform this action"));
    next();
  };
