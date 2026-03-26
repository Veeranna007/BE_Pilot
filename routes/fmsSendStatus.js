const express = require("express");
const fmsStatusWhatsapp = express.Router();
const MongoClient = require("mongodb").MongoClient;
const moment = require("moment");


// fms performance calculation API
fmsStatusWhatsapp.post("/fmsStatusWhatsapp", async (req, res) => {
    const { companyUrl, userID } = req.body;
    try {
        // Connect to MongoDB and perform operations
        console.log("This function is calling from Postgres");
        console.log("Company URL:", companyUrl);
        const client = await MongoClient.connect(process.env.MONGO_DB_STRING, { useNewUrlParser: true, useUnifiedTopology: true });
        console.log("Connected to database");
        const db = client.db(companyUrl);
        const collection = db.collection("fmsTasks");

        // Current date
        const currentDate = moment().toISOString();

        // Query to find pending tasks for the given employeeId with fmsTaskPlannedCompletionTime < current_date
        const pendingTasksQuery = {
            "fmsTaskDoer.employeeId": userID,
            "fmsTaskStatus": "PENDING",
            "fmsTaskPlannedCompletionTime": { $lt: currentDate }
        };

        const ovedueTasksQuery = {
            "fmsTaskDoer.employeeId": userID,
            "fmsTaskStatus": "OVERDUE",
            "fmsTaskPlannedCompletionTime": { $lt: currentDate }
        };

        const pendingTasks = await collection.find(pendingTasksQuery).toArray();
        const overdueTasks = await collection.find(ovedueTasksQuery).toArray();
        const pendingTaskCount = pendingTasks.length;
        const overdueTaskCount = overdueTasks.length;

        // Return the results
        res.status(200).send({
            pendingTasks: pendingTaskCount,
            overdueTasks: overdueTaskCount,
            status: 200
        });

        // Close the MongoDB connection
        client.close();
    } catch (error) {
        console.error("Error connecting to MongoDB", error);
        res.status(500).send({ error: "Error retrieving tasks", status: 500 });
    }
});

module.exports = fmsStatusWhatsapp;
