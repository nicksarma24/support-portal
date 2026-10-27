import { ErrorRequestHandler, RequestHandler } from "express";
import { ZodError } from "zod";
import { HttpError } from "../lib/http";

export const notFound: RequestHandler = (_req, res) => {
  res.status(404).json({ error: { message: "Route not found" } });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof ZodError) {
    const message = err.issues.map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message)).join("; ");
    return res.status(400).json({ error: { message, details: err.issues } });
  }
  if (err instanceof HttpError) return res.status(err.status).json({ error: { message: err.message } });
  if (err?.code === "ERR_SQLITE_ERROR" && typeof err.message === "string") {
    if (err.message.includes("UNIQUE constraint failed")) return res.status(409).json({ error: { message: "A record with that value already exists" } });
    if (err.message.includes("FOREIGN KEY constraint failed")) return res.status(400).json({ error: { message: "Referenced record does not exist or is still in use" } });
  }
  if (err instanceof SyntaxError && "body" in err) return res.status(400).json({ error: { message: "Malformed JSON body" } });
  console.error(err);
  res.status(500).json({ error: { message: "Internal server error" } });
};
