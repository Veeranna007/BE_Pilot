const express = require("express");
const updateFmsTask = express.Router();
//var MongoClient = require('mongodb').MongoClient;
const { MongoClient, ObjectId } = require('mongodb');
const axios = require('axios');
const { CurrentIST } = require('../helpers/convertGMTtoIST');
const { Console } = require("winston/lib/winston/transports");
const moment = require('moment-timezone');
const { calculateFmsPlannedCompletionTime } = require("../helpers/calculateFmsPlannedCompleationTime");
const { fetchUserDetails } = require("../helpers/fetchuserDetails");

//update fms tasks 
//first it updates the task that is send 
//fetch the next task , 
//create a task for that user
updateFmsTask.post('/updateFmsTask', async (req, res) => {
    console.log("inside UPDATE FMS TASK -----------------------------------------------------------")
    console.log("inside UPDATE FMS TASK -----------------------------------------------------------")
    console.log("inside UPDATE FMS TASK -----------------------------------------------------------")
    console.log('REQUEST BODY', req.body)


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
    //console.log("fmsMasterDocument" , fmsMasterDocument)

    ///////////-------------------FETCHING THE fmsQA dOCUMENT---------------------------/////////////
    let fmsQAdocument;
    try {
        // Connect to MongoDB and perform operations
        const client = await MongoClient.connect(process.env.MONGO_DB_STRING);
        //console.log('Connected to database');
        const db = client.db(companyUrl);
        const collection = db.collection('fms');

        fmsQAdocument = await collection.findOne({ fmsMasterId: req.body.fmsMasterId, fmsQAId: req.body.fmsQAId });
        // Close the MongoDB connection
        await client.close();
        //console.log('MongoDB connection closed');
    }
    catch (error) {
        console.error('Error Connecting to MongoDB', error);
        return res.status(500).json({ error: error.message });
    }



    //////////////////////////////////////////////////////////////////////////////////////////////////////////
    console.log('UPDATING THE TASK')
    await updateTaskStatus(companyUrl, req.body.fmsTaskId, req.body.formStepsAnswers, req.body.fmsTaskQualityDetails);
    console.log('TASK UPDATED')
    ////////////////////////////////////////////////////////////////////////////////////////////////////////////


    //fetch next task to be created
    console.log("fetch next task to be created")
    let currentStep = await fmsMasterDocument.fmsSteps.find(step => step.what.what === req.body.fmsWhat.what);

    //This if This Condition is to check if this is the last step , only if it is not the last step then it has to fetch the next step and create it
    if (!currentStep.endStep) {
        console.log("currentStep is ", currentStep)

        let nextStep = await fmsMasterDocument.fmsSteps.find(step => step.what.what === currentStep.next[0].what);
        //let nextStepType = await fmsMasterDocument.fmsSteps.find(step => step.what.what === currentStep.plannedDate.type);

        if (nextStep.plannedDate.type == "T-X") {
            //checking if the fms contains t-x steps
            function getStepsWithTxDuration(fmsMasterDocument) {
                return fmsMasterDocument.fmsSteps.filter(step => step.plannedDate.type === "T-X");
            }

            let allTxSteps = getStepsWithTxDuration(fmsMasterDocument)
            //console.log("All TX steps", allTxSteps)
            console.log("FETCHED All TX steps")

             //find if the next task is already present , else create it 
            //if it is already present update the status
            //try catch block to check if the task is already created
            let isTaskAlreadyCreated //true or false
            let alreadyCreatedTask   //full task info if the task is already created
            try {
                // Connect to MongoDB and perform operations
                const client = await MongoClient.connect(process.env.MONGO_DB_STRING, {
                    socketTimeoutMS: 60000, // Increase timeout to 60 seconds
                });
                //console.log('Connected to database');
                const db = client.db(companyUrl);
                const collection = db.collection('fmsTasks');

                const document = await collection.findOne({ fmsMasterId: req.body.fmsMasterId, fmsQAId: req.body.fmsQAId, stepId: nextStep.id });
                console.log('retrieved document', document);
                if (document) {
                    isTaskAlreadyCreated = true;
                    alreadyCreatedTask = document
                } else {
                    isTaskAlreadyCreated = false;
                }

                // Close the MongoDB connection
                client.close();
                //console.log('MongoDB connection closed');
            }
            catch (error) {
                console.error('Error Connecting to MongoDB', error);
                return res.status(500).json({ error: error.message });
            }
            console.log('isTaskAlreadyCreated', isTaskAlreadyCreated)

            //if task is already created update the task
            let updatedStatus;
            if (isTaskAlreadyCreated == true) {
                //compare the taskPlannedCompletionTime and current time and based on that set the Status
                const currentDate = moment().tz('Asia/Kolkata').format();
                if (alreadyCreatedTask.fmsTaskPlannedCompletionTime > currentDate) {
                    console.log("updateTask.fmsTaskPlannedCompletionTime", alreadyCreatedTask.fmsTaskPlannedCompletionTime)
                    console.log("currentDateTime", currentDate)
                    updatedStatus = "PENDING"
                } else {
                    console.log("updateTask.fmsTaskPlannedCompletionTime", alreadyCreatedTask.fmsTaskPlannedCompletionTime)
                    console.log("currentDateTime", currentDate)
                    updatedStatus = "OVERDUE"
                }

                //TRY CATCH BLOCK TO UPDATE THE TASK
                try {
                    // Connect to MongoDB and perform operations
                    const client = await MongoClient.connect(process.env.MONGO_DB_STRING);
                    //console.log('Connected to database');
                    const db = client.db(companyUrl);
                    const collection = db.collection('fmsTasks');

                    console.log("Updated Status", '----------------', updatedStatus)
                    //let nextStepId = req.body.stepId + 1
                    const task = await collection.findOneAndUpdate(
                        { fmsMasterId: req.body.fmsMasterId, fmsQAId: req.body.fmsQAId, stepId: currentStep.next[0].id },
                        {
                            $set: {
                                fmsTaskStatus: updatedStatus,
                            }
                        },
                        { returnOriginal: false }
                    );

                    // Close the MongoDB connection
                    await client.close();
                    //console.log('MongoDB connection closed');
                }
                catch (error) {
                    console.error('Error Connecting to MongoDB', error);
                    return res.status(500).json({ error: error.message });
                }
            } else {
                 ////////////////////////////---------CREATING NEXT TX TASKS--------------------///////////////////////////////////////////
            await createTxSteps(companyUrl, fmsMasterDocument, fmsMasterDocument.fmsSteps, req.body.fmsQAId, allTxSteps, fmsQAdocument)
            console.log(" created next T-X STEPS nextT-Xsteps");
            //////////////////////////---------CREATING NEXT TX TASKS--------------------///////////////////////////////////////////
            }
        }
        else {
            console.log("next step is ", nextStep)

            console.log("NEXT STEP WHAT IS", nextStep.what)
            console.log("NEXT STEP ID IS", nextStep.id)
            console.log("IS LAST STEP", currentStep.endStep)


            //find if the next task is already present , else create it 
            //if it is already present update the status
            //try catch block to check if the task is already created
            let isTaskAlreadyCreated //true or false
            let alreadyCreatedTask   //full task info if the task is already created
            try {
                // Connect to MongoDB and perform operations
                const client = await MongoClient.connect(process.env.MONGO_DB_STRING, {
                    socketTimeoutMS: 60000, // Increase timeout to 60 seconds
                });
                //console.log('Connected to database');
                const db = client.db(companyUrl);
                const collection = db.collection('fmsTasks');

                const document = await collection.findOne({ fmsMasterId: req.body.fmsMasterId, fmsQAId: req.body.fmsQAId, stepId: nextStep.id });
                console.log('retrieved document', document);
                if (document) {
                    isTaskAlreadyCreated = true;
                    alreadyCreatedTask = document
                } else {
                    isTaskAlreadyCreated = false;
                }

                // Close the MongoDB connection
                client.close();
                //console.log('MongoDB connection closed');
            }
            catch (error) {
                console.error('Error Connecting to MongoDB', error);
                return res.status(500).json({ error: error.message });
            }
            console.log('isTaskAlreadyCreated', isTaskAlreadyCreated)

            //if task is already created update the task
            let updatedStatus;
            if (isTaskAlreadyCreated == true) {
                //compare the taskPlannedCompletionTime and current time and based on that set the Status
                const currentDate = moment().tz('Asia/Kolkata').format();
                if (alreadyCreatedTask.fmsTaskPlannedCompletionTime > currentDate) {
                    console.log("updateTask.fmsTaskPlannedCompletionTime", alreadyCreatedTask.fmsTaskPlannedCompletionTime)
                    console.log("currentDateTime", currentDate)
                    updatedStatus = "PENDING"
                } else {
                    console.log("updateTask.fmsTaskPlannedCompletionTime", alreadyCreatedTask.fmsTaskPlannedCompletionTime)
                    console.log("currentDateTime", currentDate)
                    updatedStatus = "OVERDUE"
                }

                //TRY CATCH BLOCK TO UPDATE THE TASK
                try {
                    // Connect to MongoDB and perform operations
                    const client = await MongoClient.connect(process.env.MONGO_DB_STRING);
                    //console.log('Connected to database');
                    const db = client.db(companyUrl);
                    const collection = db.collection('fmsTasks');

                    console.log("Updated Status", '----------------', updatedStatus)
                    let nextStepId = req.body.stepId + 1
                    const task = await collection.findOneAndUpdate(
                        { fmsMasterId: req.body.fmsMasterId, fmsQAId: req.body.fmsQAId, stepId: currentStep.next[0].id },
                        {
                            $set: {
                                fmsTaskStatus: updatedStatus,
                            }
                        },
                        { returnOriginal: false }
                    );

                    // Close the MongoDB connection
                    await client.close();
                    //console.log('MongoDB connection closed');
                }
                catch (error) {
                    console.error('Error Connecting to MongoDB', error);
                    return res.status(500).json({ error: error.message });
                }
            } else {
                //Task is not Created , so create the Task
                console.log('Task is not Created , so create the Task')
                //fetching details to create the task

                let isNotLastTask;   //this variable is to check if this is the last task
                let nextTask;
                let employee;
                let processId;
                let plannedDate;
                let what;
                let how;
                let stepId;
                let stepType;
                let duration;
                let durationType;  //either hrs or days
                let working;        //this is only for hrs --> values can only be "INSIDE" or "OUTSIDE"
                let isWhatsAppEnabled;
                let whatsappData;
                let endStep;
                let startTimeType;
                // new keys for TAT in days and T-X functionality
                let endTime;
                let type;
                let answer;

                let fmsSteps;



                // // Find the first object in the "who" array where "typeOfShift" is "All"
                // const whoObject = fmsMasterDocument.fmsSteps.find(step => step.who.typeOfShift === 'All');

                // // Check if the "who" object was found
                // if (!whoObject) {
                //     console.log('No "who" object found with typeOfShift "All".');
                //     return;
                // }

                //console.log('stepId IS ' , req.body.stepId)
                console.log('no of steps in that fms', fmsMasterDocument.fmsSteps.length)
                if (fmsMasterDocument.fmsSteps.length >= 1) {
                    // WE SHOULD CREATE THE NEXT TASK AS THIS IS NOT THE LAST STEP IN THE FMS
                    console.log('THERE ARE OTHER STEPS')
                    isNotLastTask = true

                    // Extract the first employee's information from the "employees" array as right now only 1 shift is presnt and only one employee
                    //employee = whoObject.who.employees[0];   //who

                    employee = fmsMasterDocument.fmsSteps.find(step => step.id === nextStep.id).who.employees[0];   //who
                    processId = fmsMasterDocument.fmsProcess
                    plannedDate = fmsMasterDocument.fmsSteps.find(step => step.id === nextStep.id).plannedDate;
                    what = fmsMasterDocument.fmsSteps.find(step => step.id === nextStep.id).what
                    how = fmsMasterDocument.fmsSteps.find(step => step.id === nextStep.id).how
                    stepId = fmsMasterDocument.fmsSteps.find(step => step.id === nextStep.id).id
                    nextTask = fmsMasterDocument.fmsSteps.find(step => step.id === nextStep.id).next
                    stepType = fmsMasterDocument.fmsSteps.find(step => step.id === nextStep.id).stepType   //DOER OR QUALITY
                    duration = fmsMasterDocument.fmsSteps.find(step => step.id === nextStep.id).plannedDate.duration
                    durationType = fmsMasterDocument.fmsSteps.find(step => step.id === nextStep.id).plannedDate.durationType
                    //fetch working only when durationType is hrs else set it to null
                    if (durationType == "hrs") {
                        working = fmsMasterDocument.fmsSteps.find(step => step.id === nextStep.id).plannedDate.working
                    } else {
                        working = null
                    }
                    isWhatsAppEnabled = fmsMasterDocument.fmsSteps.find(step => step.id === nextStep.id).isWhatsAppEnabled
                    whatsappData = fmsMasterDocument.fmsSteps.find(step => step.id === nextStep.id).whatsappData
                    endStep = fmsMasterDocument.fmsSteps.find(step => step.id === nextStep.id).endStep
                    startTimeType = fmsMasterDocument.fmsSteps.find(step => step.id === nextStep.id).startTimeType
                    //fmsSteps = document.fmsSteps

                    // for TAT in days and T-X funtionality
                    endTime = fmsMasterDocument.fmsSteps.find(step => step.id === nextStep.id).plannedDate.endTime
                    type = fmsMasterDocument.fmsSteps.find(step => step.id === nextStep.id).plannedDate.type
                } else {
                    //WE SHOULD NOT CREATE THE NEXT TASK AS THIS IS THE LAST STEP IN THE FMS
                    isNotLastTask = false
                    console.log('THIS IS THE LAST STEP')
                    updateAndCountDocuments(companyUrl, fmsQAId, req.body.fmsMasterId);
                }

                //TRY CATCH BLOCK TO UPDATE THE TASK

                /////////////////////////////////////creating the task for the user in fmsTasks collection
                let plannedCompletionTime;
                let plannedCompletionTimeIST

                 // fetch type of shift
                 let typeOfShift = fmsMasterDocument.fmsSteps.find(step => step.id === nextStep.id).who.typeOfShift;
                 console.log("typeOfShift after" , typeOfShift);
                 
                 //based on the type of shift fetch employees 
                 // for individual shift fetch all the employees (if part)
                 // for all shift fetch only the first employee (else part)
                 let employeeList;
                 if(typeOfShift === 'Individual'){
                     employeeList = fmsMasterDocument.fmsSteps.find(step => step.id === nextStep.id).who.employees;
                 } else{
                     employeeList = fmsMasterDocument.fmsSteps.find(step => step.id === nextStep.id).who.employees[0];
                 }
               
                 console.log("employeeList for p2p steps" , employeeList);

              //  let employeeList = fmsMasterDocument.fmsSteps.find(step => step.id === nextStep.id).who.employees;
                try {
                    //calculation of fmsTaskPlannedCompletionTime (start time - form submitted time, and tat in hrs or days)
                    // Connect to MongoDB and perform operations
                    const client = await MongoClient.connect(process.env.MONGO_DB_STRING);
                    console.log('Connected to database');
                    const db = client.db(companyUrl);
                    const collection = db.collection('fmsTasks');
                    const fmsCollection = db.collection('fms');

                    // Find the last inserted document and get its incremental value
                    const lastDocument = await collection.find().sort({ _id: -1 }).limit(1).toArray();
                    let fmsTaskId = 1;

                    if (lastDocument.length > 0) {
                        fmsTaskId = lastDocument[0].fmsTaskId + 1;
                    }


                    //Calculate Fms Planned Completion Time
                    plannedCompletionTimeIST = await calculateFmsPlannedCompletionTime(companyUrl, duration, durationType, working, endTime, type, answer, CurrentIST(), plannedCompletionTime, plannedCompletionTimeIST , employeeList, typeOfShift);
                    
                    
                    let finalEmployee;
                    let finalPlannedDate;
                    if (typeOfShift === 'Individual') {
                        console.log("inside the indidual shift");
                        const { employeeId } = plannedCompletionTimeIST;
                        const employees = fmsMasterDocument.fmsSteps.find(step => step.id === nextStep.id).who.employees;
                        finalEmployee = employees.find(emp => emp.employeeId === employeeId);
                        finalPlannedDate = plannedCompletionTimeIST.plannedCompletionTimeIST;
                    } else {
                        console.log("inside the all shift");
                        finalEmployee = fmsMasterDocument.fmsSteps.find(step => step.id === nextStep.id).who.employees[0];
                        finalPlannedDate = plannedCompletionTimeIST;
                    }
    
    
                    
                    // const {  employeeId } = plannedCompletionTimeIST;
                    // console.log("employee id based on the return shift", employeeId);
                    // const employees = fmsMasterDocument.fmsSteps[0].who.employees;
                    // console.log("fmsMasterDocument employees" , employees );
                    
                    // const matchedEmployee = employees.find(emp => emp.employeeId === employeeId);
                    // console.log("matchedEmployee" , matchedEmployee);

                    const currentDate = moment().tz('Asia/Kolkata').format();
                    // Inserting data into the collection
                    const result = await collection.insertOne({
                        fmsTaskId,
                        fmsQAId: req.body.fmsQAId,
                        //fmsQACreatedBy: { userID: userID, userEmail: userEmail, userName: userName },
                        fmsMasterId: req.body.fmsMasterId,
                        fmsName: req.body.fmsName,
                        //fmsQA: req.body.fmsQA,
                        fmsTaskDoer: finalEmployee,
                        fmsTaskStatus: "PENDING",
                        fmsTaskCompletedStatus: "null",  //either ONTIME OR DELAYED
                        fmsProcessID: processId,
                        plannedDate: plannedDate,
                        what: what,
                        how: how,
                        next: nextTask,
                        stepId: stepId,
                        stepType: stepType,
                        endStep: endStep,
                        startTimeType: startTimeType,
                        fmsTaskCreatedTime: currentDate,
                        fmsTaskStartTime: currentDate,  //this is only for Step 1 as currentDate is same as task creation time
                        fmsTaskPlannedCompletionTime: finalPlannedDate,
                        formStepsAnswers: null,
                        fmsTaskQualityDetails: null,
                        isTransferredFrom: false,    //is this task transferred FROM other Task
                        isTranferredTo: false,       //is this task transferred TO other Task
                        transferredFromTaskId: null,
                        transferredToTaskId: null,
                        isWhatsAppEnabled: isWhatsAppEnabled,
                        whatsappData: whatsappData,
                        externalUsers: [],
                        at: null

                    });

                    console.log(result);
                    console.log('Created the Task');

                    // WHATSAPP Fetch and map external users if they exist
                    const fmsDocument = await fmsCollection.findOne({ 
                        fmsMasterId: req.body.fmsMasterId, 
                        fmsQAId: req.body.fmsQAId 
                    });

                    if (fmsDocument?.externalUsers?.length > 0) {
                        // Filter external users for the specific step_id
                        const matchedExternalUsers = fmsDocument.externalUsers.filter(user => 
                            user.step_id === stepId
                        );
            
                        if (matchedExternalUsers.length > 0) {
                            await collection.updateOne(
                                { 
                                    fmsTaskId: fmsTaskId,
                                    fmsMasterId: req.body.fmsMasterId, 
                                    fmsQAId: req.body.fmsQAId,
                                    stepId: stepId
                                },
                                {
                                    $set: {
                                        externalUsers: matchedExternalUsers // Set as an array
                                    }
                                }
                            );
                            console.log('External user data mapped to task:', matchedExternalUsers);
                        }
                    }
                
                    // Close the MongoDB connection
                    await client.close();
                    console.log('MongoDB connection closed');

                } catch (error) {
                    console.error('Error posting data:', error);
                    return res.status(500).send({ error: error.message, status: 500 });

                }

                ////////////////////////////---------CREATING NEXT P2P TASKS--------------------///////////////////////////////////////////
                await nextP2Psteps(companyUrl, fmsMasterDocument, fmsMasterDocument.fmsSteps, stepId, req.body.fmsQAId)
                console.log("nextP2Psteps");
                ////////////////////////////---------CREATING NEXT P2P TASKS--------------------///////////////////////////////////////////


            }
        }

    }

    res.json({
        "message": `Task Updated`,
        "status": 200
    });
})


