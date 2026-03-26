const express = require("express");
const getFms = express.Router();
var MongoClient = require('mongodb').MongoClient;
const axios = require('axios');
const { fetchUserDetails } = require("../../helpers/fetchuserDetails");
const { infoLogger, errorLogger } = require("../../middleware/logger");

//find  Single FMS using FMS Name
getFms.post('/findSingleFms', async (req, res) => {

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
    infoLogger.log("info", `Username: ${userName} from company: ${companyUrl}  hit the api getfilterPC with body params: ${JSON.stringify(req.body)}`)


    // Fething data into from the  collection
    //const query = { fmsName: req.body.fmsName };
    const query = { fmsMasterId: req.body.fmsMasterId };
    const document = await collection.findOne(query);
    infoLogger.log("info", `Username: ${userName} from company:${companyUrl} successfully fetch the single fms:${JSON.stringify(document)}`)

    //console.log(document)
    res.json({
      "message": document,
      "status": 200
    })

  } catch (error) {
    errorLogger.log("error" , `Username:${userName} from company:${companyUrl} failed to fetch Single fms due to ${error.message}`);
    console.error('Error Connecting to MongoDB', error);
    return res.status(500).json({ error: error.message });
  }
})

//find ALL FMS 
getFms.get('/findAllFms', async (req, res) => {

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
    infoLogger.log("info", `Username: ${userName} from company: ${companyUrl}  hit the api findAllFms`)

    const cursor = collection.find({ fmsLive: true });
    const documents = await cursor.toArray();

    console.log(documents)
    infoLogger.log("info", `Username: ${userName} from company:${companyUrl} successfully fetch all fms:${JSON.stringify(documents)}`)

    res.json({
      "message": [documents],
      "status": 200
    })

    // Close the MongoDB connection
    await client.close();
    console.log('MongoDB connection closed');
  }
  catch (error) {
    console.error('Error Connecting to MongoDB', error);
    errorLogger.log("error" , `Username:${userName} from company:${companyUrl} failed to fetch all fms due to ${error.message}`);
    return res.status(500).json({ error: error.message });
  }
})

//find all fms and their forms the user has access to 
getFms.get('/findFmsQuestionaresForUser', async (req, res) => {


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
    infoLogger.log("info", `Username: ${userName} from company: ${companyUrl}  hit the api findFmsQuestionaresForUser`)


    // Fething data into from the  collection
    //const namesArray = userNameArray.map(obj => obj.name);
    //const query = { fmsAccess : { $in: [userName] } };
    const query = {
      $and: [
      { fmsLive: true },
      {
      fmsAccess: {
        $elemMatch: {
          name: userName
        }
      }
    }
    ]
    };
    //const document = await collection.findOne(query);
    const cursor = collection.find(query);
    const documents = await cursor.toArray();
    infoLogger.log("info", `Username: ${userName} from company:${companyUrl} successfully fetch all fms questionares:${JSON.stringify(documents)}`)

    //console.log(documents)
    res.json({
      "message": documents,
      "status": 200
    })

    // Close the MongoDB connection
    await client.close();
    console.log('MongoDB connection closed');



  } catch (error) {
    console.error('Error Connecting to MongoDB', error);
    errorLogger.log("error" , `Username:${userName} from company:${companyUrl} failed to fetch all fms questionares due to ${error.message}`);
    return res.status(500).json({ error: error.message });
  }

})



//make an api where if I pass you fmsmasterid & stepid, can you give me list of previous stepids and what has to be done in an array
getFms.post('/findPreviousStepsDetails', async (req, res) => {
  console.log(' inside /findPreviousStepsDetails')
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
    infoLogger.log("info", `Username: ${userName} from company: ${companyUrl}  hit the api findFmsQuestionaresForUser with body params: ${JSON.stringify(req.body)}`)


    const cursor = collection.find({ fmsMasterId: req.body.fmsMasterId });
    const documents = await cursor.toArray();
    const document = documents[0]

    function fetchPreviousSteps(fmsSteps, currentStepId) {
      let previousSteps = [];
      for (let i = 0; i < fmsSteps.length; i++) {
        if (fmsSteps[i].id === currentStepId) {
          // Stop one step earlier to exclude the current step
          for (let j = 0; j < i; j++) {
            previousSteps.push(fmsSteps[j]);
          }
          break; // Exit the loop once we've found the current step
        }
      }
      return previousSteps;
    }


    const previousSteps = fetchPreviousSteps(document.fmsSteps, req.body.stepId);

    console.log(previousSteps);
    infoLogger.log("info", `Username: ${userName} from company:${companyUrl} successfully fetch the previous Steps:${JSON.stringify(previousSteps)}`)

    console.log(document)
    res.json({
      "message": previousSteps,
      "status": 200
    })

    // Close the MongoDB connection
    await client.close();
    console.log('MongoDB connection closed');
  }
  catch (error) {
    console.error('Error Connecting to MongoDB', error);
    errorLogger.log("error" , `Username:${userName} from company:${companyUrl} failed to fetch the previous steps due to ${error.message}`);
    return res.status(500).json({ error: error.message });
  }
})


