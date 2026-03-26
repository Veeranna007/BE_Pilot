const express = require("express");
const getFmsTasks = express.Router();
var MongoClient = require('mongodb').MongoClient;
const axios = require('axios');
const moment = require('moment-timezone');
const { fetchUserDetails } = require("../../helpers/fetchuserDetails");
const { infoLogger, errorLogger } = require("../../middleware/logger");


//find ALL FMS Tasks FOR A USER 
getFmsTasks.get('/findAllFmsTasksForUser', async (req, res) => {

    //console.log('Get All FMS tASKS fOR A User')

    // Initialize variables to hold user details
    let userDetails = await fetchUserDetails(req.headers.authorization);
    let userName = userDetails.userName;
    let userID = userDetails.userID;
    let companyUrl = userDetails.companyUrl;
    let userEmail = userDetails.userEmail;


    try {
        // Connect to MongoDB and perform operations
        const client = await MongoClient.connect(process.env.MONGO_DB_STRING);
        //console.log('Connected to database');
        const db = client.db(companyUrl);
        const collection = db.collection('fmsTasks');
        infoLogger.log("info", `Username: ${userName} from company: ${companyUrl}  hit the api findAllFmsTasksForUser`)

        const cursor = collection.find({ "fmsTaskDoer.employeeId": userID });
        const documents = await cursor.toArray();

        console.log("documents", documents);
        infoLogger.log("info", `Username: ${userName} from company:${companyUrl} successfully fetch all fms tasks:${JSON.stringify(documents)}`)

        //console.log(documents)
        res.json({
            "message": [documents],
            "status": 200
        })

        // Close the MongoDB connection
        await client.close();
        //console.log('MongoDB connection closed');
    }
    catch (error) {
        console.error('Error Connecting to MongoDB', error);
        errorLogger.log("error" , `Username:${userName} from company:${companyUrl} failed to fetch all fms tasks due to ${error.message}`);

        return res.status(500).json({ error: error.message });
    }
})

//find ALL FMS Tasks FOR A USER THAT ARE DUE TODAY AND ALL OVERDUE TASKS
getFmsTasks.get('/findAllFmsTasksForUserPendingOrOverdue', async (req, res) => {

    //console.log('Get All FMS tASKS fOR A User Pending Or Overdue')

    // Initialize variables to hold user details
    let userDetails = await fetchUserDetails(req.headers.authorization);
    let userName = userDetails.userName;
    let userID = userDetails.userID;
    let companyUrl = userDetails.companyUrl;
    let userEmail = userDetails.userEmail;

    //update pending task to overdue based on current time
    try {
        const client = await MongoClient.connect(process.env.MONGO_DB_STRING);
        //console.log('Connected to database');
        const db = client.db(companyUrl);
        const collection = db.collection('fmsTasks');
        infoLogger.log("info", `Username: ${userName} from company: ${companyUrl}  hit the api findAllFmsTasksForUserPendingOrOverdue`)


        const pendingTasks = await collection.find({ fmsTaskStatus: 'PENDING', 'fmsTaskDoer.employeeId': userID }).toArray();
        //console.log('Pending tasks:', pendingTasks);

        const currentTimeIST = moment().tz('Asia/Kolkata').format();


        for (const task of pendingTasks) {

            if (task.fmsTaskPlannedCompletionTime < currentTimeIST) {
                await collection.updateOne(
                    { fmsTaskId: task.fmsTaskId },
                    { $set: { fmsTaskStatus: 'OVERDUE' } }
                );
                //console.log(`Task ${task.fmsTaskId} marked as OVERDUE`);
            }
        }

        // Close the database connection
        await client.close();


    } catch (error) {
        console.error('Error Connecting to MongoDB', error);
        return res.status(500).json({ error: error.message });
    }

    //to fetch all tasks for a user wich are pending and overdue
    try {
        // Connect to MongoDB and perform operations
        const client = await MongoClient.connect(process.env.MONGO_DB_STRING);
        //console.log('Connected to database');
        const db = client.db(companyUrl);
        const collection = db.collection('fmsTasks');

        const cursor = collection.find({
            "fmsTaskDoer.employeeId": userID,
            $or: [
                { fmsTaskStatus: "PENDING" },
                { fmsTaskStatus: "OVERDUE" }
            ]
        });
        const documents = await cursor.toArray();
        //console.log(documents)
        infoLogger.log("info", `Username: ${userName} from company:${companyUrl} successfully fetch all fms pending or overdue tasks:${JSON.stringify(documents)}`)

        res.json({
            "message": [documents],
            "status": 200
        })

        // Close the MongoDB connection
        await client.close();
        //console.log('MongoDB connection closed');
    }
    catch (error) {
        console.error('Error Connecting to MongoDB', error);
        errorLogger.log("error" , `Username:${userName} from company:${companyUrl} failed to fetch all fms pending or overdue tasks due to ${error.message}`);

        return res.status(500).json({ error: error.message });
    }
})