//This is a recursive function to update all the tasks to COMPLETED status (by validating if the task is transferred or not , if transferred update the transferred from tasks as well)
async function updateTaskStatus(companyUrl, fmsTaskId, formStepsAnswers, fmsTaskQualityDetails) {
    console.log('INSIDE THE FUNCTION TO UPDATE THE TASK STATUS TO COMPLETED')
    const dbName = companyUrl; // replace with your database name
    const client = await MongoClient.connect(process.env.MONGO_DB_STRING);

    try {
        await client.connect();
        const db = client.db(dbName);
        const collection = db.collection('fmsTasks'); // replace with your collection name

        // Recursive function to update task and its transferred tasks
        async function updateTaskRecursively(taskId) {
            console.log('TASK THAT IS GETTING UPDATED IS (RECURSIVE FUNCTION)', taskId)
            const currentDate = moment().tz('Asia/Kolkata').format();
            const task = await collection.findOneAndUpdate(
                { fmsTaskId: taskId },
                {
                    $set: {
                        fmsTaskStatus: "COMPLETED",
                        formStepsAnswers: formStepsAnswers,
                        fmsTaskQualityDetails: fmsTaskQualityDetails,
                        at: currentDate
                    }
                },
                { returnOriginal: false }
            );

            if (!task.fmsTaskId) {
                console.log(`Task with fmsTaskId ${taskId} not found`);
                return;
            }

             //-------------------------Triggr Whatsapp Messages---------------------------------------//
             const updatedTask = await collection.findOne({ fmsTaskId: taskId });
             let fmsSteps
                     try {
                        const instancesendWhatsapp = axios.create({ httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }) });
                        const sendWhatsapp = await instancesendWhatsapp.post(
                            process.env.MAIN_BE_WHATSAPP_URL,
                            {
                                verify_company_url: companyUrl,
                                fmsSteps: updatedTask,
                                
                            }
                        );
                        console.log("whatsapp------------",fmsSteps)
                    } catch (whatsappError) {
                        console.error('Error sending WhatsApp message:', whatsappError);
                    }
            //-------------------------------------------------------------------------------------------//
            console.log('Task updated:', task.fmsTaskId);

            //-----------------------------yusuf 
            const masterDocument = await collection.findOne({ fmsTaskId: taskId });
            console.log('recieved document', masterDocument.fmsTaskPlannedCompletionTime)
            // const fmsTaskPlannedCompletionTime = task.value.fmsTaskPlannedCompletionTime;
            const currentTimeIST = moment().tz('Asia/Kolkata').format();
            console.log("Curent Time :", currentTimeIST);

            if (currentTimeIST <= masterDocument.fmsTaskPlannedCompletionTime) {
                await collection.updateOne(
                    { fmsTaskId: taskId },
                    { $set: { fmsTaskCompletedStatus: "ONTIME" } }
                );
                console.log(`Task ${taskId} completed ONTIME`);
            }
            else {
                await collection.updateOne(
                    { fmsTaskId: taskId },
                    { $set: { fmsTaskCompletedStatus: "DELAY" } }
                );
                console.log(`Task ${taskId} completed DELAY`);
            }
            //----------------------------------yusuf  

            // Check if the task is transferred from another task
            console.log('CHECKING IF THE TASK IS TRANSFERRD FROM SOME OTHER TASK')
            console.log(task.isTransferredFrom, 'task.isTransferredFrom')
            if (task.isTransferredFrom) {
                console.log('YES THE TASK IS TRANSFERRED FROM SOME OTHER TASK', task.isTransferredFrom)
                const transferredFromTaskId = task.transferredFromTaskId;
                console.log('transferredFromTaskId', transferredFromTaskId)
                // Recursively update the transferred task
                await updateTaskRecursively(transferredFromTaskId);
            }
        }

        // Start the recursive update with the initial task
        await updateTaskRecursively(fmsTaskId);

    } catch (error) {
        console.error('Error:', error);
        return res.status(500).json({ error: error.message });

    } finally {
        await client.close();
    }
}


