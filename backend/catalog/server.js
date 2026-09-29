const express = require("express");
const dotenv = require("dotenv");

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT || 6000);

app.get("/health", (_req, res) => {
  res.json({
    service: "catalog",
    status: "running",
    port: PORT,
  });
});

app.listen(PORT, () => {
  console.log(`Catalog service is running on port ${PORT}`);
});
