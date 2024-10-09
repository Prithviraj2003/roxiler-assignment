const express = require("express");
const { initializeDatabase } = require("./controllers/Database");
const { listTransactions, getStatistics, getBarChartData, getPieChartData } = require("./controllers/Transaction");
const app = express();
const port = 8888;
require("dotenv").config();
require("./config/dbConfig")
app.use(express.json());

app.get("/", (req, res) => {
  res.send("Hello world");
});

app.get("/dbInit",initializeDatabase)

app.get("/transactions",listTransactions);

app.get("/getStatisics",getStatistics);

app.get("/barChart",getBarChartData)

app.get("/getPieChartData",getPieChartData)

app.listen(port, () => {
  console.log("server running on ", port);
});