// //find ALL FMS Tasks FOR A USER THAT ARE DUE TODAY AND ALL OVERDUE TASKS
// getFmsTasks.get('/findAllFmsTasksForUserPendingOrOverdue' , async (req, res) => {

//     console.log('Get All FMS tASKS fOR A User Pending Or Overdue')

//     // Initialize variables to hold user details
//     let userName = "";
//     let userID = "";
//     let companyUrl = "";
//     let userEmail = "";

//     console.log(req.headers.authorization)
//       const authHeader = req.headers.authorization;
//       if (!authHeader || !authHeader.startsWith("Bearer")) {
//         console.log("error: Authorization header missing or malformed");
//         return res.status(401).json({ error: 'Unauthorized' });
//       }
//       const token = authHeader.split(" ")[1];

//       console.log('token fetched is ' , token)

//       try {
//         // Fetch user details and company details based on the token
//         const response = await axios.post(process.env.MAIN_BE_URL, { token: token });
//         console.log('Fetched User Details and Company Details', response.data);
//         userName = response.data.emp_name;
//         userID = response.data.user_id;
//         companyUrl = response.data.verify_company_url;
//         userEmail = response.data.email_id;
//     } catch (error) {
//         console.error('Error posting data:', error);
//          res.status(500).send({ error: 'Error fetching user details', status: 500 });
//         return;
//     }

//     try {
//         // Connect to MongoDB and perform operations
//         const client = await MongoClient.connect(process.env.MONGO_DB_STRING);
//         console.log('Connected to database');
//         const db = client.db(companyUrl);
//         const collection = db.collection('fmsTasks');

//         const cursor = collection.find({
//             "fmsTaskDoer.employeeId": userID,
//             $or: [
//               { fmsTaskStatus: "PENDING" },
//               { fmsTaskStatus: "OVERDUE" }
//             ]
//           });
//         const documents = await cursor.toArray();

//         console.log(documents)
//         res.json({
//             "message" : [documents],
//             "status" : 200
//         })

//         // Close the MongoDB connection
//         await client.close();
//         console.log('MongoDB connection closed');
//     } 
//     catch (error) {
//         console.error('Error Connecting to MongoDB', error);
//          res.status(500).send({ error: `Error Connecting to MongoDB`, status: 500 });
//     }
// })

//ALL OVERDUE tasks irrespective of fms and process
getFmsTasks.get('/findAllFmsOverDueTasks', async (req, res) => {

    // Initialize variables to hold user details
    let userDetails = await fetchUserDetails(req.headers.authorization);
    let userName = userDetails.userName;
    let userID = userDetails.userID;
    let companyUrl = userDetails.companyUrl;
    let userEmail = userDetails.userEmail;


    try {
        // Connect to MongoDB and perform operations
        const client = await MongoClient.connect(process.env.MONGO_DB_STRING);
        //console.log('Connected to database');
        const db = client.db(companyUrl);
        const collection = db.collection('fmsTasks');
        infoLogger.log("info", `Username: ${userName} from company: ${companyUrl}  hit the api findAllFmsOverDueTasks`)


        const cursor = collection.find({ fmsTaskStatus: "OVERDUE" });
        const documents = await cursor.toArray();

        //console.log(documents)
        infoLogger.log("info", `Username: ${userName} from company:${companyUrl} successfully fetch all fms overdue tasks:${JSON.stringify(documents)}`)

        res.json({
            "message": [documents],
            "status": 200
        })

        // Close the MongoDB connection
        await client.close();
        //console.log('MongoDB connection closed');
    }
    catch (error) {
        console.error('Error Connecting to MongoDB', error);
        errorLogger.log("error" , `Username:${userName} from company:${companyUrl} failed to fetch all overdue tasks due to ${error.message}`);

        return res.status(500).json({ error: error.message });
    }
})

//ALL PENDING tasks irrespective of fms and process
getFmsTasks.get('/findAllFmsPendingTasks', async (req, res) => {

    // Initialize variables to hold user details
    let userDetails = await fetchUserDetails(req.headers.authorization);
    let userName = userDetails.userName;
    let userID = userDetails.userID;
    let companyUrl = userDetails.companyUrl;
    let userEmail = userDetails.userEmail;


    try {
        // Connect to MongoDB and perform operations
        const client = await MongoClient.connect(process.env.MONGO_DB_STRING);
        //console.log('Connected to database');
        const db = client.db(companyUrl);
        const collection = db.collection('fmsTasks');
        infoLogger.log("info", `Username: ${userName} from company: ${companyUrl}  hit the api findAllFmsPendingTasks`)


        const cursor = collection.find({ fmsTaskStatus: "PENDING" });
        const documents = await cursor.toArray();

        //console.log(documents)
        infoLogger.log("info", `Username: ${userName} from company:${companyUrl} successfully fetch all fms pending tasks:${JSON.stringify(documents)}`)

        res.json({
            "message": [documents],
            "status": 200
        })

        // Close the MongoDB connection
        await client.close();
        //console.log('MongoDB connection closed');
    }
    catch (error) {
        console.error('Error Connecting to MongoDB', error);
        errorLogger.log("error" , `Username:${userName} from company:${companyUrl} failed to fetch all pending tasks due to ${error.message}`);
        return res.status(500).json({ error: error.message });
    }
})

