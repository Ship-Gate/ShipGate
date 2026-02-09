import express from "express";
import { loginHandler } from "./auth/login.js";
import { createUserHandler } from "./users/create.js";
import { getUserHandler } from "./users/get.js";
import { requireAuth, loginRateLimiter } from "./middleware.js";
import { config } from "./config.js";

const app = express();
app.use(express.json());

app.post("/api/auth/login", loginRateLimiter, loginHandler);
app.post("/api/users", createUserHandler);
app.get("/api/users/:id", requireAuth, getUserHandler);

app.listen(config.port, () => {
  process.stdout.write(`Server running on port ${config.port}\n`);
});

export { app };
