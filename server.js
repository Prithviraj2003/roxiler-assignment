const express = require("express");
const {
  listTransactions,
  getStatistics,
  getBarChartData,
  getPieChartData,
} = require("./controllers/Transaction");
const app = express();
const port = 8888;
require("dotenv").config();
const cors=require('cors');
app.use(cors());
require("./config/dbConfig");
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Hello world");
});

app.get("/transactions", async (req, res) => {
  const data = await listTransactions(req);
  res.json(data);
});

app.get("/getStatisics", async (req, res) => {
  const data = await getStatistics(req);
  res.json(data);
});

app.get("/getBarChartData", async (req, res) => {
  const data = await getBarChartData(req);
  res.json(data);
});

app.get("/getPieChartData", async (req, res) => {
  const data = await getPieChartData(req);
  res.json(data);
});

app.get("/combinedData", async (req, res) => {
  const transactions = await listTransactions(req);
  const statistics = await getStatistics(req);
  const barData = await getBarChartData(req);
  const pieData = await getPieChartData(req);
  res.json({ transactions, statistics, barData, pieData });
});

app.listen(port, () => {
  console.log("server running on ", port);
});
