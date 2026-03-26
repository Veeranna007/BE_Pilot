const express = require("express");
const initialiseFms = express.Router();
var MongoClient = require('mongodb').MongoClient;
const axios = require('axios');
const moment = require('moment-timezone');
const { infoLogger, errorLogger } = require("../../middleware/logger");
const { fetchUserDetails } = require("../../helpers/fetchuserDetails");
const { version } = require("os");

initialiseFms.post('/fmsStep1', async (req, res) => {
  console.log("Fms Step 1 API hit");
  console.log(req.body);

  // Initialize variables to hold user details
  let userDetails = await fetchUserDetails(req.headers.authorization);
  let userName = userDetails.userName;
  let userID = userDetails.userID;
  let companyUrl = userDetails.companyUrl;
  let userEmail = userDetails.userEmail;


  console.log(userName, "userName")
  console.log(userID, "userID")
  console.log(companyUrl, "companyUrl")
  console.log(userEmail, "userEmail")


  try {
    // Connect to MongoDB and perform operations
    const client = await MongoClient.connect(process.env.MONGO_DB_STRING);
    console.log('Connected to database');
    const db = client.db(companyUrl);
    const collection = db.collection('fmsMaster');
    infoLogger.log("info", `Username:${userName} from company:${companyUrl} hit the api fmsStep1 with body params: ${JSON.stringify(req.body)}`)

    // Convert req.body.fmsName to lowercase and remove spaces
    const formattedFmsName = req.body.fmsName.toLowerCase().replace(/\s+/g, '');

    // Check if fmsName already exists in the collection (case-insensitive, ignoring spaces)
    const existingDocument = await collection.findOne({
      $expr: {
        $eq: [
          { $toLower: { $replaceAll: { input: "$fmsName", find: " ", replacement: "" } } },
          formattedFmsName
        ]
      }
    });

    if (existingDocument) {
      await client.close();
      errorLogger.log("error", `Username:${userName} from company:${companyUrl} failed to create step1 fms title ${req.body.fmsName} already exists `);
      return res.status(400).json({ error: "The FMS Title already exists", status: 400 });
    }
    console.log('existing fms name validation done')

    // Find the last inserted document and get its incremental value
    const lastDocument = await collection.find().sort({ _id: -1 }).limit(1).toArray();
    let fmsMasterId = 1;

    if (lastDocument.length > 0) {
      fmsMasterId = lastDocument[0].fmsMasterId + 1;
    }

    ////Fetch process details uat
    const instanceprocessDetailsResponse = axios.create({ httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }) });
    const processDetailsResponse = await instanceprocessDetailsResponse.post (
      process.env.MAIN_BE_PROCESS_URL,
      {
        p_id: req.body.fmsProcess,
        verify_company_url: companyUrl
      }
    );


    ////Fetch process details
    // const processDetailsResponse = await axios.post(process.env.MAIN_BE_PROCESS_URL, {
    //   p_id: req.body.fmsProcess,
    //   verify_company_url: companyUrl
    // });

    //console.log( processDetailsResponse.data.result);

    const currentDate = moment().tz('Asia/Kolkata').format();

    // Inserting data into the collection
    const result = await collection.insertOne({
      fmsMasterId,
      fmsCreatedBy: { userID: userID, userEmail: userEmail, userName: userName },
      fmsName: req.body.fmsName,
      fmsDescription: req.body.fmsDescription,
      //fmsProcess: req.body.fmsProcess
      fmsProcess: processDetailsResponse.data.result[0],
      noOfLive: 0,
      creationDate: currentDate,
      isDraft: true,
      fmsLive: false
    });

    //added return 

    // Retrieve the inserted document using its _id
    const insertedDocument = await collection.findOne({ _id: result.insertedId });

    console.log(insertedDocument);
    infoLogger.log("info", `Username:${userName} from company:${companyUrl} is creating step1.Based on the request,step1 is created with the data ${JSON.stringify(insertedDocument)}`)
    res.json({
      "message": `${req.body.fmsName} Step 1 is Successfully Created`,
      "status": 200,
      "data": insertedDocument // Include the inserted document in the response
    });

    console.log(result);
    // res.json({
    //     "message": `${req.body.fmsName} Step 1 is Successfully Created`,
    //     "status": 200
    // });

    // Close the MongoDB connection
    await client.close();
    console.log('MongoDB connection closed');
  } catch (error) {
    console.error('Error Connecting to MongoDB', error);
    errorLogger.log("error", `Username:${userName} from company:${companyUrl} failed to create step1 due to ${error.message}`);
    return res.status(500).send({ error: error.message, status: 500 });
  }
});