//make an api where if I pass you fmsmasterid & stepid, can you give me list of NEXT stepids and what has to be done in an array
getFms.post('/findNextStepsDetails', async (req, res) => {
  console.log(' inside /findNextStepsDetails')
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
    infoLogger.log("info", `Username: ${userName} from company: ${companyUrl}  hit the api findNextStepsDetails with body params: ${JSON.stringify(req.body)}`)


    const cursor = collection.find({ fmsMasterId: req.body.fmsMasterId });
    const documents = await cursor.toArray();
    const document = documents[0]

    function fetchNextSteps(fmsSteps, currentStepId) {
      let nextSteps = [];
      for (let i = 0; i < fmsSteps.length; i++) {
        if (fmsSteps[i].id === currentStepId) {
          for (let j = i + 1; j < fmsSteps.length; j++) {
            nextSteps.push(fmsSteps[j]);
          }
          break; // Exit the loop once we've found the current step
        }
      }
      return nextSteps;
    }


    const nextSteps = fetchNextSteps(document.fmsSteps, req.body.stepId);

    console.log(nextSteps);
    infoLogger.log("info", `Username: ${userName} from company:${companyUrl} successfully fetch the next Steps:${JSON.stringify(nextSteps)}`)

    console.log(document)
    res.json({
      "message": nextSteps,
      "status": 200
    })

    // Close the MongoDB connection
    await client.close();
    console.log('MongoDB connection closed');
  }
  catch (error) {
    console.error('Error Connecting to MongoDB', error);
    errorLogger.log("error" , `Username:${userName} from company:${companyUrl} failed to fetch the next steps due to ${error.message}`);

    return res.status(500).json({ error: error.message });
  }
})




//new ---------------------------------------------------------------------------------------------------
//find  Single FMS all QA and all tasks for that QA
getFms.post('/findAllDetailsForOneMasterFmstest', async (req, res) => {
  console.log('inside findAllDetailsForOneMasterFmstest')

  // Initialize variables to hold user details
  let userDetails = await fetchUserDetails(req.headers.authorization);
  let userName = userDetails.userName;
  let userID = userDetails.userID;
  let companyUrl = userDetails.companyUrl;
  let userEmail = userDetails.userEmail;


  //find the requested FMS
  // let requestedFms;
  // try {
  //     // Connect to MongoDB and perform operations
  //     const client = await MongoClient.connect(process.env.MONGO_DB_STRING);
  //     //console.log('Connected to database');
  //     const db = client.db(companyUrl);
  //     const collection = db.collection('fmsMaster');

  //     // Fething data into from the  collection
  //     const query = { fmsMasterId: req.body.fmsMasterId };
  //     requestedFms = await collection.findOne(query);

  //     //console.log('Requested Fms' , requestedFms)
  //     console.log(requestedFms)


  // } catch (error) {
  //     //console.error('Error Connecting to MongoDB', error);
  //     res.status(500).send({ error: `${req.body.fmsName}  NOT found`, status: 500 });
  // }

  //find the masterfms document that is requested
  let fmsMasterDocument;
  try {
    // Connect to MongoDB and perform operations
    const client = await MongoClient.connect(process.env.MONGO_DB_STRING);
    console.log('Connected to database');
    const db = client.db(companyUrl);
    const collection = db.collection('fmsMaster');
    infoLogger.log("info", `Username: ${userName} from company: ${companyUrl}  hit the api findAllDetailsForOneMasterFmstest with body params: ${JSON.stringify(req.body)}`)


    // Fething data into from the  collection
    const query = { fmsMasterId: req.body.fmsMasterId };
    fmsMasterDocument = await collection.findOne(query);

    //console.log(fmsMasterDocument)
  } catch (error) {
    console.error('Error Connecting to MongoDB', error);
    return res.status(500).json({ error: error.message });
  }

  //find all fmsQA's(fmsQAid) - (all flows for that fms) for the single fms that is requested
  let fmsflows;
  try {
    // Connect to MongoDB and perform operations
    const client = await MongoClient.connect(process.env.MONGO_DB_STRING);
    console.log('Connected to database');
    const db = client.db(companyUrl);
    const collection = db.collection('fms');

    const cursor = collection.find({ fmsMasterId: req.body.fmsMasterId });
    fmsflows = await cursor.toArray();

    //console.log(fmsflows)
  } catch (error) {
    console.error('Error Connecting to MongoDB', error);
    return res.status(500).json({ error: error.message });
  }


  //////////////////////////////////////////////////////////////////////////////
  // let StepsTaskObject = {
  //   fmsStep : null, 
  //   allTasksForOneStep : null
  // }
  let allStepsTasks = []

  console.log(fmsMasterDocument.fmsSteps.length)
  for (let i = 1; i <= fmsMasterDocument.fmsSteps.length; i++) {
    let allTasksForOneFlowForStep;
    try {
      // Connect to MongoDB and perform operations
      const client = await MongoClient.connect(process.env.MONGO_DB_STRING);
      console.log('Connected to database');
      const db = client.db(companyUrl);
      const collection = db.collection('fmsTasks');

      console.log('query', req.body.fmsMasterId, i)
      const cursor = collection.find({ fmsMasterId: req.body.fmsMasterId, stepId: i });
      allTasksForOneFlowForStep = await cursor.toArray();

      console.log('allTasksForOneFlowForStep', i, allTasksForOneFlowForStep)

      //   StepsTaskObject = {
      //     fmsStep : fmsMasterDocument.fmsSteps[i], 
      //     allTasksForOneStep : allTasksForOneFlowForStep
      // }

      allStepsTasks.push(allTasksForOneFlowForStep)


      //console.log(allTasksForOneFlow)
    } catch (error) {
      console.error('Error Connecting to MongoDB', error);
      return res.status(500).json({ error: error.message });
    }
  }
  infoLogger.log("info", `Username: ${userName} from company:${companyUrl} successfully fetch the 
    fmsMasterDocument:${JSON.stringify(fmsMasterDocument)},fmsflows:${JSON.stringify(fmsflows)},allStepsTasks:${JSON.stringify(allStepsTasks)}`)


  //let allSteps = fmsMasterDocument.fmsSteps.push({ stepTasks : allStepsTasks});
  res.json({
    "message": {
      masterFMS: fmsMasterDocument,
      allFlows: fmsflows,
      allSteps: allStepsTasks,

    },
    "status": 200
  })

})


