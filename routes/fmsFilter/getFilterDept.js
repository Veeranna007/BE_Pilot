const express = require("express");
const getfilterDept = express.Router();
const MongoClient = require('mongodb').MongoClient;
const axios = require('axios');
const { fetchUserDetails } = require('../../helpers/fetchuserDetails');
const { infoLogger, errorLogger } = require("../../middleware/logger");



getfilterDept.get('/getfilterDept', async (req, res) => {


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
    infoLogger.log("info", `Username: ${userName} from company: ${companyUrl}  hit the apigetfilterDept with query params: ${JSON.stringify(req.query)}`)


    const query = {};
    // Construct the query object dynamically based on the presence of fields
    if (dept_id) query['fmsProcess.deptId'] = parseInt(dept_id, 10);
    const Deptemplist = await collection.find(query).toArray();

    console.log("Deptemplist:", Deptemplist);
    infoLogger.log("info", `Username: ${userName} from company:${companyUrl} successfully fetch the filter department fms data ${JSON.stringify(Deptemplist)}`)

    // Send the fetched documents as the response
    res.status(200).json({
      message: Deptemplist,
      status: 200
    });

    // Close the MongoDB connection
    await client.close();
    console.log('MongoDB connection closed');
  } catch (error) {
    errorLogger.log("error" , `Username:${userName} from company:${companyUrl}  failed to fetch the filter department fms data due to ${error.message}`);
    console.error("Error connecting to MongoDB", error);
    return res.status(500).json({ error: error.message });
  }
});

module.exports = getfilterDept;