//edit fmsStep 1
initialiseFms.post('/editFmsStep1', async (req, res) => {
  console.log(" Edit Fms Step 1 API hit");
  console.log(req.body);

  // Initialize variables to hold user details
  let userDetails = await fetchUserDetails(req.headers.authorization);
  let userName = userDetails.userName;
  let userID = userDetails.userID;
  let companyUrl = userDetails.companyUrl;
  let userEmail = userDetails.userEmail;

  try {
    // Connect to MongoDB and perform operations
    const client = await MongoClient.connect(process.env.MONGO_DB_STRING);
    console.log('Connected to database inside the edit fms step1');
    const db = client.db(companyUrl);
    const collection = db.collection('fmsMaster');
    infoLogger.log("info", `Username:${userName} from company:${companyUrl}   hit the api editFmsStep1 with body params: ${JSON.stringify(req.body)}`)


    ////Fetch process details uat
    const instanceprocessDetailsResponse = axios.create({ httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }) });
    const processDetailsResponse = await instanceprocessDetailsResponse.post(
      process.env.MAIN_BE_PROCESS_URL,
      {
        p_id: req.body.fmsProcess,
        verify_company_url: companyUrl
      }
    );

    console.log("processDetailsResponse", processDetailsResponse.data.result);
    
    ////Fetch process details
    // const processDetailsResponse = await axios.post(process.env.MAIN_BE_PROCESS_URL, {
    //   p_id: req.body.fmsProcess,
    //   verify_company_url: companyUrl
    // });

    //console.log( processDetailsResponse.data.result);

    //const currentDate = moment().tz('Asia/Kolkata').format();

    // Update object
    const update = {
      $set: {
        fmsName: req.body.fmsName,
        fmsDescription: req.body.fmsDescription,
        fmsProcess: processDetailsResponse.data.result[0]
      }
    };

    // Find and update the document
    const result = await collection.findOneAndUpdate(
      { fmsMasterId: req.body.fmsMasterId },
      update,
      { returnOriginal: false } // returns the updated document
    );

    // if (!result.value) {
    //     console.log(`Document with fmsMasterId ${req.body.fmsMasterId} not found`);
    //     return;
    // }

    console.log('Document updated:', result.value);
    infoLogger.log("info", `Username:${userName} from company:${companyUrl} has updated step1.Based on the request,step1 is updated with the data ${JSON.stringify(update)}`)
    res.json({
      "message": `${req.body.fmsName} Step 1 is Successfully Edited`,
      "status": 200,
      "data": result // Include the updated document in the response
    });

    console.log(result);

    // Close the MongoDB connection
    await client.close();
    console.log('MongoDB connection closed');
  } catch (error) {
    console.error('Error Connecting to MongoDB', error);
    errorLogger.log("error", `Username:${userName} from company:${companyUrl} failed to update step1 due to ${error.message}`);
    return res.status(500).send({ error: error.message, status: 500 });
  }
});





//Edit FMS -- ADD FMS Access, No Edit Access For Now
initialiseFms.post('/addFmsUserAccess', async (req, res) => {

  // Initialize variables to hold user details
  let userDetails = await fetchUserDetails(req.headers.authorization);
  let userName = userDetails.userName;
  let userID = userDetails.userID;
  let companyUrl = userDetails.companyUrl;
  let userEmail = userDetails.userEmail;

  try {
    // Connect to MongoDB and perform operations
    const client = await MongoClient.connect(process.env.MONGO_DB_STRING);
    console.log('Connected to database');
    const db = client.db(companyUrl);
    const collection = db.collection('fmsMaster');
    infoLogger.log("info", `Username:${userName} from company:${companyUrl}   hit the api addFmsUserAccess`)
    //const filter = { fmsName : req.body.fmsName };
    const filter = { fmsMasterId: req.body.fmsMasterId };
    const update = { $set: { fmsAccess: req.body.fmsUsers } };
    const options = { upsert: true };

    const result = await collection.updateOne(filter, update, options);

    if (result.upsertedCount === 1) {
      console.log('Document inserted');
    } else if (result.modifiedCount === 1) {
      console.log('Document updated');
    } else {
      console.log('No changes made to the document');
    }

    console.log(result)
    infoLogger.log("info", `Username:${userName} from company:${companyUrl}  assigned FMS Id:${req.body.fmsMasterId} task and provided an access to ${JSON.stringify(req.body.fmsUsers)}`)
    res.json({
      "message": `${req.body.fmsName} FMS Users is Successfully Added`,
      "status": 200
    })
    // Close the MongoDB connection
    await client.close();
    console.log('MongoDB connection closed');
  }
  catch (error) {
    console.error('Error Connecting to MongoDB', error);
    errorLogger.log("error", `Username:${userName} from company:${companyUrl} failed to provide access due to ${error.message}`);
    return res.status(500).send({ error: error.message, status: 500 });
  }


})

