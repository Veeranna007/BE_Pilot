const express = require("express");
const createFmsTemplate = express.Router();
const { MongoClient } = require("mongodb");
require("dotenv").config();

createFmsTemplate.post("/createFmsTemplate", async (req, res) => {
    console.log("Inside the createFmsTemplate API");

    try {
        // Connect to MongoDB
        const client = await MongoClient.connect(process.env.MONGO_DB_STRING, { useNewUrlParser: true, useUnifiedTopology: true });
        console.log("Connected to database");

        const db = client.db(process.env.MONGO_TEMPLATE_DB_NAME);
        const collection = db.collection("fms_template");

        // Find the latest document to get the last fmsMasterId
        const lastTemplate = await collection.find().sort({ fmsMasterId: -1 }).limit(1).toArray();
        let newFmsMasterId = lastTemplate.length > 0 ? lastTemplate[0].fmsMasterId + 1 : 1;

        // Extract data from request body
        let newTemplate = req.body;
        newTemplate.fmsMasterId = newFmsMasterId; // Assign incremented ID
        newTemplate.createdAt = new Date().toISOString();
        newTemplate.updatedAt = newTemplate.createdAt;

        // Insert data into MongoDB
        const result = await collection.insertOne(newTemplate);

        console.log("Inserted Template:", result.insertedId, " with fmsMasterId:", newFmsMasterId);

        // Send success response
        res.status(201).json({
            status: 201,
            message: "Template created successfully",
            templateId: result.insertedId,
            fmsMasterId: newFmsMasterId
        });

        // Close MongoDB connection
        await client.close();
        console.log("MongoDB connection closed");

    } catch (error) {
        console.error("Error inserting data into MongoDB", error);
        return res.status(500).json({ error: error.message });
    }
});

module.exports = createFmsTemplate;
