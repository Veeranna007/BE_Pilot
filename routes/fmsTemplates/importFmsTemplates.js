const express = require("express");
const importFmsTemplates = express.Router();
const { MongoClient } = require("mongodb");
const { fetchUserDetails } = require("../../helpers/fetchuserDetails");
require("dotenv").config();

importFmsTemplates.post("/importFmsTemplates", async (req, res) => {
    console.log("Inside the import fms template API", req.body);
    const { templateIds } = req.body;
    if (!Array.isArray(templateIds) || templateIds.length === 0) {
        return res.status(400).json({ error: "Invalid request parameters" });
    }

    // Initialize variables to hold user details
    let userDetails = await fetchUserDetails(req.headers.authorization);
    let companyUrl = userDetails.companyUrl;

    try {
        const client = await MongoClient.connect(process.env.MONGO_DB_STRING, { useNewUrlParser: true, useUnifiedTopology: true });
        console.log("Connected to primary database");
        const db = client.db(process.env.MONGO_TEMPLATE_DB_NAME);
        const collection = db.collection("fms_template");


        // to find a templated based on the fms master id
        const templates = await collection.find({
            fmsMasterId: { $in: templateIds }
        }).toArray();

        console.log("Fetched Templates from primary database:", templates);

        await client.close();
        console.log("MongoDB connection closed");

        // Now proceed with inserting into the secondary database
        try {
            const client = await MongoClient.connect(process.env.MONGO_DB_STRING, { useNewUrlParser: true, useUnifiedTopology: true });
            console.log("Connected to secondary database");
            const db = client.db(companyUrl);
            const collection = db.collection("fmsMaster");

            // Find the last inserted document and get its incremental value for fmsMasterId
            const lastDocument = await collection.find().sort({ _id: -1 }).limit(1).toArray();
            let fmsMasterId = 1;

            if (lastDocument.length > 0) {
                fmsMasterId = lastDocument[0].fmsMasterId + 1;
            }

            // Add the fmsMasterId to each template and prepare for insertion
            const templatesWithFmsMasterId = templates.map(template => ({
                ...template,
                fmsMasterId: fmsMasterId++,  // Increment fmsMasterId for each template
                isDraft: true,
                fmsLive: false,
            }));

            // Insert the templates with fmsMasterId into the secondary database
            const insertResult = await collection.insertMany(templatesWithFmsMasterId);

            console.log("Inserted Templates into secondary database:", insertResult);

            await client.close();
            console.log("MongoDB connection closed");

            return res.status(200).json({
                status: 200,
                message: "Data fetched from template database and inserted into specific database successfully",
            });

        } catch (error) {
            console.error("Error inserting data into secondary database", error);
            return res.status(500).json({ error: "Failed to insert into secondary database" });
        }

    } catch (error) {
        console.error("Error fetching data from primary database", error);
        return res.status(500).json({ error: "Failed to fetch from primary database" });
    }
});

module.exports = importFmsTemplates;