////////////// ---------------------- Create Questionare ----------------------////////////////////

//file upload, text(string) , dropdown(array of strings) , checkboxes(array of strings) , date (single date)

initialiseFms.post('/createFmsQuestionare', async (req, res) => {

  // Initialize variables to hold user details
  let userDetails = await fetchUserDetails(req.headers.authorization);
  let userName = userDetails.userName;
  let userID = userDetails.userID;
  let companyUrl = userDetails.companyUrl;
  let userEmail = userDetails.userEmail;

  try {

    // Connect to MongoDB and perform operations
    const client = await MongoClient.connect(process.env.MONGO_DB_STRING);
    console.log('Connected to database');
    const db = client.db(companyUrl);
    const collection = db.collection('fmsMaster');
    infoLogger.log("info", `Username:${userName} from company:${companyUrl}   hit the api createFmsQuestionare`)

    //const filter = { fmsName : req.body.fmsName };
    const filter = { fmsMasterId: req.body.fmsMasterId };
    const update = { $set: { fmsQuestionare: req.body.fmsQuestionare } };
    const options = { upsert: true };

    const result = await collection.updateOne(filter, update, options);

    if (result.upsertedCount === 1) {
      console.log('Document inserted');
    } else if (result.modifiedCount === 1) {
      console.log('Document updated');
    } else {
      console.log('No changes made to the document');
    }

    console.log(result)
    infoLogger.log("info", `Username:${userName} from company:${companyUrl}  updating ${JSON.stringify(update)} questionary and successfully updated ${JSON.stringify(result)}`)
    res.json({
      "message": `${req.body.fmsName} FMS Questionare is Successfully Added`,
      "status": 200
    })

    // Close the MongoDB connection
    await client.close();
    //console.log('MongoDB connection closed');

  }
  catch (error) {
    console.error('Error Connecting to MongoDB', error);
    errorLogger.log("error", `Username:${userName} from company:${companyUrl} failed to update fms questionries due to ${error.message}`);
    return res.status(500).send({ error: error.message, status: 500 });
  }
})

//CREATE FMS Steps
initialiseFms.post('/createFmsSteps', async (req, res) => {
  console.log('inside /createFmsSteps')
  console.log(req.body)

  // Initialize variables to hold user details
  let userDetails = await fetchUserDetails(req.headers.authorization);
  let userName = userDetails.userName;
  let userID = userDetails.userID;
  let companyUrl = userDetails.companyUrl;
  let userEmail = userDetails.userEmail;

  try {

    // Connect to MongoDB and perform operations
    const client = await MongoClient.connect(process.env.MONGO_DB_STRING);
    console.log('Connected to database');
    const db = client.db(companyUrl);
    const collection = db.collection('fmsMaster');
    infoLogger.log("info", `Username:${userName} from company:${companyUrl}   hit the api createFmsSteps`)
    //const filter = { fmsName : req.body.fmsName };
    const filter = { fmsMasterId: req.body.fmsMasterId };
    const update = { $set: { fmsSteps: req.body.fmsSteps } };
    const options = { upsert: true };

    const result = await collection.updateOne(filter, update, options);

    if (result.upsertedCount === 1) {
      console.log('Document inserted');
    } else if (result.modifiedCount === 1) {
      console.log('Document updated');
    } else {
      console.log('No changes made to the document');
    }

    console.log(result)
    infoLogger.log("info", `Username:${userName} from company:${companyUrl}  creating ${JSON.stringify(update)} fms steps and successfully updated ${JSON.stringify(result)} fms steps`)
    res.json({
      "message": `${req.body.fmsName} FMS Steps is Successfully Added`,
      "status": 200
    })



    // try {
    //     const sendWhatsapp = await axios.post(process.env.MAIN_BE_WHATSAPP_URL, {
    //     verify_company_url: companyUrl,
    //     fmsSteps: req.body.fmsSteps
    //     });
    //     console.log('WhatsApp message sent', sendWhatsapp.data);
    // } catch (whatsappError) {
    //     console.error('Error sending WhatsApp message:', whatsappError);
    // }

    // Close the MongoDB connection
    await client.close();
    console.log('MongoDB connection closed');

  }
  catch (error) {
    console.error('Error Connecting to MongoDB', error);
    errorLogger.log("error", `Username:${userName} from company:${companyUrl} failed to create fms steps due to ${error.message}`);
    return res.status(500).send({ error: error.message, status: 500 });
  }


})

