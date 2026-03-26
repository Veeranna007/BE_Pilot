const express = require("express");
const getFmsTemplates = express.Router();
const { MongoClient } = require('mongodb');
require("dotenv").config();

getFmsTemplates.get("/getFmsTemplates", async (req, res) => {
    console.log("Inside the getFmsTemplates API");

    try {
        // Connect to MongoDB
        const client = await MongoClient.connect(process.env.MONGO_DB_STRING, { useNewUrlParser: true, useUnifiedTopology: true });
        console.log("Connected to database");
        const db = client.db(process.env.MONGO_TEMPLATE_DB_NAME);
        const collection = db.collection("fms_template");

        // Fetch all fmsTemplates
        const templates = await collection.find({}).toArray();

        console.log("Fetched Templates:", templates);

        // Send the fetched fmsTemplates as the response
        res.status(200).json({
            status: 200,
            data: templates,
        });

        // Close the MongoDB connection
        await client.close();
        console.log("MongoDB connection closed");

    } catch (error) {
        console.error("Error fetching data from MongoDB", error);
        return res.status(500).json({ error: error.message });
    }
});

module.exports = getFmsTemplates;