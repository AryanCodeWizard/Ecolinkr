import express from "express";
import dotenv from "dotenv";

const app = express();
dotenv.config();

const PORT = Number(process.env.PORT || 3000);

app.get("/health", (_req, res) => {
  res.json({
    service: "auth",
    status: "running",
    port: PORT,
  });
});

app.listen(PORT, () => {
  console.log(`Auth service is running on port ${PORT}`);
});