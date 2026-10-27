import cookieParser from "cookie-parser";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./env";
import { errorHandler, notFound } from "./middleware/error";
import authRouter from "./routes/auth";
import ticketsRouter from "./routes/tickets";
import usersRouter, { profileRouter } from "./routes/users";

export const app = express();
app.disable("x-powered-by");
app.use(helmet());
app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));
app.use(express.json({ limit: "100kb" }));
app.use(cookieParser());

app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
app.use("/api/auth", authRouter);
app.use("/api/users", usersRouter);
app.use("/api/profile", profileRouter);
app.use("/api/tickets", ticketsRouter);

app.use(notFound);
app.use(errorHandler);