//This Function will get Executed only if the last task in the FMS - it makes the fmsQAId document false , and fmsMasterId-1
async function updateAndCountDocuments(companyUrl, fmsQAId, fmsMasterId) {

    //update the fms to false
    try {
        const client = await MongoClient.connect(process.env.MONGO_DB_STRING);
        await client.connect();
        const db = client.db(companyUrl);
        const collection = db.collection('fms');

        // Update a document based on fmsQAId
        await collection.updateOne(
            { fmsQAId: fmsQAId },
            { $set: { fmsQAisLive: false } }
        );
        await client.close();
    } catch (error) {
        console.error("Error:", error);
        return res.status(500).json({ error: error.message });


    }

    //find  no of fms flows that are still active for that master id
    let count;
    try {
        const client = await MongoClient.connect(process.env.MONGO_DB_STRING);
        await client.connect();
        const db = client.db(companyUrl);
        const collection = db.collection('fms');


        // Define the query for counting documents
        const query = {
            fmsMasterId: fmsMasterId,
            fmsQAisLive: true
        };

        // Count documents matching the query
        count = await collection.countDocuments(query);
        console.log('NO OF FMS THAT ARE LIVE ', count);
        await client.close();
    } catch (error) {
        console.error("Error:", error);
        return res.status(500).json({ error: error.message });


    }

    //update in fmsMaster the total no of fms's flow that are still active
    try {
        const client = await MongoClient.connect(process.env.MONGO_DB_STRING);
        await client.connect();
        const db = client.db(companyUrl);
        const collection = db.collection('fmsMaster');

        const updateResult = await collection.updateOne(
            { fmsMasterId: fmsMasterId }, // Use the document's _id to find and update
            { $set: { noOfLive: count } }
        );

        console.log(`${updateResult.matchedCount} document(s) matched the filter, updated ${updateResult.modifiedCount} document(s) in the 'fmsMaster' collection.`);

        await client.close();
        return count;
    } catch (error) {
        console.error("Error:", error);
        return res.status(500).json({ error: error.message });

    }
}

