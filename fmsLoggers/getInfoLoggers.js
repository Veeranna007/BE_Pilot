const fs = require("fs");
const path = require("path");
const express = require("express");
const infoLoggerFms = express.Router();
const errorLoggerFms  = express.Router();
var MongoClient = require('mongodb').MongoClient;

infoLoggerFms.get('/infoLoggers', async (req, res) => {
  const { date } = req.body;
 
  try {
    // Specify the path to your app.log file
    console.log("inside logger file")
    const logFilePath = path.join(__dirname, `../loggers/info-${date}.log`);
 

    // Read the contents of the log file
    fs.readFile(logFilePath, "utf8", (err, data) => {
      if (err) {
        return res.status(404).json({ error: "No Log file found for specified date" });
      }
      // Remove carriage returns (\r) from the log file content
      const cleanedData = data.replace(/\r/g, "");

      // Split the log file content into an array of lines
      const logs = cleanedData.split("\n").filter((log) => log.trim() !== "");

      console.log(logs);
      // Return the logs as JSON
      res.json({ logs });
    });
  } catch (error) {
    res.status(500).json({ error: "Internal server error" });
  }
});





module.exports = infoLoggerFms;