// fetch all the questions
getFms.post("/fetchFormQuestions", async (req, res) => {
  // Initialize variables to hold user details
  let userDetails = await fetchUserDetails(req.headers.authorization);
  let userName = userDetails.userName;
  let userID = userDetails.userID;
  let companyUrl = userDetails.companyUrl;
  let userEmail = userDetails.userEmail;


  try {
    // Connect to MongoDB and perform operations
    const client = await MongoClient.connect(process.env.MONGO_DB_STRING);
    //console.log("Connected to database");
    const db = client.db(companyUrl);
    const collection = db.collection("fmsMaster");
    infoLogger.log("info", `Username: ${userName} from company: ${companyUrl}  hit the api fetchFormQuestions with body params: ${JSON.stringify(req.body)}`)

    const { fmsMasterId } = req.body;
    const cursorFms = collection.find({ fmsMasterId: fmsMasterId });

    const document = await cursorFms.toArray();
    //console.log("docuemnt", document);

    if (document.length === 0) {
      return res.status(404).json({ error: "No Data Found" })
    }
    const fetchQuestions = document[0].fmsQuestionare;


    //console.log("fetchQuestions", fetchQuestions);

    let questionBank = [];
    for (let i = 0; i < fetchQuestions.length; i++) {
      const element = fetchQuestions[i];
      if (element.answerType === 'DATE') {
        questionBank.push(element)
      }
      //console.log("element", element);
    }

    //console.log("questionBank", questionBank);
    infoLogger.log("info", `Username: ${userName} from company:${companyUrl} successfully fetch the questionBank:${JSON.stringify(questionBank)}`)

    res.json({
      message: "Task fetched successfully",
      questionBank: questionBank,
      status: 200
    });

  } catch (error) {
    console.error("Error Connecting to MongoDB", error);
    errorLogger.log("error" , `Username:${userName} from company:${companyUrl} failed to fetch the questionBank due to ${error.message}`);

    return res.status(500).send({ error: "Failed to fetch form dates", status: 500 });
  }
});


