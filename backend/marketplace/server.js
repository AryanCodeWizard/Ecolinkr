const express = require("express");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 7000);

app.get("/health", (_req, res) => {
  res.json({
    service: "marketplace",
    status: "running",
    port: PORT,
  });
});

app.listen(PORT, () => {
  console.log(`Marketplace service is running on port ${PORT}`);
});
