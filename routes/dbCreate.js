//--------------Db creattion--------------------------------------------------------------//
const express = require("express");
const dbCreate = express.Router(); 
const { MongoClient } = require('mongodb');
const axios = require('axios');
dbCreate.use(express.json());

dbCreate.post('/dbCreate' , async (req, res) => {
    try { 
        const { dbName } = req.body;
        if (!dbName) {
            res.status(400).send('Database name (dbName) is required.');
            return;
        }

        const client = await MongoClient.connect(process.env.MONGO_DB_STRING);
        
        // Get the admin database
        const adminDb = client.db('admin');
        
        // Check if the database already exists
        const dbList = await adminDb.admin().listDatabases();
        const existingDB = dbList.databases.find(db => db.name === dbName);
        if (existingDB) {
            console.log(`Database '${dbName}' already exists.`);
            res.status(400).send(`Database '${dbName}' already exists.`);
            return; 
        }

        // Get the database
        const db = client.db(dbName);

        // Create collections
        await db.createCollection('fms');
        await db.createCollection('fmsMaster');
        await db.createCollection('fmsTasks');

        console.log('Database and collections created successfully.');
        res.send('Database and collections created successfully.');
    } catch (err) {
        console.error('Error creating database and collections:', err.message);
        res.status(500).send('Error creating database and collections: ' + err.message);
    } 
});

module.exports = dbCreate; 