//API Edit and Store Decision Details
initialiseFms.post('/editStoreDecisionDetails', async (req, res) => {
  console.log('------------INSIDE EDIT DECISION DETAILS -------------------')
  console.log('------------INSIDE EDIT DECISION DETAILS -------------------')
  console.log('------------INSIDE EDIT DECISION DETAILS -------------------')
  console.log(req.body)

  // Initialize variables to hold user details
  let userDetails = await fetchUserDetails(req.headers.authorization);
  let userName = userDetails.userName;
  let userID = userDetails.userID;
  let companyUrl = userDetails.companyUrl;
  let userEmail = userDetails.userEmail;

  // try {
  //     // Fetch user details and company details based on the token
  //     const response = await axios.post(process.env.MAIN_BE_URL, { token: token });
  //     console.log('Fetched User Details and Company Details', response.data);
  //     userName = response.data.emp_name;
  //     userID = response.data.user_id;
  //     companyUrl = response.data.verify_company_url;
  //     userEmail = response.data.email_id;  
  //     infoLogger.log("info", `${JSON.stringify(response.data)} logged in autopilot fms`)
  // } catch (error) {
  //     console.error('Error posting data:', error);
  //     errorLogger.log("error",`Failed to fetch user details due to ${error.message}`)
  //     return res.status(500).send({ error: 'Error fetching user details', status: 500 });

  // }

  // try {

  //     // Connect to MongoDB and perform operations
  //     const client = await MongoClient.connect(process.env.MONGO_DB_STRING);
  //     console.log('Connected to database');
  //     const db = client.db(companyUrl);
  //     const collection = db.collection('fmsMaster');
  //     infoLogger.log("info", `${userName} from company ${companyUrl}  hit the api makeFmsLive`)
  //     //const filter = { fmsName : req.body.fmsName };
  //     const filter = { fmsMasterId : req.body.fmsMasterId };
  // const update = { $set: { fmsLive : req.body.fmsLive } };   //fmsLive means that fms is active
  // const options = { upsert: true };

  // const result = await collection.updateOne(filter, update, options);

  // if (result.upsertedCount === 1) {
  //   console.log('Document inserted');
  // } else if (result.modifiedCount === 1) {
  //   console.log('Document updated');
  // } else {
  //   console.log('No changes made to the document');
  // }

  // console.log(result)
  // infoLogger.log("info", `FMS id:${req.body.fmsMasterId} is set to live by ${userName}`)
  // res.json({
  //     "message" : `${req.body.fmsName} FMS Steps is Successfully Added`,
  //     "status" : 200
  // })

  // // Close the MongoDB connection
  // await client.close();
  // console.log('MongoDB connection closed');

  // }
  // catch (error) {
  //     console.error('Error Connecting to MongoDB', error);
  //     errorLogger.log("error", `${userName} failed to make fms live due to ${error.message}`);
  //     return res.status(500).send({ error: error.message, status: 500 });
  // }

  res.json({
    "message": `${req.body.fmsName}  - Decision Details Successfully Added`,
    "status": 200
  })


})


