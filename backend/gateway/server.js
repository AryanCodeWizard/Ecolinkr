const express = require("express");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 4000);

app.get("/health", (_req, res) => {
  res.json({
    service: "gateway",
    status: "running",
    port: PORT,
  });
});

app.listen(PORT, () => {
  console.log(`Gateway service is running on port ${PORT}`);
});
