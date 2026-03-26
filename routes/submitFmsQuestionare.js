const express = require("express");
const submitFmsQuestionare = express.Router();
var MongoClient = require('mongodb').MongoClient;
const axios = require('axios');
//const moment = require('moment-timezone');
const { CurrentIST, addHrs, addDays, addDaysToADate, formatDateFromDateObjectToString, getCurrentDateInIST } = require('../helpers/convertGMTtoIST');
const moment = require('moment');
const { calculateFmsPlannedCompletionTime } = require("../helpers/calculateFmsPlannedCompleationTime");
const e = require("express");
const { fetchUserDetails } = require("../helpers/fetchuserDetails");
const { infoLogger, errorLogger } = require("../middleware/logger");



submitFmsQuestionare.post('/submitFmsUserQAcreateTaskStep1', async (req, res) => {
    console.log("--------------------inside fms fmsUserQA create task for step 1--------------------------")
    console.log("--------------------inside fms fmsUserQA create task for step 1--------------------------")
    console.log("--------------------inside fms fmsUserQA create task for step 1--------------------------")
    console.log(req.body)

    // Initialize variables to hold user details
    let userDetails = await fetchUserDetails(req.headers.authorization);
    let userName = userDetails.userName;
    let userID = userDetails.userID;
    let companyUrl = userDetails.companyUrl;
    let userEmail = userDetails.userEmail;


    ///////////////////////////////////////////try catch block to submit QA
    let fmsQAId;
    let fmsTemp = req.body;
    try {

        // Connect to MongoDB and perform operations
        const client = await MongoClient.connect(process.env.MONGO_DB_STRING);
        console.log('Connected to database');
        const db = client.db(companyUrl);
        const collection = db.collection('fms');
        infoLogger.log("info", `Username:${userName} from company:${companyUrl} hit the api submitFmsUserQAcreateTaskStep1 with body params: ${JSON.stringify(req.body)}`)


        // Find the last inserted document and get its incremental value
        const lastDocument = await collection.find().sort({ _id: -1 }).limit(1).toArray();
        fmsQAId = 1;

        if (lastDocument.length > 0) {
            fmsQAId = lastDocument[0].fmsQAId + 1;
        }

        // Inserting data into the collection
        const result = await collection.insertOne({
            fmsQAId,
            fmsQACreatedBy: { userID: userID, userEmail: userEmail, userName: userName },
            fmsMasterId: req.body.fmsMasterID,
            fmsName: req.body.fmsName,
            fmsQA: req.body.fmsQA,
            externalUsers: req.body.externalUsers,
            fmsQAisLive: true

        });
        console.log('Submitted the QA');
        // Close the MongoDB connection
        await client.close();
        //console.log('MongoDB connection closed');

    } catch (error) {
        console.error('Error posting data:', error);
        return res.status(500).send({ error: 'Error Submitting QA', status: 500 });

    }

    //try catch block to increment the live fms no
    try {

        // Connect to MongoDB and perform operations
        const client = await MongoClient.connect(process.env.MONGO_DB_STRING);
        //console.log('Connected to database');
        const db = client.db(companyUrl);
        const collection = db.collection('fmsMaster');

        // Find the document and increment the noofFmsLive field
        const result = await collection.findOneAndUpdate(
            { fmsMasterId: req.body.fmsMasterID }, // Filter based on fmsMasterId
            { $inc: { noOfLive: 1 } }, // Update operation
            { returnOriginal: false } // Options (returnOriginal: false means return the modified document)
        );

        //console.log(result);

        // Close the MongoDB connection
        await client.close();
        //console.log('MongoDB connection closed');

    } catch (error) {
       
        console.error('Error posting data:', error);
        return res.status(500).send({ error: error.message, status: 500 });

    }

    console.log('QA is submitted and fmsMaster is also incremented')

    ///////////-------------------FETCHING THE fmsMasterDocument---------------------------/////////////
    let fmsMasterDocumentMain;
    try {
        // Connect to MongoDB and perform operations
        const client = await MongoClient.connect(process.env.MONGO_DB_STRING);
        //console.log('Connected to database');
        const db = client.db(companyUrl);
        const collection = db.collection('fmsMaster');

        fmsMasterDocumentMain = await collection.findOne({ fmsMasterId: req.body.fmsMasterID });
        // Close the MongoDB connection
        await client.close();
        //console.log('MongoDB connection closed');
    }
    catch (error) {
        console.error('Error Connecting to MongoDB', error);
        return res.status(500).json({ error: error.message });
    }

    //check if the first step is not  t-x , if it not then create the task
    if (!(fmsMasterDocumentMain.fmsSteps[0].plannedDate.type == "T-X")) {
        console.log("Inside the function to create the first A2P step")
        ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
        //////////////////////////////////try catch block to find all the detials required for Task Creation For Step 1
        ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

        //let taskCreationObject = await fetchDetailsForTask(fmsMasterDocument, fmsQAId)

        //let fmsMasterDocument
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


        console.log('no of steps in that fms', fmsMasterDocumentMain.fmsSteps.length)
        if (fmsMasterDocumentMain.fmsSteps.length >= 1) {
            // WE SHOULD CREATE THE NEXT TASK AS THIS IS NOT THE LAST STEP IN THE FMS
            console.log('THERE ARE OTHER STEPS')
            isNotLastTask = true

            // Extract the first employee's information from the "employees" array as right now only 1 shift is presnt and only one employee
            //employee = whoObject.who.employees[0];   //who

            // employee = fmsMasterDocumentMain.fmsSteps[0].who.employees[0];   //who
            processId = fmsMasterDocumentMain.fmsProcess
            plannedDate = fmsMasterDocumentMain.fmsSteps[0].plannedDate
            what = fmsMasterDocumentMain.fmsSteps[0].what
            how = fmsMasterDocumentMain.fmsSteps[0].how
            stepId = fmsMasterDocumentMain.fmsSteps[0].id
            nextTask = fmsMasterDocumentMain.fmsSteps[0].next
            stepType = fmsMasterDocumentMain.fmsSteps[0].stepType   //DOER OR QUALITY
            duration = fmsMasterDocumentMain.fmsSteps[0].plannedDate.duration
            durationType = fmsMasterDocumentMain.fmsSteps[0].plannedDate.durationType
            //fetch working only when durationType is hrs else set it to null
            if (durationType == "hrs") {
                working = fmsMasterDocumentMain.fmsSteps[0].plannedDate.working
            } else {
                working = null
            }
            isWhatsAppEnabled = fmsMasterDocumentMain.fmsSteps[0].isWhatsAppEnabled
            whatsappData = fmsMasterDocumentMain.fmsSteps[0].whatsappData
            endStep = fmsMasterDocumentMain.fmsSteps[0].endStep
            startTimeType = fmsMasterDocumentMain.fmsSteps[0].startTimeType
            fmsSteps = fmsMasterDocumentMain.fmsSteps

            // for TAT in days and T-X funtionality
            endTime = fmsMasterDocumentMain.fmsSteps[0].plannedDate.endTime
            type = fmsMasterDocumentMain.fmsSteps[0].plannedDate.type
        } else {
            //WE SHOULD NOT CREATE THE NEXT TASK AS THIS IS THE LAST STEP IN THE FMS
            isNotLastTask = false
            console.log('THIS IS THE LAST STEP')
            updateAndCountDocuments(companyUrl, fmsQAId, req.body.fmsMasterId);
        }



        //await client.close();
        //console.log('MongoDB connection closed');

        //} 
        // catch (error) {
        //     console.error('Error posting data:', error);
        //     return res.status(500).send({ error: error.message, status: 500 });
        //     // return;
        // }

        console.log("GETTING THE FETCHED OBJECT", plannedDate, "-------", duration, '----------', durationType)

        ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

        //try catch block to create next Task
        // create next task only if it is not the last step in the FMS
        let plannedCompletionTime;
        let plannedCompletionTimeIST;
        let typeOfShift = fmsMasterDocumentMain.fmsSteps[0].who.typeOfShift;
        console.log("typeOfShift", typeOfShift);

        let employeeList;
        if (typeOfShift === 'Individual') {
            employeeList = fmsMasterDocumentMain.fmsSteps[0].who.employees;
        } else {
            employeeList = fmsMasterDocumentMain.fmsSteps[0].who.employees[0];
        }

        console.log('Creating the next task if ', isNotLastTask)
        if (isNotLastTask) {
            /////////////////////////////////////creating the task for the user in fmsTasks collection
            try {
                //calculation of fmsTaskPlannedCompletionTime (start time - form submitted time, and tat in hrs or days)
                // Check if the stepId matches any step_id in the externalUsers array
                const externalUserForStep = req.body.externalUsers.filter(user => user.step_id === stepId) || [] ;
                const externalUsers = externalUserForStep.length > 0 ? externalUserForStep : [];
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


                //Calculate Fms Planned Completion Time
                plannedCompletionTimeIST = await calculateFmsPlannedCompletionTime(companyUrl, duration, durationType, working, endTime, type, answer, CurrentIST(), plannedCompletionTime, plannedCompletionTimeIST, employeeList, typeOfShift);

                let finalEmployee;
                let finalPlannedDate;
                if (typeOfShift === 'Individual') {
                    console.log("inside the indidual shift");
                    const { employeeId } = plannedCompletionTimeIST;
                    const employees = fmsMasterDocumentMain.fmsSteps[0].who.employees;
                    finalEmployee = employees.find(emp => emp.employeeId === employeeId);
                    finalPlannedDate = plannedCompletionTimeIST.plannedCompletionTimeIST;
                } else {
                    console.log("inside the all shift");
                    finalEmployee = fmsMasterDocumentMain.fmsSteps[0].who.employees[0];
                    finalPlannedDate = plannedCompletionTimeIST;
                }

                //   console.log("employee id based on the return shift", employeeId);
                // const employees = fmsMasterDocumentMain.fmsSteps[0].who.employees;
                // const matchedEmployee = employees.find(emp => emp.employeeId === employeeId);
                // console.log("matchedEmployee" , matchedEmployee);


                const currentDate = moment().tz('Asia/Kolkata').format();
                // Inserting data into the collection
                const result = await collection.insertOne({
                    fmsTaskId,
                    fmsQAId,
                    //fmsQACreatedBy: { userID: userID, userEmail: userEmail, userName: userName },
                    fmsMasterId: req.body.fmsMasterID,
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
                    externalUsers: externalUsers,
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


        ////////////////////////////---------CREATING NEXT P2P TASKS--------------------///////////////////////////////////////////
        await nextP2Psteps(companyUrl, fmsMasterDocumentMain, fmsMasterDocumentMain.fmsSteps, stepId, fmsQAId)
        console.log(" created next P2P STEPS nextP2Psteps");
        ////////////////////////////---------CREATING NEXT P2P TASKS--------------------///////////////////////////////////////////



        //-------------------------Triggr Android Notification---------------------------------------//
        ///sending android notification data
        const currentDate = moment().tz('Asia/Kolkata').format();
        // try {

        // code to contact between postgress and mongo

        // const instancesendWhatsappAndroid = axios.create({ httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }) });
        // const sendAndroidNotification = await instancesendWhatsappAndroid.post(
        //   process.env.MAIN_ANDROID_NOTIFICATION,
        //   {
        //    verify_company_url: companyUrl,
        //    assigned_to: employee.employeeId,
        //     user_id:userID,
        //     fmsName:req.body.fmsName,
        //     what:what,
        //     fmsTaskCreatedTime:currentDate,
        //     fmsTaskPlannedCompletionTime: plannedCompletionTime,
        //   }
        // );


        //     const sendAndroidNotification = await axios.post(process.env.MAIN_ANDROID_NOTIFICATION, {
        //     verify_company_url: companyUrl,
        //     assigned_to: employee.employeeId,
        //     user_id:userID,
        //     fmsName:req.body.fmsName,
        //     what:what,
        //     fmsTaskCreatedTime:currentDate,
        //     fmsTaskPlannedCompletionTime: plannedCompletionTime,
        //     });

        //     console.log('Android Notification sent', sendAndroidNotification.data);
        // } catch (androidError) {
        //     console.error('Error sending WhatsApp message:', androidError);
        // }
    } else {
        console.log("Inside the function to create the first TX steps")
        //console.log("fmsMasterDocumentMain" , fmsMasterDocumentMain)
        ///ecxeption case for T-X feature 
        //after the fms is requested , check if the fms contains T-X steps , if yes create all the t-x steps

        //checking if the fms contains t-x steps
        function getStepsWithTxDuration(fmsMasterDocumentMain) {
            return fmsMasterDocumentMain.fmsSteps.filter(step => step.plannedDate.type === "T-X");
        }


        let allTxSteps = getStepsWithTxDuration(fmsMasterDocumentMain)
        //console.log("All TX steps" , allTxSteps)
        console.log("FETCHED All TX steps")

        if (allTxSteps.length > 0) {
            ////////////////////////////---------CREATING NEXT TX TASKS--------------------///////////////////////////////////////////
            await createTxSteps(companyUrl, fmsMasterDocumentMain, fmsMasterDocumentMain.fmsSteps, fmsQAId, allTxSteps, req.body.fmsQA)
            console.log(" created next T-X STEPS nextT-Xsteps");
            //////////////////////////---------CREATING NEXT TX TASKS--------------------///////////////////////////////////////////
        }
        // else {

        // }

    }


    res.json({
        "message": `FMS form is submitted and Step 1 task is Createed`,
        "status": 200
    });

})
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
/////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////

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
        return res.status(500).send({ error: error.message, status: 500 });
        //console.error("Error:", error);

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
        return res.status(500).send({ error: error.message, status: 500 });

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
        return res.status(500).send({ error: error.message, status: 500 });

    }
}




async function nextP2Psteps(companyUrl, fmsMasterDocument, fmsSteps, startId, fmsQAId) {
    console.log("INSIDE THE FUNCTION THAT FINDS AND CREATE NEXT P-P steps")

    let result = [];
    let currentStep = fmsSteps.find(step => step.id === startId);
    console.log("currentStep", currentStep)
    let isFirstStep = true;

    while (currentStep) {
        // Add the current step to the result if it's P2P and not the first step(because the first step will be A2P)
        //it will only go inside the loop if it is a P2P -- rejected the first step from going inside the loop
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

                // Find the last inserted document and get its incremental value , NO NEED TO FILTER WITH MASTER ID AND QA ID as we are doing this just to get the task id
                const lastDocument = await collection.find().sort({ _id: -1 }).limit(1).toArray();
                let fmsTaskId = 1;

                if (lastDocument.length > 0) {
                    fmsTaskId = lastDocument[0].fmsTaskId + 1;
                }

                //find the task start time - planned competion time of previous task
                //based on fmMasterId and currentStepID and QAid
                // function getPreviousStep(steps, currentId) {
                //     for (let step of steps) {
                //         for (let nextStep of step.next) {
                //             if (nextStep.id === currentId) {
                //                 return step;
                //             }
                //         }
                //     }
                //     return null; // Return null if no previous step is found
                // }
                // const previousStep = getPreviousStep(fmsSteps, currentStep.id);
                //console.log("previousStep", previousStep);

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
                console.log("previousStepPlannedTaskCompletionTime last", previousStepPlannedTaskCompletionTime)

                console.log("currect step employee details", currentStep.who.employees);

                //plannedCompletionTime
                let plannedCompletionTime;
                let plannedCompletionTimeIST;

                // fetch type of shift
                let typeOfShift = currentStep.who.typeOfShift;
                console.log("typeOfShift p to p", typeOfShift);

                //based on the type of shift fetch employees 
                // for individual shift fetch all the employees (if part)
                // for all shift fetch only the first employee (else part)
                let employeeList;
                if (typeOfShift === 'Individual') {
                    employeeList = currentStep.who.employees;
                } else {
                    employeeList = currentStep.who.employees[0];
                }

                console.log("employeeList for p2p steps", employeeList);

                let plannedCompletionTimeFunction = await calculateFmsPlannedCompletionTime(companyUrl, currentStep.plannedDate.duration, currentStep.plannedDate.durationType, currentStep.plannedDate.working, currentStep.plannedDate.endTime, currentStep.plannedDate.type, currentStep.plannedDate.answer, previousStepPlannedTaskCompletionTime, plannedCompletionTime, plannedCompletionTimeIST, employeeList, typeOfShift)

                let finalEmployee;
                let finalPlannedDate;
                if (typeOfShift === 'Individual') {
                    console.log("inside the indidual shift");
                    console.log("plannedCompletionTimeFunction inside the individual", plannedCompletionTimeFunction);
                    const { employeeId } = plannedCompletionTimeFunction;
                    console.log("employeeId", employeeId);
                    const employees = currentStep.who.employees;
                    finalEmployee = employees.find(emp => emp.employeeId === employeeId);
                    finalPlannedDate = plannedCompletionTimeFunction.plannedCompletionTimeIST;
                } else {
                    console.log("inside the all shift");
                    finalEmployee = currentStep.who.employees[0];
                    finalPlannedDate = plannedCompletionTimeFunction;
                }


                const currentDate = moment().tz('Asia/Kolkata').format();
                // Inserting data into the collection
                const result = await collection.insertOne({
                    fmsTaskId,
                    fmsQAId,
                    //fmsQACreatedBy: { userID: userID, userEmail: userEmail, userName: userName },
                    fmsMasterId: fmsMasterDocument.fmsMasterId,
                    fmsName: fmsMasterDocument.fmsName,
                    //fmsQA: req.body.fmsQA,
                    fmsTaskDoer: finalEmployee,
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
                    fmsTaskPlannedCompletionTime: finalPlannedDate,
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

async function createTxSteps( companyUrl, fmsMasterDocument, fmsSteps, fmsQAId, allTxSteps, fmsQA  ) {
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

            employee = fmsMasterDocument.fmsSteps[i].who.employees[0];   //who
            processId = fmsMasterDocument.fmsProcess
            plannedDate = fmsMasterDocument.fmsSteps[i].plannedDate
            what = fmsMasterDocument.fmsSteps[i].what
            how = fmsMasterDocument.fmsSteps[i].how
            stepId = fmsMasterDocument.fmsSteps[i].id
            nextTask = fmsMasterDocument.fmsSteps[i].next
            stepType = fmsMasterDocument.fmsSteps[i].stepType   //DOER OR QUALITY
            duration = fmsMasterDocument.fmsSteps[i].plannedDate.duration
            durationType = fmsMasterDocument.fmsSteps[i].plannedDate.durationType
            //fetch working only when durationType is hrs else set it to null
            if (durationType == "hrs") {
                working = fmsMasterDocument.fmsSteps[i].plannedDate.working
            } else {
                working = null
            }
            isWhatsAppEnabled = fmsMasterDocument.fmsSteps[i].isWhatsAppEnabled
            whatsappData = fmsMasterDocument.fmsSteps[i].whatsappData
            endStep = fmsMasterDocument.fmsSteps[i].endStep
            startTimeType = fmsMasterDocument.fmsSteps[i].startTimeType
            //fmsSteps = document.fmsSteps

            // for TAT in days and T-X funtionality
            endTime = fmsMasterDocument.fmsSteps[i].plannedDate.endTime
            type = fmsMasterDocument.fmsSteps[i].plannedDate.type
        } else {
            //WE SHOULD NOT CREATE THE NEXT TASK AS THIS IS THE LAST STEP IN THE FMS
            isNotLastTask = false
            console.log('THIS IS THE LAST STEP')
            updateAndCountDocuments(companyUrl, fmsQAId, req.body.fmsMasterId);
        }

        // fetch type of shift
        let typeOfShift = fmsMasterDocument.fmsSteps[i].who.typeOfShift;
        console.log("TypeOfShift in t-x", typeOfShift);

        // fetch list of employee based on the type of shift
        let employeeList;
        if (typeOfShift === 'Individual') {
            console.log("for t-x individual box");
            employeeList = fmsMasterDocument.fmsSteps[i].who.employees;
            console.log("employeelist for individual" ,employeeList );
        } else {
            console.log("for t-x all shift box");
            employeeList = fmsMasterDocument.fmsSteps[i].who.employees[0];
            console.log("employeelist for all shift" , employeeList );
        }



        //try catch block to create next Task
        // create next task only if it is not the last step in the FMS
        let plannedCompletionTime;
        let plannedCompletionTimeIST
        console.log('Creating the next task if ', isNotLastTask)
        if (isNotLastTask) {
            // Check if the stepId matches any step_id in the externalUsers array

            // whatsapp configuration section as of now commented
        //////////////////////////////////////////////////////////////////////////////////////////////////////////////////
            // const externalUserForStep = req.body.externalUsers.filter(user => user.step_id === stepId) || [];
            // const externalUsers = externalUserForStep.length > 0 ? externalUserForStep : [];
            /////////////////////////////////////creating the task for the user in fmsTasks collection
            ////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
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


                //Calculate Fms Planned Completion Time
                plannedCompletionTimeIST = await calculateFmsPlannedCompletionTime(companyUrl, duration, durationType, working, endTime, type, fmsQA[0].answer, CurrentIST(), plannedCompletionTime, plannedCompletionTimeIST ,  employeeList , typeOfShift);
                console.log("plannedCompletionTimeIST t-x after calculation n all" , plannedCompletionTimeIST);

                let finalEmployee;
                let finalPlannedDate;
                if (typeOfShift === 'Individual') {
                    console.log("inside the indidual shift");
                    console.log("plannedCompletionTimeFunction inside the individual", plannedCompletionTimeIST);
                    const { employeeId } = plannedCompletionTimeIST;
                    console.log("employeeId", employeeId);
                    const employees = fmsMasterDocument.fmsSteps[i].who.employees;;
                    finalEmployee = employees.find(emp => emp.employeeId === employeeId);
                    finalPlannedDate = plannedCompletionTimeIST.plannedCompletionTimeIST;
                } else {
                    console.log("inside the all shift");
                    finalEmployee = fmsMasterDocument.fmsSteps[i].who.employees[0];
                    finalPlannedDate = plannedCompletionTimeIST;
                }

                
                const currentDate = moment().tz('Asia/Kolkata').format();
                // Inserting data into the collection
                const result = await collection.insertOne({
                    fmsTaskId,
                    fmsQAId,
                    //fmsQACreatedBy: { userID: userID, userEmail: userEmail, userName: userName },
                    fmsMasterId: fmsMasterDocument.fmsMasterId,
                    fmsName: fmsMasterDocument.fmsName,
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
                    //fmsTaskPlannedCompletionTime: null,
                    formStepsAnswers: null,
                    fmsTaskQualityDetails: null,
                    isTransferredFrom: false,    //is this task transferred FROM other Task
                    isTranferredTo: false,       //is this task transferred TO other Task
                    transferredFromTaskId: null,
                    transferredToTaskId: null,
                    isWhatsAppEnabled: isWhatsAppEnabled,
                    whatsappData: whatsappData,
                    // externalUsers: externalUsers,
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


module.exports = submitFmsQuestionare;
