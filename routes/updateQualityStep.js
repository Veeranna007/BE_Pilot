////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
///////////////////////////////////NOT USED/////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


const express = require("express");
const updateQualitySteps = express.Router();
//var MongoClient = require('mongodb').MongoClient;
const { MongoClient, ObjectId } = require('mongodb');
const axios = require('axios');
const { CurrentIST } = require('../helpers/convertGMTtoIST');
const { Console } = require("winston/lib/winston/transports");
const moment = require('moment-timezone');
const { fetchUserDetails } = require("../helpers/fetchuserDetails");

// updateQualitySteps.post("/updateQualitySteps", async (req, res) => {

//  // Initialize variables to hold user details
//  let userName = "";
//  let userID = "";
//  let companyUrl = "";
//  let userEmail = "";

//  console.log(req.headers.authorization);
//  const authHeader = req.headers.authorization;
//  if (!authHeader || !authHeader.startsWith("Bearer")) {
//    console.log("error: Authorization header missing or malformed");
//    return res.status(401).json({ error: "Unauthorized" });
//  }
//  const token = authHeader.split(" ")[1];

//  console.log("token fetched is ", token);

//  try {
//    // Fetch user details and company details based on the token
//    const response = await axios.post(process.env.MAIN_BE_URL, {
//      token: token,
//    });
//    console.log("Fetched User Details and Company Details", response.data);
//    userName = response.data.emp_name;
//    userID = response.data.user_id;
//    companyUrl = response.data.verify_company_url;
//    userEmail = response.data.email_id;
//  } catch (error) {
//    console.error("Error posting data:", error);
//    res
//      .status(500)
//      .send({error: "Error fetching user details", status: 500 });
//    return;
//  }

//  try {
//    // Connect to MongoDB and perform operations
//    const client = await MongoClient.connect(process.env.MONGO_DB_STRING);
//    console.log("Connected to database");
//    const db = client.db(companyUrl);
//    const collection = db.collection("fmsTasks");

//    const { value , qualityScore , stepsToRedone , scrap , status } = req.body;

//     // to find document
//     const query = { value , qualityScore , stepsToRedone , scrap , status };

//     console.log("value" ,query.value);
//     console.log("qualityScore" , query.qualityScore);
//     console.log("stepsToRedone" , query.stepsToRedone);
//     console.log("scrap" , query.scrap);
//     console.log("status" , query.status);

//     // const taskDocuments = await collection.find(query).toArray();


//    res.json({ 
//    message: "updated quality step successfully", 
//    status: 200 
//  });

//  } catch (error) {
//    console.error("Error Connecting to MongoDB", error);
//     res.status(500).send({ error: "Failed to fetch performance calculation", status: 500 });
//  }
// });