getFms.get('/findHistoricalFms', async (req, res) => {

  // Initialize variables to hold user details
  let userDetails = await fetchUserDetails(req.headers.authorization);
  let userName = userDetails.userName;
  let userID = userDetails.userID;
  let companyUrl = userDetails.companyUrl;
  let userEmail = userDetails.userEmail;


  try {
    // Connect to MongoDB and perform operations
    const client = await MongoClient.connect(process.env.MONGO_DB_STRING);
    //console.log('Connected to database');
    const db = client.db(companyUrl);
    const collection = db.collection('fmsMaster');
    infoLogger.log("info", `Username: ${userName} from company: ${companyUrl}  hit the api findHistoricalFms`)

   
    const cursor = collection.find({fmsLive: false , isDraft : false});
    const documents = await cursor.toArray();
    infoLogger.log("info", `Username: ${userName} from company:${companyUrl} successfully fetch the historical FMS:${JSON.stringify(documents)}`)

    res.json({
      "message": [documents],
      "status": 200
    })

    // Close the MongoDB connection
    await client.close();
    console.log('MongoDB connection closed');
  }
  catch (error) {
    console.error('Error Connecting to MongoDB', error);
    errorLogger.log("error" , `Username:${userName} from company:${companyUrl} failed to fetch the historical FMS due to ${error.message}`);

    return res.status(500).json({ error: error.message });
  }
})


getFms.get('/findDraftFms', async (req, res) => {

  // Initialize variables to hold user details
  let userDetails = await fetchUserDetails(req.headers.authorization);
  let userName = userDetails.userName;
  let userID = userDetails.userID;
  let companyUrl = userDetails.companyUrl;
  let userEmail = userDetails.userEmail;


  try {
    // Connect to MongoDB and perform operations
    const client = await MongoClient.connect(process.env.MONGO_DB_STRING);
    //console.log('Connected to database');
    const db = client.db(companyUrl);
    const collection = db.collection('fmsMaster');
    infoLogger.log("info", `Username: ${userName} from company: ${companyUrl}  hit the api findHistoricalFms`)

   
    const cursor = collection.find({isDraft : true ,fmsLive: false });
    const documents = await cursor.toArray();
    infoLogger.log("info", `Username: ${userName} from company:${companyUrl} successfully fetch the historical FMS:${JSON.stringify(documents)}`)

    res.json({
      "message": [documents],
      "status": 200
    })

    // Close the MongoDB connection
    await client.close();
    console.log('MongoDB connection closed');
  }
  catch (error) {
    console.error('Error Connecting to MongoDB', error);
    errorLogger.log("error" , `Username:${userName} from company:${companyUrl} failed to fetch the historical FMS due to ${error.message}`);

    return res.status(500).json({ error: error.message });
  }
})





// to get all the fms all questions
getFms.post('/findallFmsquestion', async (req, res) => {

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

    infoLogger.log("info", `Username: ${userName} from company: ${companyUrl} hit the api findFmsQuestions`);

    const { fmsMasterId } = req.body;

    // Construct the query to find documents with the specified fmsMasterId
    const query = { fmsMasterId: fmsMasterId };

    // Fetch all documents that match the query
    const documents = await collection.find(query).toArray();

    infoLogger.log("info", `Username: ${userName} from company:${companyUrl} successfully fetch all fms questions:${JSON.stringify(documents)}`);

    // Send the response with the fetched documents
    res.json({
      "message": documents,
      "status": 200
    });

    // Close the MongoDB connection
    await client.close();
    console.log('MongoDB connection closed');

  } catch (error) {
    console.error('Error Connecting to MongoDB', error);
    errorLogger.log("error", `Username:${userName} from company:${companyUrl} failed to fetch all fms questionnaires due to ${error.message}`);
    return res.status(500).json({ error: error.message });
  }
});

getFms.post('/findallexternalEmployee', async (req, res) => {

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

    infoLogger.log("info", `Username: ${userName} from company: ${companyUrl} hit the api findFmsQuestions`);

    const { fmsMasterId } = req.body;

    // Construct the query to find documents with the specified fmsMasterId
    const query = { fmsMasterId: fmsMasterId };

    // Fetch all documents that match the query
    const documents = await collection.find(query).toArray();

    // Filter fmsSteps where externalEmployees is true
    const filteredSteps = documents.map(doc => {
      return {
        ...doc,
        fmsSteps: doc.fmsSteps.filter(step => step.whatsappData.externalEmployees === true)
      };
    });

    infoLogger.log("info", `Username: ${userName} from company:${companyUrl} successfully fetch all fms questions:${JSON.stringify(filteredSteps)}`);

    // Send the response with the fetched documents
    res.json({
      "message": filteredSteps,
      "status": 200
    });

    // Close the MongoDB connection
    await client.close();
    console.log('MongoDB connection closed');

  } catch (error) {
    console.error('Error Connecting to MongoDB', error);
    errorLogger.log("error", `Username:${userName} from company:${companyUrl} failed to fetch all fms questionnaires due to ${error.message}`);
    return res.status(500).json({ error: error.message });
  }

});



module.exports = getFms;
