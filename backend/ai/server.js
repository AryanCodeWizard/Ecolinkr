const express = require("express");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 5000);

app.get("/health", (_req, res) => {
  res.json({
    service: "ai",
    status: "running",
    port: PORT,
  });
});

app.listen(PORT, () => {
  console.log(`AI service is running on port ${PORT}`);
});