//API to make FMS Live 
initialiseFms.post('/makeFmsLive', async (req, res) => {
  // Initialize variables to hold user details
  let userDetails = await fetchUserDetails(req.headers.authorization);
  let userName = userDetails.userName;
  let companyUrl = userDetails.companyUrl;

  try {
    // Connect to MongoDB and perform operations
    const client = await MongoClient.connect(process.env.MONGO_DB_STRING);
    console.log('Connected to database');
    const db = client.db(companyUrl);
    const collection = db.collection('fmsMaster');

    infoLogger.log("info", `Username:${userName} from company:${companyUrl}  hit the API makeFmsLive`);

    // Find the FMS by `fmsMasterId` (passed from the request body)
    const filter = { fmsMasterId: req.body.fmsMasterId };
    const existingFms = await collection.findOne(filter);

    if (existingFms) {
      // If the FMS exists, increment fmsMasterId and version
      if (existingFms.version) {
        // Set the current version to fmsLive: false
        await collection.updateOne(
          { fmsMasterId: req.body.fmsMasterId },
          { $set: { fmsLive: false } }
        );

        // Increment the fmsMasterId for a new master ID
        const latestFms = await collection.find({}).sort({ fmsMasterId: -1 }).limit(1).toArray();
        const newFmsMasterId = latestFms[0] ? latestFms[0].fmsMasterId + 1 : 1;  // Increment the highest `fmsMasterId`

        // Increment version and keep the same fmsMasterId
        const currentVersion = existingFms.version || `${req.body.fmsMasterId}.0`;  // Default to 'masterId.0'
        const [baseId, versionNum] = currentVersion.split('.').map(Number);
        const newVersionNum = versionNum + 1; // Increment version number
        const newVersion = `${baseId}.${newVersionNum}`;

        // Create a copy of the existing FMS and update the necessary fields
        const newFmsData = {
          ...existingFms,
          fmsMasterId: newFmsMasterId,    // New master ID
          version: newVersion,            // New version
          isDraft: false,
          fmsLive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };

        // Remove the _id field to allow MongoDB to generate a new one
        delete newFmsData._id;

        // Insert the new document
        const result = await collection.insertOne(newFmsData);

        console.log(`New FMS created with version: ${newVersion}`);
        infoLogger.log("info", `Username:${userName} from company:${companyUrl} has created New FMS with version: ${newVersion}`);

        res.json({
          message: `${req.body.fmsName} FMS version ${newVersion} is successfully created and set to live`,
          status: 200,
          fmsMasterId: newFmsMasterId,
          version: newVersion,
        });
      } else {
        // If this is the first version of the FMS, increment fmsMasterId and set it live
        const latestFms = await collection.find({}).sort({ fmsMasterId: -1 }).limit(1).toArray();
        const newFmsMasterId = latestFms[0] ? latestFms[0].fmsMasterId + 1 : 1;  // Increment the highest `fmsMasterId`

        await collection.updateOne(
          { fmsMasterId: req.body.fmsMasterId },
          {
            $set: {
              fmsMasterId: newFmsMasterId,
              fmsLive: true,
              version: `${newFmsMasterId}.1`,  // Set the first version as 'newFmsMasterId.1'
              isDraft: false,
              createdAt: new Date(),
              updatedAt: new Date(),
            },
          }
        );

        console.log(`FMS with new ID: ${newFmsMasterId} is set to live with version: ${newFmsMasterId}.1`);
        infoLogger.log("info", `Username:${userName} from company:${companyUrl} has set FMS with new ID: ${newFmsMasterId} to live`);

        res.json({
          message: `${req.body.fmsName} FMS version ${newFmsMasterId}.1 is successfully created and set to live`,
          status: 200,
          fmsMasterId: newFmsMasterId,
          version: `${newFmsMasterId}.1`,
        });
      }
    } else {
      // No FMS found, send an error response
      res.status(404).json({
        message: `FMS with ID ${req.body.fmsMasterId} not found`,
        status: 404,
      });
    }

    // Close the MongoDB connection
    await client.close();
    console.log('MongoDB connection closed');

  } catch (error) {
    console.error('Error connecting to MongoDB', error);
    errorLogger.log("error", `Username:${userName} from company:${companyUrl} failed to make FMS live due to ${error.message}`);
    return res.status(500).send({ error: error.message, status: 500 });
  }
});




