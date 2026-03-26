const express = require("express");
const transferFmsTask = express.Router();
var MongoClient = require("mongodb").MongoClient;
const axios = require("axios");
const { ObjectId } = require("mongodb");
const moment = require('moment-timezone');
const { fetchUserDetails } = require("../helpers/fetchuserDetails");
const { infoLogger, errorLogger } = require("../middleware/logger");

// transfer FMS using
transferFmsTask.post("/transferFmsTask", async (req, res) => {
  console.log('INSIDE TRANSFER FMS TASK ----------------------------------------------------')
  console.log('INSIDE TRANSFER FMS TASK ----------------------------------------------------')
  console.log('INSIDE TRANSFER FMS TASK ----------------------------------------------------')
  console.log(req.body)

  // Initialize variables to hold user details
  let userDetails = await fetchUserDetails(req.headers.authorization);
  let userName = userDetails.userName;
  let userID = userDetails.userID;
  let companyUrl = userDetails.companyUrl;
  let userEmail = userDetails.userEmail;

  //try catch block to create a newFmsTask for the new Doer
  try {
    // Connect to MongoDB and perform operations
    const client = await MongoClient.connect(process.env.MONGO_DB_STRING);
    //console.log("Connected to database");
    const db = client.db(companyUrl);
    const collection = db.collection("fmsTasks");
    infoLogger.log("info", `Username:${userName} from company:${companyUrl} hit the api transferFmsTask with body params: ${JSON.stringify(req.body)}`)

    // Find the last inserted document and get its incremental value
    const lastDocument = await collection.find().sort({ _id: -1 }).limit(1).toArray();
    let fmsTaskId = 1;

    if (lastDocument.length > 0) {
      fmsTaskId = lastDocument[0].fmsTaskId + 1;
    }

    console.log("req.body" , req.body)

    const fetchQAId = req.body.task.fmsQAId;
    console.log("fetchQAId", fetchQAId);

    // Fetch documents based on fmsQAId
    const taskDocument = await collection.findOne({  fmsTaskId : req.body.task.fmsTaskId });
    

    
    const result = await collection.updateOne(
      { fmsTaskId: req.body.task.fmsTaskId },
      { $set: { transferredStatus: true } }
    );
    console.log("task document for previous doer", taskDocument.transferredStatus);
    // console.log("req.body.fmsTransferredToUser.employeeId" , req.body.task.fmsTransferredToUser.employeeId);


    if (taskDocument.transferredStatus === true) {
      return res.status(400).json({ error: 'Task has already been transferred' });
    }

    // Validate if the task is being transferred to the same doer
    if (req.body.fmsTransferredToUser.employeeId === taskDocument.fmsTaskDoer.employeeId) {
      return res.status(400).json({ error: 'Task cannot be transferred to the same doer' });
    } else{
      const currentDate = moment().tz('Asia/Kolkata').format();
    // Inserting data into the collection
    const result = await collection.insertOne({
      fmsTaskId,
      fmsQAId: req.body.task.fmsQAId,
      fmsQACreatedBy: req.body.task.fmsQACreatedBy,
      fmsMasterId: req.body.task.fmsMasterId,
      fmsName: req.body.task.fmsName,
      fmsQA: req.body.task.fmsQA,
      fmsTaskDoer: req.body.fmsTransferredToUser,
      fmsTaskStatus: "OVERDUE",
      fmsTaskCompletedStatus: req.body.task.fmsTaskCompletedStatus,  //either ONTIME OR DELAYED
      fmsProcessID: req.body.task.fmsProcessID,
      plannedDate: req.body.task.plannedDate,
      what: req.body.task.what,
      how: req.body.task.how,
      stepId: req.body.task.stepId,
      stepType: req.body.task.stepType,
      fmsTaskCreatedTime: currentDate,
      //fmsTaskPlannedCompletionTime : new Date(new Date().setHours(new Date().getHours() + Number(timeHrs.trim()))),
      fmsTaskCreatedTime: req.body.task.fmsTaskCreatedTime,
      fmsTaskPlannedCompletionTime: req.body.task.fmsTaskPlannedCompletionTime,
      formStepsAnswers: null,
      fmsTaskQualityDetails: null,
      transferredStatus : false,
      fmsTaskTransferredFrom: req.body.task.fmsTaskDoer,
      isTransferredFrom: true,    //is this task transferred FROM other Task
      isTranferredTo: false,       //is this task transferred TO other Task
      transferredFromTaskId: req.body.task.fmsTaskId,
      transferredToTaskId: null,

    });

    }

    
    // console.log(result);
    infoLogger.log("info", `Username:${userName} from company:${companyUrl} transferred task successfully to User:${JSON.stringify(insertedDocument)}`)

    console.log('Created the Task For New Doer');


    // Close the MongoDB connection
    await client.close();
    //console.log('MongoDB connection closed');

    //console.log("New task created for new Doer", newTaskDocument);

    res.json({ message: "Task transferred successfully", status: 200 });
  } catch (error) {
    console.error("Error Connecting to MongoDB", error);
    errorLogger.log("error", `Username:${userName} from company:${companyUrl} failed to transfer task due to ${error.message}`);

    res.status(500).send({ error: "Error transferring task", status: 500 });
  }

  //  //-------------------------Triggr Whatsapp Messages---------------------------------------//
  //  console.log('trigger Whatsapp messages')
  //  console.log(fmsSteps)
  //  // const lastFmsStep = fmsSteps[fmsSteps.length - 1];
  //  try {

  
  // const instancesendWhatsapp = axios.create({ httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }) });
  // const sendWhatsapp = await instancesendWhatsapp.post(
  //   process.env.MAIN_BE_WHATSAPP_URL,
  //   {
  //          verify_company_url: companyUrl,
  //          fmsSteps: fmsSteps
  //   }
  // );

  //      const sendWhatsapp = await axios.post(process.env.MAIN_BE_WHATSAPP_URL, {
  //      verify_company_url: companyUrl,
  //      fmsSteps: fmsSteps
  //      });
  //      console.log('WhatsApp message sent', sendWhatsapp.data);
  //  } catch (whatsappError) {
  //      console.error('Error sending WhatsApp message:', whatsappError);
  //  }

 // res.json({ message: "Task transferred successfully", status: 200 });
});


// in request bodb he will send the task that is to be transferred 
// in this API /submitFmsUserQAcreateTaskStep1 THE LAST TRY CATCH BLOCK IS CREATING THE TASK
// IN THIS aPI /updateFmsTas THE LAST TRY CATCH WE ARE  CREATING A TASK
// add these filds in both these API while creating a task - isTransferredFrom(null if it not transferrd from any other task , otherwise store the transferredfrom taskId) and isTrsansferredTo(NULL INITIALLY , IF IT IS TRANSFERRED STORE THE NEXT TaskId) 
// ADD ONE MORE FIELD tasktRANFERREDBy - in task  QA(add the QA created by details only), 
//AND THEN UPDATE THE DOER FOT THAT TASK

module.exports = transferFmsTask;