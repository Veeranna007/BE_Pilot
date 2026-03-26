const express = require("express");
const perfomanceCalculation = express.Router();
var MongoClient = require("mongodb").MongoClient;
const axios = require("axios");
const { log } = require("winston");
const { fetchUserDetails } = require("../helpers/fetchuserDetails");
const { infoLogger, errorLogger } = require("../middleware/logger");


// transfer FMS using
perfomanceCalculation.post("/fmsPerfomanceCalculation", async (req, res) => {
  // Initialize variables to hold user details
  let userDetails = await fetchUserDetails(req.headers.authorization);
  let userName = userDetails.userName;
  let userID = userDetails.userID;
  let companyUrl = userDetails.companyUrl;
  let userEmail = userDetails.userEmail;

  try {
    // Connect to MongoDB and perform operations
    const client = await MongoClient.connect(process.env.MONGO_DB_STRING);
    console.log("Connected to database");
    const db = client.db(companyUrl);
    const collection = db.collection("fmsTasks");
    infoLogger.log("info", `Username:${userName} from company:${companyUrl} hit the api fmsPerfomanceCalculation with body params: ${JSON.stringify(req.body)}`)

    const { fmsMasterID } = req.body;

    const cursorFms = collection.find({ fmsMasterId: fmsMasterID });

    const taskDocuments = await cursorFms.toArray();

    console.log("taskDocuments", taskDocuments);

    const TotalpendingCount = taskDocuments.filter(
      (task) => task.fmsTaskStatus === "PENDING"
    ).length;
    const TotaloverdueCount = taskDocuments.filter(
      (task) => task.fmsTaskStatus === "OVERDUE"
    ).length;
    const TotalcompletedCount = taskDocuments.filter(
      (task) => task.fmsTaskStatus === "COMPLETED"
    ).length;
    const TotalDelayedCount = taskDocuments.filter(
      (task) => task.fmsTaskCompletedStatus === "DELAY"
    ).length;

    // to find totalOverduePercentage
    const TotalTask = TotaloverdueCount + TotalpendingCount;
    const PercentageofOverdueTask = TotalTask
      ? (TotaloverdueCount / TotalTask) * 100
      : 0;

    // to find totalDelayedPercentage

    // Percentage of delayed tasks - [ number of delayed tasks / number of completed tasks ]

    const TotalDelayedTaskPercentage = TotalcompletedCount
      ? (TotalDelayedCount / TotalcompletedCount) * 100
      : 0;

    console.log("TotalpendingCount", TotalpendingCount);
    console.log("TotaloverdueCount", TotaloverdueCount);
    console.log("TotalcompletedCount", TotalcompletedCount);
    console.log("TotalDelayedTaskPercentage", TotalDelayedTaskPercentage);
    infoLogger.log("info", `Username:${userName} from company:${companyUrl} successfully fetch the performance calculation for requested fms 
     TotalpendingCount: ${TotalpendingCount},
     TotaloverdueCount: ${TotaloverdueCount},
 TotalcompletedCount: ${TotalcompletedCount},
 PercentageofOverdueTask: ${PercentageofOverdueTask},
  TotalDelayedTaskPercentage:${TotalDelayedTaskPercentage},
  TotalDelayedTaskPercentage:${TotalDelayedTaskPercentage}`);
    res.json({
      message: "performance calculated successfully",
      TotalpendingCount: TotalpendingCount,
      TotaloverdueCount: TotaloverdueCount,
      TotalcompletedCount: TotalcompletedCount,
      PercentageofOverdueTask: PercentageofOverdueTask,
      TotalDelayedTaskPercentage: TotalDelayedTaskPercentage,
      TotalDelayedTaskPercentage: TotalDelayedTaskPercentage,
      status: 200,
    });
  } catch (error) {
    console.error("Error Connecting to MongoDB", error);
    errorLogger.log("error", `Username:${userName} from company:${companyUrl} failed to fetch the performance calculation for requested fms due to ${error.message}`);

    return res.status(400).send({
      error: "Failed to fetch fms performance calculations",
      status: 400,
    });
  }
});

module.exports = perfomanceCalculation;