//API to make FMS Live 
initialiseFms.post('/addStepNamesInitial', async (req, res) => {



  console.log('---/ADD STEPS NAMES INITIAL------------');
  console.log(req.body);

  // Initialize variables to hold user details
  let userDetails = await fetchUserDetails(req.headers.authorization);
  let userName = userDetails.userName;
  let userID = userDetails.userID;
  let companyUrl = userDetails.companyUrl;
  let userEmail = userDetails.userEmail;

  ///////////-------------------FETCHING THE fmsMasterDocument---------------------------/////////////
  let fmsMasterDocument;
  try {
    // Connect to MongoDB and perform operations
    const client = await MongoClient.connect(process.env.MONGO_DB_STRING);
    //console.log('Connected to database');
    const db = client.db(companyUrl);
    const collection = db.collection('fmsMaster');

    fmsMasterDocument = await collection.findOne({ fmsMasterId: req.body.fmsMasterId });
    // Close the MongoDB connection
    await client.close();
    //console.log('MongoDB connection closed');
  }
  catch (error) {
    console.error('Error Connecting to MongoDB', error);
    return res.status(500).json({ error: error.message });
  }

  // Helper function to generate step objects with IDs
  function accepTheStepWhats(array) {
    if (!Array.isArray(array)) {
      throw new Error("Input must be an array");
    }
    return array.map((element, index) => ({
      what: element,
      id: index + 1, // Consecutive ID starting from 1
    }));
  }

  // Helper function to generate step objects with IDs
  function createStepsInitial(array) {
    if (!Array.isArray(array)) {
      throw new Error("Input must be an array");
    }
    // return array.map((element, index) => ({
    //   what: element,
    //   id: index + 1, // Consecutive ID starting from 1
    // }));
    return array.map((element, index) => ({
      who: {
        typeOfShift: "All",
        employees: []
      },
      what: {
        what: element,
        id: index + 1
      },
      next: [],
      nextDecision: {},
      endStep: false,
      when: "",
      how: {
        type: "",
        description: "",
        formStepsQustions: [],
        miniStepsDetails: []
      },
      plannedDate: {
        type: "",
        duration: "",
        durationType: "",
        customTime: null,
        working: ""
      },
      id: index + 1,
      stepType: "DOER",
      isWhatsAppEnabled: false,
      whatsappData: {
        templateMsg: "",
        internalEmployees: [],
        externalEmployees: []
      },
      startTimeType: ""
    }));
  }

  let newStepWhatandId;
  //try catch block to save the new fms whats
  try {
    // Connect to MongoDB
    const client = await MongoClient.connect(process.env.MONGO_DB_STRING);
    //console.log('Connected to database');
    const db = client.db(companyUrl);
    const collection = db.collection('fmsMaster');

    // Fetching the input steps from the request body
    let inputWhats = req.body.fmsSteps;
    newStepWhatandId = accepTheStepWhats(inputWhats);
    // Filter to find the FMS document by fmsMasterId
    const filter = { fmsMasterId: req.body.fmsMasterId };
    // Remove existing `fmsWhats` and replace with new steps
    const update = { $set: { fmsWhats: newStepWhatandId } }; // Replacing with new steps
    const options = { upsert: true };
    const result = await collection.updateOne(filter, update, options);

    //initilally it will just save
    if (!(fmsMasterDocument.hasOwnProperty("fmsSteps"))) {
      console.log('First time Creating Steos During INITIALISATION')
      console.log("fmsWhatsWithIds", newStepWhatandId)
      let newFmsSteps = createStepsInitial(inputWhats)
      // Filter to find the FMS document by fmsMasterId
      const filter1 = { fmsMasterId: req.body.fmsMasterId };
      // Remove existing `fmsWhats` and replace with new steps
      const update1 = { $set: { fmsSteps: newFmsSteps } }; // Replacing with new steps
      const options1 = { upsert: true };
      const result1 = await collection.updateOne(filter1, update1, options1);
    }

    if (fmsMasterDocument.hasOwnProperty("fmsSteps")) {
      console.log('Creating the Steps During the EDIT of the Whats')
      console.log("fmsWhatsWithIds", newStepWhatandId)
      

      //////////////////////////////////////////
      function updateFMSSteps(fmsWhats, fmsSteps) {
        // Create a Map of existing steps for efficient lookup
        const stepsMap = new Map(fmsSteps.map(step => [step.what.what, step]));

        // Create a new array to store the updated steps
        let updatedSteps = [];

        for (let what of fmsWhats) {
          let step;
          if (stepsMap.has(what.what)) {
            // If the step exists, update its 'what' property
            step = stepsMap.get(what.what);
            step.what = what;
          } else {
            // If the step doesn't exist, create a new step with default values
            step = {
              who: {
                typeOfShift: "All",
                employees: []
              },
              what: {
                what: what.what,
                id: what.id
              },
              next: [],
              nextDecision: {},
              endStep: false,
              when: "",
              how: {
                type: "",
                description: "",
                formStepsQustions: [],
                miniStepsDetails: []
              },
              plannedDate: {
                type: "",
                duration: "",
                durationType: "",
                customTime: null,
                working: ""
              },
              id: what.id,
              stepType: "DOER",
              isWhatsAppEnabled: false,
              whatsappData: {
                templateMsg: "",
                internalEmployees: [],
                externalEmployees: []
              },
              startTimeType: ""
            };
          }
          updatedSteps.push(step);
        }

        //Update 'next' arrays and other properties
        for (let i = 0; i < updatedSteps.length; i++) {
          // if (i < updatedSteps.length - 1) {
          //   updatedSteps[i].next = [{ what: updatedSteps[i + 1].what.what, id: updatedSteps[i + 1].what.id }];
          //   updatedSteps[i].endStep = false;
          // } else {
          //   updatedSteps[i].next = [];
          //   updatedSteps[i].endStep = true;
          // }

          // Ensure the step ID matches the 'what' ID
          updatedSteps[i].id = updatedSteps[i].what.id;
        }

        return updatedSteps;
      }

      // Example usage
      //const array1 = ['A', 'B', 'C'];
      //const array2 = ['A', 'C'];

      const equivalentArray = updateFMSSteps(newStepWhatandId, fmsMasterDocument.fmsSteps);
      console.log('Equivalent Array', equivalentArray); // Output: ['A', 'B', 'C']



      //Filter to find the FMS document by fmsMasterId
      const filter1 = { fmsMasterId: req.body.fmsMasterId };
      // Remove existing `fmsWhats` and replace with new steps
      const update1 = { $set: { fmsSteps: equivalentArray } }; // Replacing with new steps
      const options1 = { upsert: true };
      const result1 = await collection.updateOne(filter1, update1, options1);
    }





    // Logging and response
    infoLogger.log("info", `Username:${userName} from company:${companyUrl} has replaced FMS id:${req.body.fmsMasterId} steps`);

    // Close the MongoDB connection
    await client.close();
    console.log('MongoDB connection closed');

  } catch (error) {
    console.error('Error Connecting to MongoDB', error);
    errorLogger.log("error", `Username:${userName} from company:${companyUrl} failed to replace FMS steps due to ${error.message}`);
    return res.status(500).send({ error: error.message, status: 500 });
  }


  




  res.json({
    message: `${req.body.fmsName} FMS Steps have been Successfully Replaced`,
    status: 200
  });


});