//ALL OVERDUE tasks irrespective of fms and process for user
getFmsTasks.get('/findAllFmsOverdueTasksForUser', async (req, res) => {

    // Initialize variables to hold user details
    let userDetails = await fetchUserDetails(req.headers.authorization);
    let userName = userDetails.userName;
    let userID = userDetails.userID;
    let companyUrl = userDetails.companyUrl;
    let userEmail = userDetails.userEmail;


    try {
        // Connect to MongoDB and perform operations
        const client = await MongoClient.connect(process.env.MONGO_DB_STRING);
        //console.log('Connected to database');
        const db = client.db(companyUrl);
        const collection = db.collection('fmsTasks');
        infoLogger.log("info", `Username: ${userName} from company: ${companyUrl}  hit the api findAllFmsOverdueTasksForUser`)


        const cursor = collection.find({ fmsTaskStatus: "OVERDUE", "fmsTaskDoer.employeeId": userID });
        const documents = await cursor.toArray();

        //console.log(documents)
        infoLogger.log("info", `Username: ${userName} from company:${companyUrl} successfully fetch his/her fms overdue tasks:${JSON.stringify(documents)}`)

        res.json({
            "message": [documents],
            "status": 200
        })

        // Close the MongoDB connection
        await client.close();
        //console.log('MongoDB connection closed');
    }
    catch (error) {
        console.error('Error Connecting to MongoDB', error);
        errorLogger.log("error" , `Username:${userName} from company:${companyUrl} failed to fetch his/her overdue tasks due to ${error.message}`);

        return res.status(500).json({ error: error.message });
    }
})

//All Tasks for a process coordinator pc 
getFmsTasks.get('/findAllFmsOverdueTasksForPc', async (req, res) => {

    // Initialize variables to hold user details
    let userDetails = await fetchUserDetails(req.headers.authorization);
    let userName = userDetails.userName;
    let userID = userDetails.userID;
    let companyUrl = userDetails.companyUrl;
    let userEmail = userDetails.userEmail;


    //fetching all fms masterId'S THE PC IS PART OF
    let fmsMasterIds = [];
    try {
        // Connect to MongoDB and perform operations
        const client = await MongoClient.connect(process.env.MONGO_DB_STRING);
        //console.log('Connected to database');
        const db = client.db(companyUrl);
        const collection = db.collection('fmsMaster');
        infoLogger.log("info", `Username: ${userName} from company: ${companyUrl} hit the api findAllFmsOverdueTasksForPc`)


        // Query to find documents with processCoordinatorId of 1
        const query = { "fmsProcess.processCoordinatorName": userName };
        //const projection = { fmsMasterId: 2 }; // Include only fmsMasterId
        const documents = await collection.find(query).toArray();

        // Extract fmsMasterId values into an array
        fmsMasterIds = documents.map(doc => doc.fmsMasterId);

        //console.log('fms  the pc is part of ' , userName)
        //console.log(fmsMasterIds);
        // res.json({
        //     "message" : [fmsMasterIds],
        //     "status" : 200
        // })

        // Close the MongoDB connection
        await client.close();
        //console.log('MongoDB connection closed');
    }
    catch (error) {
        console.error('Error Connecting to MongoDB', error);
        return res.status(500).json({ error: error.message });
    }

    //////////////fetching all  tasks

    let overDueTasksForPc;
    try {
        // Connect to MongoDB and perform operations
        const client = await MongoClient.connect(process.env.MONGO_DB_STRING);
        //console.log('Connected to database to get overDueTasksForPc');
        const db = client.db(companyUrl);
        const collection = db.collection('fmsTasks');

        // Query to find documents with processCoordinatorId of 1
        const query = {
            fmsMasterId: { $in: fmsMasterIds },
            fmsTaskStatus: "OVERDUE" // Assuming 'isOverdue' is a boolean field indicating if the task is overdue
        };

        overDueTasksForPc = await collection.find(query).toArray();


        infoLogger.log("info", `Username: ${userName} from company:${companyUrl} successfully fetch over due tasks for pc:${JSON.stringify(overDueTasksForPc)}`)

        //console.log(overDueTasksForPc);

        // Close the MongoDB connection
        await client.close();
        //console.log('MongoDB connection closed');
    }
    catch (error) {

        console.error('Error Connecting to MongoDB', error);
        errorLogger.log("error" , `Username:${userName} from company:${companyUrl} failed to fetch over due tasks for pc due to ${error.message}`);

        return res.status(500).json({ error: error.message });
    }

    //console.log(fmsMasterIds)
    //console.log(overDueTasksForPc)
    //res.send(overDueTasksForPc)
    res.json({
        "message": [overDueTasksForPc],
        "status": 200
    })
})




module.exports = getFmsTasks;