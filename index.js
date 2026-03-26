var express = require('express');
const cors = require('cors');
const axios = require('axios');
var MongoClient = require('mongodb').MongoClient;
require('dotenv').config();
var app = express();


// Middleware to parse JSON bodies
app.use(express.json());

// Use CORS middleware
app.use(cors());

//Checking to see for deployment test
app.get('/hello', function (req, res) {
   res.send('Hello World');
})

//API to see for MongoDB Connection
app.get('/helloMongo', function (req, res) {
  MongoClient.connect(process.env.MONGO_DB_STRING)
  .then(async client => {
      console.log('Connected to MongoDB')
      res.send('Connected to MongoDB ')
      //const db = client.db('testDb')
      //const collection = db.collection('testCollection') 

  })
  .catch(error=> {
    console.error('Error Connecting to MongoDB' , error)
    res.send('Error Connecting to MongoDB' , error)
  })
})      

//Checking to see for MongoDB Connection on Node Startup
MongoClient.connect(process.env.MONGO_DB_STRING)
.then(async client => {
  console.log('Connected to MongoDB')
  //const db = client.db('testDb')
  //const collection = db.collection('testCollection') 
})
.catch(error=> {
console.error('Error Connecting to MongoDB' , error)
})    
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

const getUserDetails = require('./routes/user/user'); 
app.post('/tokenCheck', function (req, res) {
  console.log(req.body.token)
  axios.post(process.env.MAIN_BE_URL, {token : req.body.token})
    .then(response => {
      console.log('Data posted successfully:', response.data);
      res.send(response.data); // Return the response data
    })
    .catch(error => {
      console.error('Error posting data:', error);
      res.send(error); // Rethrow the error to be handled by the caller
    });
}) 

// app.post('/submitFMSQuestionare', function (req, res) {
  
//   MongoClient.connect(process.env.MONGO_DB_STRING)
//     .then(async client => {
//         console.log('Connected to database')
//         const db = client.db('surya')
//         const collection = db.collection('fmsMaster')
        
//         // Find the last inserted document and get its incremental value
//         const lastDocument = await collection.find().sort({ _id: -1 }).limit(1).toArray();
//         let incrementalValue = 1;

//         if (lastDocument.length > 0) {
//             incrementalValue = lastDocument[0].incrementalValue + 1;
//         }

//         // Inserting data into the collection
//         const result = await collection.insertOne({
//             incrementalValue,
//             fmsName : req.body.fmsName,
//             fmsDescription : req.body.fmsDescription,
//             fmsProcess : req.body.fmsProcess
//         });

//         console.log(result)
//         res.json({
//             "message" : `${req.body.fmsName} Step 1 is Successfully Created`,
//             "status" : 200
//         })
//     })
//     .catch(error => {
//         console.error('Error Connecting to MongoDB' , error)
//         res.json({
//             "message" : `${req.body.fmsName} Step 1 is NOT Created`,
//             "status" : 500
//         })
//     })
 
// }) 




//--GET FMS------------------------------------------------------------//
const getFms = require("./routes/getFms/getFms");
app.use("/getFms", getFms);


//--FMS INITIALISATION--------------------------------------------------//
const fmsInitilisation = require("./routes/initializeFms/initialiseFms");
app.use("/fmsInitilisation", fmsInitilisation);


//--AWS S3-------------------------------------------------------------//
const aws = require("./routes/s3Functions/awsS3functions");
app.use("/awsS3", aws);
//--------------------------------------------------------------------//
const submitQA = require("./routes/submitFmsQuestionare");
app.use("/submitQA", submitQA);
//---------------------------------------------------------------------//
const getFmsTasks = require("./routes/getFmsTasks/getFmsTasks");
app.use("/getFmsTasks", getFmsTasks);

//----------------------------------------------------------------------//
const updateTask = require("./routes/updateFmsTask");
app.use("/updateTask", updateTask);

//----------------------------------------------------------------------//
const updateDecisionTask = require("./routes/updateDecisionTask");
app.use("/updateDecisionTask", updateDecisionTask);

//----------------------------------------------------------------------//
const transferFmsTask = require("./routes/transferFmsTask");
app.use("/transferFmsTask", transferFmsTask);

//----------------------------------------------------------------------//
const fmsTasksPerformance = require("./routes/fmsTasksPerformanceCalculation");
app.use("/fmsPerformance", fmsTasksPerformance);

//----------------------------------------------------------------------//
const dbCreation = require("./routes/dbCreate");
app.use("/dbCreate", dbCreation);

//----------------------------------------------------------------------//
const getfilterDoer = require("./routes/fmsFilter/getFilterDoer");
app.use("/getfilterDoer", getfilterDoer);

//----------------------------------------------------------------------//
const getfilterAdmin = require("./routes/fmsFilter/getFilterAdmin");
app.use("/getfilterAdmin", getfilterAdmin);

//----------------------------------------------------------------------//
const getfilterPC = require("./routes/fmsFilter/getFilterPc");
app.use("/getfilterPC", getfilterPC);

//----------------------------------------------------------------------//
const getfilterfmsDept = require("./routes/fmsFilter/getFilterfmsDept");
app.use("/getfilterfmsDept", getfilterfmsDept);

//----------------------------------------------------------------------//
const getProcessDept = require("./routes/fmsFilter/getProcessDept");
app.use("/getProcessDept", getProcessDept);


//----------------------------------------------------------------------//
const fmsdataanalytics = require("./routes/fmsDataAnalytics");
app.use("/fmsdataanalytics", fmsdataanalytics);

//----------------------------------------------------------------------//
const fmsPerformancePreviousweekDept = require("./routes/fmsPerformancePreviousweekDept");
app.use("/fmsPerformancePreviousweekDept", fmsPerformancePreviousweekDept);
 
//----------------------------------------------------------------------//
const fmsPerformanceCurrentweekDept = require("./routes/fmsPerformanceCurrentweekDept");
app.use("/fmsPerformanceCurrentweekDept", fmsPerformanceCurrentweekDept);

//----------------------------------------------------------------------//
const updateQualitySteps = require("./routes/updateQualityStep");
app.use("/updateQualitySteps", updateQualitySteps);

//----------------------------------------------------------------------//
const fmsStatusWhatsapp = require("./routes/fmsSendStatus");
app.use("/fmsStatusWhatsapp", fmsStatusWhatsapp);
//----------------------------------------------------------------------//


//----------------------------------------------------------------------//
const fmsTemplates = require("./routes/fmsTemplates/getFmsTemplates");
app.use("/fmsTemplates", fmsTemplates);
//----------------------------------------------------------------------//

//----------------------------------------------------------------------//
const importFmsTemplates = require("./routes/fmsTemplates/importFmsTemplates");
app.use("/importFmsTemplates", importFmsTemplates);
//----------------------------------------------------------------------//

//----------------------------------------------------------------------//
const postFmsTemplates = require("./routes/fmsTemplates/createFmsTemplate");
app.use("/postFmsTemplates" , postFmsTemplates);
//----------------------------------------------------------------------//

const infoLoggerFms = require("./fmsLoggers/getInfoLoggers");
app.use("/infoLoggerFms", infoLoggerFms);

const errorLoggerFms = require("./fmsLoggers/getErrorLoggers");
app.use("/errorLoggerFms", errorLoggerFms);

// Database Size Tracking Route
const dbSizeTracker = require("./routes/dbSizeTracker");
app.use("/dbSize", dbSizeTracker);




var server = app.listen(process.env.PORT, function () {
   console.log(`Express App running on PORT ${process.env.PORT}`);
})
