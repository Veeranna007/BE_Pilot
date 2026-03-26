const express = require('express');
const router = express.Router();
const { MongoClient } = require('mongodb');
require('dotenv').config();

async function getMongoDBSize(dbName) {
    let client;
    try {
        if (!process.env.MONGO_DB_STRING) {
            throw new Error('MongoDB connection string is not configured');
        }

        client = new MongoClient(process.env.MONGO_DB_STRING);
        await client.connect();
        console.log(`Connected to database ${dbName} for size calculation`);

        const db = client.db(dbName);
        const stats = await db.command({ dbStats: 1, scale: 1 }); // Size in bytes

        // Calculate total size including data and indexes
        const totalSizeBytes = stats.dataSize + stats.indexSize;

        // Convert size to KB, MB, or GB dynamically
        let size;
        if (totalSizeBytes < 1024) {
            size = `${totalSizeBytes}B`; // Bytes
        } else if (totalSizeBytes < 1024 * 1024) {
            size = `${(totalSizeBytes / 1024).toFixed(2)}KB`; // Kilobytes
        } else if (totalSizeBytes < 1024 * 1024 * 1024) {
            size = `${(totalSizeBytes / (1024 * 1024)).toFixed(2)}MB`; // Megabytes
        } else {
            size = `${(totalSizeBytes / (1024 * 1024 * 1024)).toFixed(2)}GB`; // Gigabytes
        }

        console.log(`Total size for database ${dbName}: ${size}`);
        return size;
    } catch (error) {
        console.error(`Error getting MongoDB size for database ${dbName}:`, error.message);
        throw error;
    } finally {
        if (client) {
            await client.close();
            console.log(`Closed connection for database ${dbName}`);
        }
    }
}

router.get('/update-mongo-sizes', async (req, res) => {
    let client;
    try {
        if (!process.env.MONGO_DB_STRING) {
            throw new Error('MongoDB connection string is not configured');
        }

        client = new MongoClient(process.env.MONGO_DB_STRING);
        await client.connect();
        console.log('Connected to MongoDB for listing databases');

        const adminDb = client.db('admin');
        const dbList = await adminDb.admin().listDatabases();
        console.log(`Found ${dbList.databases.length} databases`);

        const sizes = [];
        for (const db of dbList.databases) {
            if (['admin', 'config', 'local'].includes(db.name)) continue;
            try {
                const size = await getMongoDBSize(db.name);
                sizes.push({ company_url: db.name, size });
                console.log(`Successfully calculated size for ${db.name}`);
            } catch (error) {
                console.error(`Failed to get size for database ${db.name}:`, error.message);
                sizes.push({ company_url: db.name, size: '0B', error: error.message });
            }
        }

        console.log('Successfully calculated all database sizes');
        res.status(200).json({
            success: true,
            message: 'MongoDB sizes fetched successfully',
            sizes: sizes,
        });
    } catch (error) {
        console.error('Failed to update MongoDB sizes:', error.message);
        res.status(500).json({
            success: false,
            error: error.message,
            message: 'Failed to fetch MongoDB sizes'
        });
    } finally {
        if (client) {
            await client.close();
            console.log('Closed MongoDB connection');
        }
    }
});

module.exports = router;