//API to Edit Whats
initialiseFms.post('/editWhats', async (req, res) => {

  console.log('---/editWhats---');
  console.log('---/editWhats---');
  console.log('---/editWhats---');

  console.log(req.body);

  // Initialize variables to hold user details
  let userDetails = await fetchUserDetails(req.headers.authorization);
  let userName = userDetails.userName;
  let userID = userDetails.userID;
  let companyUrl = userDetails.companyUrl;
  let userEmail = userDetails.userEmail;

  try {
    const client = await MongoClient.connect(process.env.MONGO_DB_STRING);
    console.log('Connected to database');
    const db = client.db(companyUrl);
    const collection = db.collection('fmsMaster');

    const filter = { fmsMasterId: req.body.fmsMasterId };

    // Find the existing document
    const doc = await collection.findOne(filter);
    if (!doc) {
      return res.status(404).json({ error: 'Document not found', status: 404 });
    }

    // Update the `fmsWhats` array
    let updatedWhats = doc.fmsWhats.map(item => {
      if (item.id === req.body.id) {
        return { what: req.body.what, id: item.id };
      }
      return item;
    });

    // Update the `fmsSteps` array and the nested `what` object
    let updatedSteps = doc.fmsSteps.map(step => {
      if (step.id === req.body.id) {
        step.what.what = req.body.what;
      }
      return step;
    });

    const update = {
      $set: {
        fmsWhats: updatedWhats,
        fmsSteps: updatedSteps
      }
    };
    const options = { upsert: true };

    const result = await collection.updateOne(filter, update, options);

    if (result.upsertedCount === 1) {
      console.log('Document inserted');
    } else if (result.modifiedCount === 1) {
      console.log('Document updated');
    } else {
      console.log('No changes made to the document');
    }

    infoLogger.log("info", `Username:${userName} from company:${companyUrl}  has updated FMS id:${req.body.fmsMasterId}`);
    res.json({
      message: `${req.body.fmsName} FMS Initial Steps are Successfully Updated`,
      status: 200
    });

    await client.close();
    console.log('MongoDB connection closed');
  } catch (error) {
    console.error('Error Connecting to MongoDB', error);
    errorLogger.log("error", `Username:${userName} from company:${companyUrl} failed to update FMS due to ${error.message}`);
    return res.status(500).send({ error: error.message, status: 500 });
  }
});