updateQualitySteps.post('/updateQualitySteps', async (req, res) => {
    console.log("INSIDE UPDATE Quality FMS TASK -----------------------------------------------------------")
    console.log("INSIDE UPDATE Quality FMS TASK -----------------------------------------------------------")
    console.log("INSIDE UPDATE Quality FMS TASK -----------------------------------------------------------")
    console.log('REQUEST BODY', req.body)


    // Initialize variables to hold user details
    let userDetails = await fetchUserDetails(req.headers.authorization);
    let userName = userDetails.userName;
    let userID = userDetails.userID;
    let companyUrl = userDetails.companyUrl;
    let userEmail = userDetails.userEmail;

    console.log('UPDATING THE TASK')
    await updateTaskStatus(companyUrl, req.body.fmsTaskId, req.body.formStepsAnswers, req.body.fmsTaskQualityDetails);


    //CREATE THE NEXT TASK ONLY IF req.body.fmsTaskQualityDetails.qualityStatus == Yes -- Else chek for other details
    if (req.body.fmsTaskQualityDetails.qualityStatus === "Yes") {
        console.log('Creating Next Task as the Quality Status is "Yes"')

        //try block to fetch the details required to create the next task
        let shouldcreateNextTask;
        let nextTask;
        let employee;
        let processId;
        let plannedDate;
        let what;
        let how;
        let stepId;
        let stepType;  //EITHER ITS DOER OR QULAITY
        let duration;
        let durationType;  //either hrs or days
        let working;        //this is only for hrs --> values can only be "INSIDE" or "OUTSIDE"
        let isWhatsAppEnabled;
        let whatsappData;
        let fmsSteps;

        try {
            // Connect to MongoDB and perform operations
            const client = await MongoClient.connect(process.env.MONGO_DB_STRING);
            console.log('Connected to database to fetch next task info');
            console.log('companyUrl', companyUrl)
            const db = client.db(companyUrl);
            const collection = db.collection('fmsMaster');

            const cursor = collection.find({ fmsName: req.body.fmsName });
            const documents = await cursor.toArray();

            // Extract the first document
            const document = documents[0];
            console.log(document)

            // Find the first object in the "who" array where "typeOfShift" is "All"
            const whoObject = document.fmsSteps.find(step => step.who.typeOfShift === 'All');

            // Check if the "who" object was found
            if (!whoObject) {
                console.log('No "who" object found with typeOfShift "All".');
                return;
            }

            console.log('stepId IS ', req.body.stepId)
            console.log('no of steps in that fms', document.fmsSteps.length)
            if (req.body.stepId < document.fmsSteps.length) {
                // WE SHOULD CREATE THE NEXT TASK AS THIS IS NOT THE LAST STEP IN THE FMS
                console.log('THERE ARE OTHER STEPS')
                shouldcreateNextTask = true
                console.log('Next task is ', document.fmsSteps[req.body.stepId])

                nextTask = document.fmsSteps[req.body.stepId]
                employee = document.fmsSteps[req.body.stepId].who.employees[0];
                processId = document.fmsProcess
                plannedDate = document.fmsSteps[req.body.stepId].plannedDate
                what = document.fmsSteps[req.body.stepId].what
                how = document.fmsSteps[req.body.stepId].how
                stepId = document.fmsSteps[req.body.stepId].id
                stepType = document.fmsSteps[req.body.stepId].stepType
                duration = document.fmsSteps[req.body.stepId].plannedDate.duration
                durationType = document.fmsSteps[0].plannedDate.durationType
                //fetch working only when durationType is hrs else set it to null
                if (durationType == "hrs") {
                    working = document.fmsSteps[0].plannedDate.working
                } else {
                    working = null
                }
                isWhatsAppEnabled = document.fmsSteps[0].isWhatsAppEnabled
                whatsappData = document.fmsSteps[0].whatsappData
                fmsSteps = document.fmsSteps[0]
            } else {
                //WE SHOULD NOT CREATE THE NEXT TASK AS THIS IS THE LAST STEP IN THE FMS
                shouldcreateNextTask = false
                console.log('THIS IS THE LAST STEP')
                updateAndCountDocuments(companyUrl, req.body.fmsQAId, req.body.fmsMasterId);
            }
            // Close the MongoDB connection
            await client.close();
            console.log('MongoDB connection closed');

        } catch (error) {
            console.error('Error posting data:', error);
            return res.status(500).json({ error: error.message });
        }

        //////////////////////////////////////////--- CREATING THE NEXT TASK
        //try catch block to create next Task
        // create nex ttask only if it is not the last step in the FMS
        console.log('Creating the next task if ', shouldcreateNextTask)
        if (shouldcreateNextTask) {
            let plannedCompletionTime;
            let plannedCompletionTimeIST
            try {

                //calculation of fmsTaskPlannedCompletionTime (start time - form submitted time, and tat in hrs or days)

                // Connect to MongoDB and perform operations
                const client = await MongoClient.connect(process.env.MONGO_DB_STRING);
                console.log('Connected to database to create the next task');
                const db = client.db(companyUrl);
                const collection = db.collection('fmsTasks');

                // Find the last inserted document and get its incremental value
                const lastDocument = await collection.find().sort({ _id: -1 }).limit(1).toArray();
                let fmsTaskId = 1;

                if (lastDocument.length > 0) {
                    fmsTaskId = lastDocument[0].fmsTaskId + 1;
                }

                //Calculate Fms Planned Completion Time
                if (durationType == "hrs") {
                    if (working == "OUTSIDE") {
                        plannedCompletionTime = addHrs(CurrentIST(), duration);
                        plannedCompletionTimeIST = plannedCompletionTime;
                    } else {
                        try {
 
                            const instanceWorkingShift = axios.create({ httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }) });
                            const response = await instanceWorkingShift.post(
                                process.env.MAIN_BE_WORKING_SHIFT_URL,
                                {
                                    verify_company_url: companyUrl
                                }
                            );


                           //  const response = await axios.post(process.env.MAIN_BE_WORKING_SHIFT_URL, { verify_company_url: companyUrl });

                            let shiftStartTimeStr = response.data.result[0].shiftStartTime;
                            let shiftEndTimeStr = response.data.result[0].shiftEndTime;

                            let shiftStartTime = new Date(moment.tz(shiftStartTimeStr, 'Asia/Kolkata').format());
                            let shiftEndTime = new Date(moment.tz(shiftEndTimeStr, 'Asia/Kolkata').format());

                            shiftStartTime.setHours(shiftStartTime.getHours() + 5);
                            shiftStartTime.setMinutes(shiftStartTime.getMinutes() + 30);

                            shiftEndTime.setHours(shiftEndTime.getHours() + 5);
                            shiftEndTime.setMinutes(shiftEndTime.getMinutes() + 30);

                            const currentDateTimeFinalString = moment().tz('Asia/Kolkata').format();
                            const currentDateTimeFinal = moment.tz(currentDateTimeFinalString, 'Asia/Kolkata').add(duration, 'hours').toDate();
                            currentDateTimeFinal.setHours(currentDateTimeFinal.getHours() + 5);
                            currentDateTimeFinal.setMinutes(currentDateTimeFinal.getMinutes() + 30);

                            console.log('Initial plannedCompletionTime:', currentDateTimeFinal);

                            const plannedTimeDate = currentDateTimeFinal;
                            const shiftEndTimeDate = new Date(shiftEndTime);

                            function calculateBalanceHours(plannedCompletionTime, shiftEndTime) {
                                if (plannedCompletionTime > shiftEndTime) {
                                    let diffMillis = plannedCompletionTime.getTime() - shiftEndTime.getTime();
                                    let hours = Math.floor(diffMillis / (1000 * 60 * 60));
                                    let minutes = Math.floor((diffMillis % (1000 * 60 * 60)) / (1000 * 60));
                                    let seconds = Math.floor(((diffMillis % (1000 * 60 * 60)) % (1000 * 60)) / 1000);

                                    let overflowforThatDayIs = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;

                                    const nextDayStartTime = new Date(shiftStartTime);

                                    let nextDayCompletionTime = plannedCompletionTime;

                                    nextDayCompletionTime.setHours(nextDayStartTime.getHours());
                                    nextDayCompletionTime.setMinutes(nextDayStartTime.getMinutes());
                                    nextDayCompletionTime.setSeconds(nextDayStartTime.getSeconds());
                                    nextDayCompletionTime.setDate(plannedCompletionTime.getDate() + 1);

                                    nextDayCompletionTime.setHours(nextDayCompletionTime.getHours() + hours);
                                    nextDayCompletionTime.setMinutes(nextDayCompletionTime.getMinutes() + minutes);
                                    nextDayCompletionTime.setSeconds(nextDayCompletionTime.getSeconds() + seconds);

                                    ///////////////////////////////////////////////////

                                    // plannedCompletionTime.setHours(nextDayStartTime.getHours() + hours);
                                    // plannedCompletionTime.setMinutes(nextDayStartTime.getMinutes() + minutes);
                                    // plannedCompletionTime.setSeconds(nextDayStartTime.getSeconds() + seconds);

                                    console.log('Final planned completion time (before adding offset):', nextDayCompletionTime);

                                    // plannedCompletionTime.setDate(plannedCompletionTime.getDate() + 1);

                                    plannedCompletionTimeIST = moment(nextDayCompletionTime).tz('Asia/Kolkata');

                                    // Subtract 5 hours and 30 minutes from plannedCompletionTimeIST
                                    plannedCompletionTimeIST = plannedCompletionTimeIST.subtract(5, 'hours').subtract(30, 'minutes').format();

                                    console.log('Final planned completion time (IST - 05:30):', plannedCompletionTimeIST);


                                    return plannedCompletionTimeIST;
                                } else if (plannedCompletionTime < shiftEndTime) {
                                    console.log("plannedTimeDate check here", plannedCompletionTime);
                                    plannedCompletionTimeIST = plannedCompletionTime;
                                    plannedCompletionTimeIST = moment(plannedCompletionTimeIST).tz('Asia/Kolkata');
                                    plannedCompletionTimeIST = plannedCompletionTimeIST.subtract(5, 'hours').subtract(30, 'minutes').format();
                                    console.log("plannedComplotiontimeIST check here", plannedCompletionTimeIST);
                                    return plannedCompletionTimeIST;
                                }
                            }

                            let balanceTime = calculateBalanceHours(plannedTimeDate, shiftEndTimeDate);
                            console.log('Balance time:', balanceTime);


                            if (plannedTimeDate > shiftEndTime) {
                                // Perform holiday validation only if planned completion time exceeds shift end time
                                plannedCompletionTimeIST = await validateHolidayforHRS(plannedCompletionTimeIST);
                                console.log('Planned completion time after holiday validation:', plannedCompletionTimeIST);
                            }

                            // plannedCompletionTimeIST = await validateHolidayforHRS(plannedCompletionTimeIST);

                            // Here you can handle the case when balanceTime is not 0, if needed

                            plannedCompletionTime = plannedTimeDate;
                        } catch (error) {
                            console.error('Error fetching working shift details:', error);
                            res.status(500).send({ message: 'Error fetching working shift details', status: 500 });
                            return;
                        }
                    }
                } else {

                    const currentDateTimeFinalString = moment().tz('Asia/Kolkata').format();
                    console.log("first step", currentDateTimeFinalString);
                    const currentDateTimeFinal = moment.tz(currentDateTimeFinalString, 'Asia/Kolkata').toDate();

                    console.log("currenDae", currentDateTimeFinal);
                    currentDateTimeFinal.setHours(currentDateTimeFinal.getHours() + 5);
                    currentDateTimeFinal.setMinutes(currentDateTimeFinal.getMinutes() + 30);

                    console.log("date check", currentDateTimeFinal);
                    plannedCompletionTime = currentDateTimeFinal;
                    console.log("plannedCompletionTiem for days", plannedCompletionTime);
                    plannedCompletionTime = await validateHoliday(plannedCompletionTime, duration);
                    plannedCompletionTimeIST = plannedCompletionTime;
                }

                console.log("Final Planned Completion Time:", plannedCompletionTimeIST);



                async function validateHolidayforHRS(plannedCompletionTime) {
                    try {
                        console.log("inside get next working day, holiday validation input is ", plannedCompletionTime)
                        console.log("plannedCompletionTime", typeof plannedCompletionTime)

                        // Split the string using "T" as the separator
                        let parts = plannedCompletionTime.split("T");
                        let inputDateString = parts[0].trim();
                        let inputTimeString = parts[1].trim();

                        console.log("inputDateString", inputDateString)
                        console.log("inputTimeString", inputTimeString)


                        // Fetching non-working days from the backend for UAT
                        const instanceNonWorkingDay = axios.create({ httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }) });
                        const responseHoliday = await instanceNonWorkingDay.post(
                            process.env.MAIN_BE_HOLIDAY_NONWORKINGDAY_URL,
                            {
                               verify_company_url: companyUrl
                            }
                        );

                        
                        // Fetching non-working days from the backend
                       // const responseHoliday = await axios.post(process.env.MAIN_BE_HOLIDAY_NONWORKINGDAY_URL, { verify_company_url: companyUrl });//output like this  -> responseHoliday = ['2024-01-07', '2024-01-14']


                        // const datesArrayAsObjects1 = responseHoliday.data.map(dateString => new Date(dateString));

                        const datesArrayAsObjects = responseHoliday.data.map(dateString => {
                            let utcDate = new Date(dateString);
                            utcDate.setDate(utcDate.getDate() + 1); // Add one day
                            let istDate = moment(utcDate).tz('Asia/Kolkata').toDate(); // Convert to IST
                            return istDate;
                        });

                        //console.log('responseHoliday.data', responseHoliday.data)        //output like this  -> responseHoliday.data = [2024-01-07T00:00:00.000Z, 2024-01-14T00:00:00.000Z]

                        // Function to group consecutive dates into arrays
                        function groupConsecutiveDates(dates) {
                            dates.sort((a, b) => a - b); // Sort the dates in ascending order
                            const result = [];
                            let tempArray = [dates[0]];

                            for (let i = 1; i < dates.length; i++) {
                                const diff = (dates[i] - dates[i - 1]) / (1000 * 60 * 60 * 24);
                                if (diff === 1) {
                                    tempArray.push(dates[i]);
                                } else {
                                    result.push(tempArray);
                                    tempArray = [dates[i]];
                                }
                            }
                            result.push(tempArray);
                            return result;
                        }

                        // console.log("datesArrayAsObjects", datesArrayAsObjects);

                        console.log("datesArrayAsObjects1", datesArrayAsObjects);
                        const consecutiveArrays = groupConsecutiveDates(datesArrayAsObjects);
                        //console.log("consecutiveArrays" , consecutiveArrays)

                        console.log("consecutive", consecutiveArrays);

                        //const inputDate = new Date("2024-05-18");
                        const inputDate = new Date(inputDateString.trim());
                        // Function to check if a date falls within a given range of dates
                        function isDateInRange(date, startDate, endDate) {
                            //console.log('checking if the inputdate is a holiday')
                            console.log(date >= startDate && date <= endDate)
                            return date >= startDate && date <= endDate;
                        }

                        let belongsToElement = -1; // Default value if the input date doesn't belong to any array

                        for (let i = 0; i < consecutiveArrays.length; i++) {
                            const dateArray = consecutiveArrays[i];
                            const startDate = dateArray[0];
                            const endDate = dateArray[dateArray.length - 1];

                            if (isDateInRange(inputDate, startDate, endDate)) {
                                belongsToElement = i;
                                break;
                            }
                        }

                        console.log('inputDate', inputDate, belongsToElement, 'element ', 'which is a holiday')

                        if (belongsToElement >= 0) {
                            console.log("Input date belongs to element:", belongsToElement);
                            let dateBelongsTo = consecutiveArrays[belongsToElement]


                            console.log(dateBelongsTo)
                            //next working date is 
                            let lastElementinTheArray = dateBelongsTo[dateBelongsTo.length - 1]
                            console.log(lastElementinTheArray)

                            //next working date is 
                            //let nextWorkingDay = new Date(lastElementinTheArray.setDate(lastElementinTheArray.getDate() + 1));
                            let nextWorkingDay = new Date(lastElementinTheArray.getTime());
                            nextWorkingDay.setDate(nextWorkingDay.getDate() + 1);
                            let nextWorkingDayString = formatDateFromDateObjectToString(nextWorkingDay)
                            console.log("nextWorkingDayString", nextWorkingDayString)


                            let finalNextWorkingDay = nextWorkingDayString + "T" + inputTimeString;
                            console.log("finalNextWorkingDay", finalNextWorkingDay)

                            //split to remove timeZone

                            var finalNextWorkingDaydateObject = new Date(finalNextWorkingDay);
                            console.log(finalNextWorkingDaydateObject);


                            // Convert the Date object to IST using Moment Timezone
                            var istfinalNextWorkingDaydateObject = moment.tz(finalNextWorkingDaydateObject, 'Asia/Kolkata');
                            // Format the IST date as needed
                            var formattedIstDate = istfinalNextWorkingDaydateObject.format();
                            console.log("formattedIstDate", formattedIstDate);

                            return formattedIstDate;
                        } else {
                            return plannedCompletionTime
                        }

                    } catch (error) {
                        console.error("Failed to fetch holidays:", error);
                        return null; // Return null or handle the error appropriately
                    }
                }

                async function validateHoliday(plannedCompletionTime, duration) {
                    try {
                        console.log("inside get next working day, holiday validation input is ", plannedCompletionTime);
                        console.log("plannedCompletionTime", typeof plannedCompletionTime);

                        let inputDateString, inputTimeString;

                        if (typeof plannedCompletionTime === 'string') {
                            // Split the string using "T" as the separator
                            let parts = plannedCompletionTime.split("T");
                            inputDateString = parts[0].trim();
                            inputTimeString = parts[1].trim();
                        } else if (plannedCompletionTime instanceof Date) {
                            inputDateString = plannedCompletionTime.toISOString().split("T")[0];
                            inputTimeString = plannedCompletionTime.toISOString().split("T")[1];
                        } else {
                            throw new Error("Invalid plannedCompletionTime format");
                        }

                        console.log("inputDateString", inputDateString);
                        console.log("inputTimeString", inputTimeString);


                         // Fetching non-working days from the backend for UAT
                         const instanceNonWorkingDay = axios.create({ httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }) });
                         const responseHoliday = await instanceNonWorkingDay.post(
                             process.env.MAIN_BE_HOLIDAY_NONWORKINGDAY_URL,
                             {
                                verify_company_url: companyUrl
                             }
                         );

                        // Fetching non-working days from the backend
                        // const responseHoliday = await axios.post(process.env.MAIN_BE_HOLIDAY_NONWORKINGDAY_URL, { verify_company_url: companyUrl });
                        // Convert holiday dates to IST
                        const holidays = responseHoliday.data.map(dateString => {
                            let utcDate = new Date(dateString);
                            utcDate.setDate(utcDate.getDate() + 1); // Add one day
                            let istDate = moment(utcDate).tz('Asia/Kolkata').startOf('day').toDate(); // Convert to IST and normalize to start of the day
                            return istDate;
                        }).map(date => date.toISOString().split('T')[0]); // Keep only the date part

                        console.log("holidays in IST", holidays);

                        function isHoliday(date) {
                            let dateString = date.toISOString().split('T')[0]; // Keep only the date part
                            return holidays.includes(dateString);
                        }

                        let currentDate = new Date(inputDateString);

                        // Adjust initial planned completion time if it falls on a holiday
                        while (isHoliday(currentDate)) {
                            currentDate.setDate(currentDate.getDate() + 1);
                        }

                        let totalDaysAdded = 0;

                        // Adjust planned completion time to account for holidays
                        while (totalDaysAdded < duration) {
                            currentDate.setDate(currentDate.getDate() + 1);
                            if (!isHoliday(currentDate)) {
                                totalDaysAdded++;
                            }
                        }

                        let finalDate = new Date(currentDate.toISOString().split('T')[0] + "T" + inputTimeString);
                        let finalMoment = moment.tz(finalDate, 'Asia/Kolkata');
                        finalMoment = finalMoment.subtract(5, 'hours').subtract(30, 'minutes'); // Adjust to UTC if needed

                        let formattedFinalDate = finalMoment.format();

                        console.log("final planned completion date after holiday adjustment", formattedFinalDate);


                        console.log("final planned completion date after holiday adjustment", formattedFinalDate);

                        return formattedFinalDate;

                    } catch (error) {
                        console.error("Failed to fetch holidays:", error);
                        return null; // Return null or handle the error appropriately
                    }
                }

                const currentDate = moment().tz('Asia/Kolkata').format();
                // Inserting data into the collection
                const result = await collection.insertOne({
                    fmsTaskId,
                    fmsQAId: req.body.fmsQAId,
                    fmsMasterId: req.body.fmsMasterId,
                    fmsName: req.body.fmsName,
                    fmsQA: req.body.fmsQA,
                    formStepsQustions: req.body.formStepsQustions,
                    fmsTaskDoer: employee,
                    fmsTaskStatus: "PENDING",
                    fmsTaskCompletedStatus: "null",  //either ONTIME OR DELAYED
                    fmsProcessID: processId,
                    plannedDate: plannedDate,
                    what: what,
                    how: how,
                    stepId: stepId,
                    stepType: stepType,
                    fmsTaskCreatedTime: currentDate,
                    fmsTaskPlannedCompletionTime: plannedCompletionTimeIST,
                    formStepsAnswers: null,
                    fmsTaskQualityDetails: null,
                    fmsTaskTransferredFrom: null,
                    fmsTaskTransferredFrom: null,
                    isTransferredFrom: false,    //is this task transferred FROM other Doer
                    isTranferredTo: false,       //is this task transferred TO other Doer
                    transferredFromTaskId: null,
                    transferredToTaskId: null,
                    at: null
                });

                console.log(result);
                console.log('Created the Task');


                // Close the MongoDB connection
                await client.close();
                console.log('MongoDB connection closed');

            } catch (error) {
                console.error('Error posting data:', error);
                return res.status(500).json({ error: error.message });

            }

        }


    } else {
        //if Quality Status is No , we should not trigger the next task and update the previous tasks from COMPLETED TO PENDING
        console.log('Qaulity Status is No -- A few Steps or all steps haave to be redone')
        //IF SCRAP THE WHOLE PROCESS THEN - req.body.fmsQualityDetails.scrapStatus == true
        //To choose which steps to be redone then  - req.body.fmsQualityDetails.qualityRedoSteps -- (this is an array)


        if (req.body.fmsTaskQualityDetails.scrapStatus == true) {
            //// SCRAP THE WHOLE PROCESS  - FETCH ALL THE TASKS FOR THAT PROCESS AND MARK IT AS COMPLETED 
            //for the existing tasks keep the same status
            console.log('Scrap the whole Process')


        } else {
            console.log('Only a few Steps have to be redone')
            //do not scrap the whole FMS 
            //find the taskId based on fmsQAId and stepId - EDIT it to PENDING/OVERDUE

            //try catch block to fetch the tasks for that fms process 
            //this is the task that is selected from the front end -- check for planned end time current time , and based on that change the status to either PENDING  OR OVERDUE
            let updateTask;
            try {
                // Connect to MongoDB and perform operations
                const client = await MongoClient.connect(process.env.MONGO_DB_STRING);
                //console.log('Connected to database');
                const db = client.db(companyUrl);
                const collection = db.collection('fmsTasks');

                //console.log(req.body.fmsQAId, '----------------' , )
                //const cursor = collection.find({ fmsQAId : req.body.fmsQAId, stepId: req.body.stepId });
                updateTask = await collection.findOne({ fmsQAId: req.body.fmsQAId, stepId: req.body.fmsTaskQualityDetails.qualityRedoSteps[0] });
                //const documents = await cursor.toArray();

                //console.log(task)


                // Close the MongoDB connection
                await client.close();
                //console.log('MongoDB connection closed');
            }
            catch (error) {
                console.error('Error Connecting to MongoDB', error);
                return res.status(500).json({ error: error.message });
            }

            let updatedStatus;
            //compare the taskPlannedCompletionTime and current time and based on that set the Status
            const currentDate = moment().tz('Asia/Kolkata').format();
            if (updateTask.fmsTaskPlannedCompletionTime > currentDate) {
                console.log("updateTask.fmsTaskPlannedCompletionTime", updateTask.fmsTaskPlannedCompletionTime)
                console.log("currentDateTime", currentDate)
                updatedStatus = "PENDING"
            } else {
                console.log("updateTask.fmsTaskPlannedCompletionTime", updateTask.fmsTaskPlannedCompletionTime)
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
                //const cursor = collection.find({ fmsQAId : req.body.fmsQAId, stepId: req.body.stepId });
                const task = await collection.findOneAndUpdate(
                    { fmsQAId: req.body.fmsQAId, stepId: req.body.fmsTaskQualityDetails.qualityRedoSteps[0] },
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
        }
    }










    res.json({
        "message": `Quality Task Updated`,
        "status": 200
    });
})


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

            // Check if this is a quality step and update the score in previos task id
            // if (masterDocument.stepType === "QUALITY") {
            //     const previousTaskId = taskId - 1;
            //     await collection.updateOne(
            //         { fmsTaskId: previousTaskId },
            //         { $set: { fmsTaskQualityDetails: fmsTaskQualityDetails } }
            //     );
            //     console.log(`Updated quality details for task ${previousTaskId}`);
            // }


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





module.exports = updateQualitySteps;



// Good case scenario
/*
In this scenario we are updating two cases
Case no 1:- In Quality step we are updating the fmsTaskQualityDetails
Case no 2:- If the step is a quality step then update the fmsTaskQualityDetails in the previous step and create
the next task for next doer.
*/

//Scrap fms scenario
/*
If  scrapStatus: true for quality step the end the fms and dont hit the next step if existed.
*/