async function nextP2Psteps(companyUrl, fmsMasterDocument, fmsSteps, startId, fmsQAId) {
    console.log("INSIDE THE FUNCTION THAT FINDS AND CREATE NEXT P-P steps")

    let result = [];
    let currentStep = fmsSteps.find(step => step.id === startId);
    console.log("currentStep", currentStep)
    let isFirstStep = true;

    while (currentStep) {
        // Add the current step to the result if it's P2P and not the first step
        if (currentStep.startTimeType === 'P2P' && !isFirstStep) {
            console.log("Step to be Added", currentStep)
            result.push(currentStep);


            //CREATE THE TASK
            try {
                //calculation of fmsTaskPlannedCompletionTime (start time - form submitted time, and tat in hrs or days)
                // Connect to MongoDB and perform operations
                const client = await MongoClient.connect(process.env.MONGO_DB_STRING);
                console.log('Connected to database');
                const db = client.db(companyUrl);
                const collection = db.collection('fmsTasks');

                // Find the last inserted document and get its incremental value
                const lastDocument = await collection.find().sort({ _id: -1 }).limit(1).toArray();
                let fmsTaskId = 1;

                if (lastDocument.length > 0) {
                    fmsTaskId = lastDocument[0].fmsTaskId + 1;
                }

                //find the task start time - planned competion time of previous task
                //based on fmMasterId and currentStepID and QAid
                function getPreviousStep(steps, currentId) {
                    for (let step of steps) {
                        for (let nextStep of step.next) {
                            if (nextStep.id === currentId) {
                                return step;
                            }
                        }
                    }
                    return null; // Return null if no previous step is found
                }
                const previousStep = getPreviousStep(fmsSteps, currentStep.id);
                console.log("previousStep", previousStep);

                async function getPreviousStepPlannedTaskCompletionTime(companyUrl, fmsMasterId, fmsQAId, stepId) {
                    try {
                        //calculation of fmsTaskPlannedCompletionTime (start time - form submitted time, and tat in hrs or days)
                        // Connect to MongoDB and perform operations
                        const client = await MongoClient.connect(process.env.MONGO_DB_STRING);
                        console.log('Connected to database');
                        const db = client.db(companyUrl);
                        const collection = db.collection('fmsTasks');

                        // Create the query
                        const query = {
                            fmsMasterId: fmsMasterId,
                            fmsQAId: fmsQAId,
                            stepId: stepId
                        };

                        // Find the task
                        const task = await collection.findOne(query);

                        if (task) {
                            console.log('Task found:', task);
                            return task.fmsTaskPlannedCompletionTime;
                        } else {
                            console.log('No task found with the given criteria');
                            return { success: false, message: 'No task found' };
                        }
                    } catch (error) {
                        console.error('Error posting data:', error);
                        return res.status(500).send({ error: error.message, status: 500 });
                    }
                }
                console.log("getPreviousStepPlannedTaskCompletionTime", companyUrl, fmsMasterDocument.fmsMasterId, fmsQAId, previousStep.id)
                const previousStepPlannedTaskCompletionTime = await getPreviousStepPlannedTaskCompletionTime(companyUrl, fmsMasterDocument.fmsMasterId, fmsQAId, previousStep.id);
                console.log("previousStepPlannedTaskCompletionTime", previousStepPlannedTaskCompletionTime)

                //plannedCompletionTime
                let plannedCompletionTime;
                let plannedCompletionTimeIST;
                let plannedCompletionTimeFunction = await calculateFmsPlannedCompletionTime(companyUrl, currentStep.plannedDate.duration, currentStep.plannedDate.durationType, currentStep.plannedDate.working, currentStep.plannedDate.endTime, currentStep.plannedDate.type, currentStep.plannedDate.answer, previousStepPlannedTaskCompletionTime, plannedCompletionTime, plannedCompletionTimeIST)




                const currentDate = moment().tz('Asia/Kolkata').format();
                // Inserting data into the collection
                const result = await collection.insertOne({
                    fmsTaskId,
                    fmsQAId,
                    //fmsQACreatedBy: { userID: userID, userEmail: userEmail, userName: userName },
                    fmsMasterId: fmsMasterDocument.fmsMasterId,
                    fmsName: fmsMasterDocument.fmsName,
                    //fmsQA: req.body.fmsQA,
                    fmsTaskDoer: currentStep.who.employees,
                    fmsTaskStatus: "PENDING",
                    fmsTaskCompletedStatus: "null",  //either ONTIME OR DELAYED
                    fmsProcessID: currentStep.processId,
                    plannedDate: currentStep.plannedDate,
                    what: currentStep.what,
                    how: currentStep.how,
                    next: currentStep.nextTask,
                    stepId: currentStep.id,
                    stepType: currentStep.stepType,
                    endStep: currentStep.endStep,
                    startTimeType: currentStep.startTimeType,
                    fmsTaskCreatedTime: currentDate,
                    fmsTaskStartTime: previousStepPlannedTaskCompletionTime,
                    fmsTaskPlannedCompletionTime: plannedCompletionTimeFunction,
                    formStepsAnswers: null,
                    fmsTaskQualityDetails: null,
                    isTransferredFrom: false,    //is this task transferred FROM other Task
                    isTranferredTo: false,       //is this task transferred TO other Task
                    transferredFromTaskId: null,
                    transferredToTaskId: null,
                    isWhatsAppEnabled: currentStep.isWhatsAppEnabled,
                    whatsappData: currentStep.whatsappData,
                    at: null

                });

                console.log(result);
                console.log('Created the Task');

                // Close the MongoDB connection
                await client.close();
                console.log('MongoDB connection closed');

            } catch (error) {
                console.error('Error posting data:', error);
                return res.status(500).send({ error: error.message, status: 500 });

            }
        }

        // Check if we should stop
        if ((currentStep.startTimeType === 'A2P' && !isFirstStep) || currentStep.endStep) {
            break;
        }

        isFirstStep = false;

        // Move to the next step
        if (currentStep.next.length > 0) {
            const nextId = currentStep.next[0].id;
            currentStep = fmsSteps.find(step => step.id === nextId);
        } else {
            currentStep = null;
        }
    }

    return result;
}

