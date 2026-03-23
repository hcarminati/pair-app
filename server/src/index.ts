import express from "express";

const app = express();
app.use(express.json());

app.get("/health", (_, res) => {
  res.json({ status: "ok" });
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
