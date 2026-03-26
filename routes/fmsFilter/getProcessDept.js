const express = require("express");
const getProcessDept = express.Router();
const MongoClient = require('mongodb').MongoClient;
const axios = require('axios');
const { fetchUserDetails } = require("../../helpers/fetchuserDetails");
const { infoLogger, errorLogger } = require("../../middleware/logger");

getProcessDept.get('/getProcessDept', async (req, res) => {

  // Initialize variables to hold user details
  let userDetails = await fetchUserDetails(req.headers.authorization);
  let userName = userDetails.userName;
  let userID = userDetails.userID;
  let companyUrl = userDetails.companyUrl;
  let userEmail = userDetails.userEmail;


  // Extract query parameters from request body
  let { dept_id } = req.query;
  
  try {
    // Connect to MongoDB
    const client = await MongoClient.connect(process.env.MONGO_DB_STRING, { useNewUrlParser: true, useUnifiedTopology: true });
    console.log("Connected to database");
    const db = client.db(companyUrl);
    const collection = db.collection("fmsMaster");
    infoLogger.log("info", `Username: ${userName} from company: ${companyUrl}  hit the getProcessDept with query params: ${JSON.stringify(req.query)}`)


    const query = {};
    // Construct the query object dynamically based on the presence of fields
    if (dept_id) query['fmsProcess.deptId'] = parseInt(dept_id, 10);
    const processList = await collection.find(query).toArray();

    console.log("processList:", processList);

    // Extract the fmsProcess objects from the documents
    const fmsProcesses = processList.map(doc => doc.fmsProcess);

    // Filter out duplicate fmsProcess objects based on processId
    const uniqueFmsProcesses = [];
    const processIds = new Set();
    for (const process of fmsProcesses) {
      if (!processIds.has(process.processId)) {
        processIds.add(process.processId);
        uniqueFmsProcesses.push(process);
      }
    }

    console.log("uniqueFmsProcesses:", uniqueFmsProcesses);
    infoLogger.log("info", `Username: ${userName} from company:${companyUrl} successfully fetch Process for the requested Department ${JSON.stringify(uniqueFmsProcesses)}`)

    // Send the fetched fmsProcess objects as the response
    res.status(200).json({
      message: uniqueFmsProcesses,
      status: 200
    });

    // Close the MongoDB connection
    await client.close();
    console.log('MongoDB connection closed');
  } catch (error) {
    errorLogger.log("error" , `Username:${userName} from company:${companyUrl} failed to fetch Process for the requested Department due to ${error.message}`);

    console.error("Error connecting to MongoDB", error);
    return res.status(500).json({ error: error.message });
  }
});

module.exports = getProcessDept;