async function createTxSteps(companyUrl, fmsMasterDocument, fmsSteps, fmsQAId, allTxSteps, fmsQA) {
    console.log("INSIDE THE FUNCTION THAT FINDS AND CREATE NEXT T-X steps")

    //fetch and create consecutive T-X steps
    for (let i = 0; i < allTxSteps.length; i++) {

        console.log("inside the for loop to to fetch details and create the task")
        let isNotLastTask;   //this variable is to check if this is the last task
        let nextTask;
        let employee;
        let processId;
        let plannedDate;
        let what;
        let how;
        let stepId;
        let stepType;
        let duration;
        let durationType;  //either hrs or days
        let working;        //this is only for hrs --> values can only be "INSIDE" or "OUTSIDE"
        let isWhatsAppEnabled;
        let whatsappData;
        let endStep;
        let startTimeType;
        // new keys for TAT in days and T-X functionality
        let endTime;
        let type;
        let answer;

        let fmsSteps;



        // Find the first object in the "who" array where "typeOfShift" is "All"
        // const whoObject = allTxSteps.find(step => step.who.typeOfShift === 'All');

        // // Check if the "who" object was found
        // if (!whoObject) {
        //     console.log('No "who" object found with typeOfShift "All".');
        //     return;
        // }

        //console.log('stepId IS ' , req.body.stepId)
        console.log('no of steps TX in that fms', allTxSteps.length)
        if (allTxSteps.length >= 1) {
            // WE SHOULD CREATE THE NEXT TASK AS THIS IS NOT THE LAST STEP IN THE FMS
            console.log('THERE ARE OTHER STEPS')
            isNotLastTask = true

            // Extract the first employee's information from the "employees" array as right now only 1 shift is presnt and only one employee
            //employee = whoObject.who.employees[0];   //who

            employee = fmsMasterDocument.fmsSteps[i].who.employees[0];   //who
            processId = fmsMasterDocument.fmsProcess
            plannedDate = allTxSteps[i].plannedDate
            what = allTxSteps[i].what
            how = allTxSteps[i].how
            stepId = allTxSteps[i].id
            nextTask = allTxSteps[i].next
            stepType = allTxSteps[i].stepType   //DOER OR QUALITY
            duration = allTxSteps[i].plannedDate.duration
            durationType = allTxSteps[i].plannedDate.durationType
            //fetch working only when durationType is hrs else set it to null
            if (durationType == "hrs") {
                working = allTxSteps[i].plannedDate.working
            } else {
                working = null
            }
            isWhatsAppEnabled = allTxSteps[i].isWhatsAppEnabled
            whatsappData = allTxSteps[i].whatsappData
            endStep = allTxSteps[i].endStep
            startTimeType = allTxSteps[i].startTimeType
            //fmsSteps = document.fmsSteps

            // for TAT in days and T-X funtionality
            endTime = allTxSteps[i].plannedDate.endTime
            type = allTxSteps[i].plannedDate.type
        } else {
            //WE SHOULD NOT CREATE THE NEXT TASK AS THIS IS THE LAST STEP IN THE FMS
            isNotLastTask = false
            console.log('THIS IS THE LAST STEP')
            updateAndCountDocuments(companyUrl, fmsQAId, req.body.fmsMasterId);
        }





        //try catch block to create next Task
        // create next task only if it is not the last step in the FMS
        let plannedCompletionTime;
        let plannedCompletionTimeIST
        console.log('Creating the next task if ', isNotLastTask)
        if (isNotLastTask) {
            /////////////////////////////////////creating the task for the user in fmsTasks collection
            try {
                //calculation of fmsTaskPlannedCompletionTime (start time - form submitted time, and tat in hrs or days)
                // Connect to MongoDB and perform operations
                const client = await MongoClient.connect(process.env.MONGO_DB_STRING);
                console.log('Connected to database');
                const db = client.db(companyUrl);
                const collection = db.collection('fmsTasks');

                // Find the last inserted document and get its incremental value
                const lastDocument = await collection.find().sort({ _id: -1 }).limit(1).toArray();
                let fmsTaskId = 1;

                if (lastDocument.length > 0) {
                    fmsTaskId = lastDocument[0].fmsTaskId + 1;
                }

                console.log("fmsQA.answer", fmsQA.fmsQA[0].answer)
                //Calculate Fms Planned Completion Time
                plannedCompletionTimeIST = await calculateFmsPlannedCompletionTime(companyUrl, duration, durationType, working, endTime, type, fmsQA.fmsQA[0].answer, CurrentIST(), plannedCompletionTime, plannedCompletionTimeIST);

                const currentDate = moment().tz('Asia/Kolkata').format();
                // Inserting data into the collection
                const result = await collection.insertOne({
                    fmsTaskId,
                    fmsQAId,
                    //fmsQACreatedBy: { userID: userID, userEmail: userEmail, userName: userName },
                    fmsMasterId: fmsMasterDocument.fmsMasterId,
                    fmsName: fmsMasterDocument.fmsName,
                    //fmsQA: req.body.fmsQA,
                    fmsTaskDoer: employee,
                    fmsTaskStatus: "PENDING",
                    fmsTaskCompletedStatus: "null",  //either ONTIME OR DELAYED
                    fmsProcessID: processId,
                    plannedDate: plannedDate,
                    what: what,
                    how: how,
                    next: nextTask,
                    stepId: stepId,
                    stepType: stepType,
                    endStep: endStep,
                    startTimeType: startTimeType,
                    fmsTaskCreatedTime: currentDate,
                    fmsTaskStartTime: currentDate,  //this is only for Step 1 as currentDate is same as task creation time
                    fmsTaskPlannedCompletionTime: plannedCompletionTimeIST,
                    //fmsTaskPlannedCompletionTime: null,
                    formStepsAnswers: null,
                    fmsTaskQualityDetails: null,
                    isTransferredFrom: false,    //is this task transferred FROM other Task
                    isTranferredTo: false,       //is this task transferred TO other Task
                    transferredFromTaskId: null,
                    transferredToTaskId: null,
                    isWhatsAppEnabled: isWhatsAppEnabled,
                    whatsappData: whatsappData,
                    at: null
                });

                console.log(result);
                console.log('Created the Task');

                // Close the MongoDB connection
                await client.close();
                console.log('MongoDB connection closed');

            } catch (error) {
                console.error('Error posting data:', error);
                return res.status(500).send({ error: error.message, status: 500 });
            }
        }
    }
}



module.exports = updateFmsTask;