///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

// //CREATE FMS Steps
// initialiseFms.post('/saveSingleStep', async (req, res) => {
//   console.log('inside /saveSingleStep')
//   //console.log(req.body)
//   console.log(JSON.stringify(req.body));


//   // Initialize variables to hold user details
//   let userDetails = await fetchUserDetails(req.headers.authorization);
//   let userName = userDetails.userName;
//   let userID = userDetails.userID;
//   let companyUrl = userDetails.companyUrl;
//   let userEmail = userDetails.userEmail;

//   try {

//     // Connect to MongoDB and perform operations
//     const client = await MongoClient.connect(process.env.MONGO_DB_STRING);
//     console.log('Connected to database');
//     const db = client.db(companyUrl);
//     const collection = db.collection('fmsMaster');
//     infoLogger.log("info", `${userName} from company ${companyUrl}  hit the api /saveSingleStep`)
//     //const filter = { fmsName : req.body.fmsName };
//     const filter = { fmsMasterId: req.body.fmsMasterId };
//     const update = { $set: { fmsSteps: req.body.fmsSteps } };
//     const options = { upsert: true };

//     const result = await collection.updateOne(filter, update, options);

//     console.log(result)
//     infoLogger.log("info", `${userName} creating ${JSON.stringify(update)} fms steps and successfully updated ${JSON.stringify(result)} fms steps`)
//     res.json({
//       "message": `${req.body.fmsName} FMS Steps is Successfully Added`,
//       "status": 200
//     })
//     await client.close();
//     console.log('MongoDB connection closed');

//   }
//   catch (error) {
//     console.error('Error Connecting to MongoDB', error);
//     errorLogger.log("error", `${userName} failed to create fms steps due to ${error.message}`);
//     return res.status(500).send({ error: error.message, status: 500 });
//   }


// })

//CREATE FMS Steps
initialiseFms.post('/saveSingleStep', async (req, res) => {
  console.log('inside /saveSingleStep')
  //console.log(req.body)
  console.log(JSON.stringify(req.body));


  // Initialize variables to hold user details
  let userDetails = await fetchUserDetails(req.headers.authorization);
  let userName = userDetails.userName;
  let userID = userDetails.userID;
  let companyUrl = userDetails.companyUrl;
  let userEmail = userDetails.userEmail;

  try {

    // Connect to MongoDB and perform operations
    const client = await MongoClient.connect(process.env.MONGO_DB_STRING);
    console.log('Connected to database');
    const db = client.db(companyUrl);
    const collection = db.collection('fmsMaster');
    infoLogger.log("info", `Username:${userName} from company:${companyUrl}   hit the api saveSingleStep`)
    //const filter = { fmsName : req.body.fmsName };
    // const filter = { fmsMasterId: req.body.fmsMasterId };
    // const update = { $set: { fmsSteps: req.body.fmsSteps } };
    // const options = { upsert: true };
    // const result = await collection.updateOne(filter, update, options);

    /////
    // Filter to find the FMS document by fmsMasterId
    const filter = { fmsMasterId: req.body.fmsMasterId, [`fmsSteps.what.what`]: req.body.fmsSteps[0].what.what };
    // Remove existing `fmsWhats` and replace with new steps
    const update = { $set: { [`fmsSteps.$`]: req.body.fmsSteps[0] } }; // Replacing with new steps
    const options = { upsert: true };
    const result = await collection.updateOne(filter, update, options);

    console.log(result)
    infoLogger.log("info", `Username:${userName} from company:${companyUrl}  created ${JSON.stringify(update)} fms steps and successfully updated ${JSON.stringify(result)} fms steps`)
    res.json({
      "message": `${req.body.fmsName} FMS Steps is Successfully Added`,
      "status": 200
    })
    await client.close();
    console.log('MongoDB connection closed');

  }
  catch (error) {
    console.error('Error Connecting to MongoDB', error);
    errorLogger.log("error", `Username:${userName} from company:${companyUrl} failed to create fms steps due to ${error.message}`);
    return res.status(500).send({ error: error.message, status: 500 });
  }


})









module.exports = initialiseFms;
