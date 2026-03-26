const express = require("express");
const awsRouter = express.Router();
var MongoClient = require('mongodb').MongoClient;
const AWS = require('aws-sdk');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const { fetchUserDetails } = require("../../helpers/fetchuserDetails");
require('dotenv').config();

// Configure Multer for file upload
const upload = multer({ dest: 'uploads/' }); // Temporary storage



// to store the files in specific folder
awsRouter.post('/uploadToS3', upload.single('file'), async (req, res) => {
  // to fetch the company url to store the data in the respective folder
  let userDetails = await fetchUserDetails(req.headers.authorization);
  let companyUrl = userDetails.companyUrl;
  console.log("companyUrl in upload", companyUrl);

  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }

  // Read the file from disk
  const fileContent = fs.readFileSync(req.file.path);


  // Set the AWS credentials and region
  AWS.config.update({
    accessKeyId: process.env.AWS_ACCESSKEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION
  });

  // Create S3 service object
  const s3 = new AWS.S3();
  const bucketName = process.env.AWS_S3_BUCKET_NAME;

  // const uploadParams = {
  //   Bucket: bucketName,
  //   Key: `${uploadPath}${Date.now()}_${req.file.originalname}`,
  //   Body: fileContent

  //   // Bucket: process.env.AWS_S3_BUCKET_NAME,
  //   // Key: `uploads/${Date.now()}_${req.file.originalname}`,
  //   // //Body: fs.createReadStream('./File-Storage.jpeg'),
  //   // Body: fileContent
  //   // //ACL: 'public-read' // Optionally, set the ACL to make the file publicly accessible
  // };

  const uploadParams = {
    Bucket: bucketName,
    Key: `${companyUrl ? companyUrl : 'uploads'}/${Date.now()}_${req.file.originalname}`,
    Body: fileContent
  };


  // Upload the file to the S3 bucket
  s3.upload(uploadParams, (err, data) => {
    if (err) {
      console.error("Upload error:", err);
      return res.status(500).json({ message: 'Error uploading file' });
    } else {
      // Delete the temporary file
      fs.unlinkSync(req.file.path);
      console.log("Upload successful:", data.Location);
      // Return the S3 link to the uploaded file
      res.json({ link: data.Location });
    }
  });

})

// to store the logos in logo folder
awsRouter.post('/uploadLogo', upload.single('file'), async (req, res) => {
  // console.log("req.file", req.file);
  if (!req.file) {
    return res.status(400).json({ message: 'No file uploaded' });
  }

  // Read the file from disk
  const fileContent = fs.readFileSync(req.file.path);


  // Set the AWS credentials and region
  AWS.config.update({
    accessKeyId: process.env.AWS_ACCESSKEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION
  });

  // Create S3 service object
  const s3 = new AWS.S3();
  const bucketName = process.env.AWS_S3_BUCKET_NAME;

  // Use "logos" folder for uploads
  const folderName = 'logos';
  const fileName = `${Date.now()}_${req.file.originalname}`;
  const s3Key = `${folderName}/${fileName}`;

  const uploadParams = {
    Bucket: bucketName,
    Key: s3Key,
    Body: fileContent,
  };

  // Upload the file to the S3 bucket
  s3.upload(uploadParams, (err, data) => {
    if (err) {
      console.error("Upload error:", err);
      return res.status(500).json({ message: 'Error uploading file' });
    } else {
      // Delete the temporary file
      fs.unlinkSync(req.file.path);
      console.log("Upload successful:", data.Location);
      // Return the S3 link to the uploaded file
      res.json({ link: data.Location });
    }
  });

})


// Delete route
awsRouter.post('/deleteS3Object', (req, res) => {
  const objectUrl = req.body.objectUrl;

  // Set the AWS credentials and region
  AWS.config.update({
    accessKeyId: process.env.AWS_ACCESSKEY_ID,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    region: process.env.AWS_REGION // e.g., 'us-east-1'
  });

  // Create S3 service object
  const s3 = new AWS.S3();

  // Parse the object URL to extract the bucket name and object key
  const parsedUrl = new URL(objectUrl);
  const bucketName = parsedUrl.hostname.split('.')[0];
  const objectKey = parsedUrl.pathname.substring(1); // Remove the leading slash

  // Set S3 delete parameters
  const params = {
    Bucket: bucketName,
    Key: objectKey
  };

  // Delete object from S3
  s3.deleteObject(params, (err, data) => {
    if (err) {
      console.error('Delete error:', err);
      return res.status(500).json({ message: 'Error deleting object' });
    }

    // Object successfully deleted
    res.json({ message: 'Object deleted successfully' });
  });
});

module.exports = awsRouter;