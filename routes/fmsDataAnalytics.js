const express = require("express");
const fmsdataanalytics = express.Router();
var MongoClient = require("mongodb").MongoClient;
const axios = require("axios");
const { log } = require("winston");
const moment = require("moment")
const { infoLogger, errorLogger } = require("../middleware/logger");


// fms performance calculation api
fmsdataanalytics.post("/fmsdataanalytics", async (req, res) => {
    const { companyUrl, userID } = req.body;
    try {

        // Connect to MongoDB and perform operations
        console.log("this function is calling from postgress");
        console.log("co", companyUrl);
        const client = await MongoClient.connect(process.env.MONGO_DB_STRING);
        console.log("Connected to database");
        const db = client.db(companyUrl);
        const collection = db.collection("fmsTasks");
        infoLogger.log("info", `company:${companyUrl} hit the api fmsdataanalytics`)


        // Query to find documents where fmsTaskDoer.employeeId matches userID
        const query = { "fmsTaskDoer.employeeId": userID };
        // console.log("Query", query);

        const taskDocuments = await collection.find(query).toArray();
        console.log("Task documents", taskDocuments);

        
        const instancecompanyStartingDayWeekResponse = axios.create({ httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }) });
        const companyStartingDayWeekResponse = await instancecompanyStartingDayWeekResponse.post(
          process.env.MAIN_BE_STARTDAY_WEEK_URL_PERFORMANCE,
          {
            verify_company_url: companyUrl
          }
        );
 

        const responseResults = companyStartingDayWeekResponse.data.result;
        //   console.log(responseResults);

        const currentDateTimeFinalString = moment().utc().format('YYYY-MM-DD');
        //   console.log("currentDateTimeFinalString", currentDateTimeFinalString);

        // Find the current week
        const currentWeek = responseResults.find(week => {
            const startDate = moment(week.weekStartingDate).utc();
            const endDate = startDate.clone().add(6, 'days'); // Assuming week ends 6 days after it starts
            return moment(currentDateTimeFinalString).isBetween(startDate, endDate, null, '[]');
        });

        // console.log("Current Week", currentWeek);

        // Calculate the previous week's start date
        const previousWeekStartDate = moment(currentWeek.weekStartingDate).subtract(7, 'days').format('YYYY-MM-DD');

        // Find the previous week
        const previousWeek = responseResults.find(week => {
            return week.weekStartingDate === previousWeekStartDate;
        });

        const { weekStartingDate, weekNo } = previousWeek;

        // console.log("Fetched Week Starting Date:", weekStartingDate);

        // after finding start date of the week - calculating a dateRange by adding 6 days
        const startOfWeek = new Date(weekStartingDate);
        startOfWeek.setUTCHours(0, 0, 0, 0);
        const endOfWeek = new Date(startOfWeek);
        endOfWeek.setDate(endOfWeek.getDate() + 6);
        endOfWeek.setUTCHours(23, 59, 59, 999);


        //  console.log("starting date of the week", startOfWeek);
        //  console.log("end of the week", endOfWeek);


        // Query to find documents within the date range and employeeId
        const dateRangeQuery = {
            "fmsTaskDoer.employeeId": userID,
            "fmsTaskPlannedCompletionTime": {
                $gte: startOfWeek.toISOString(),
                $lte: endOfWeek.toISOString()
            }
        };

        // console.log("Date range query", dateRangeQuery);

        const tasksInWeek = await collection.find(dateRangeQuery).toArray();
        //  console.log("Tasks in week", tasksInWeek);

        const totalTask = tasksInWeek.filter(task => !task.isTransferredFrom).length;
        const completedTasks = tasksInWeek.filter(task => task.fmsTaskStatus === 'COMPLETED' && !task.istransferredFrom).length;
        const pendingTasks = tasksInWeek.filter(task => task.fmsTaskStatus === 'PENDING' && !task.istransferredFrom).length;
        const overdueTasks = tasksInWeek.filter(task => task.fmsTaskStatus === 'OVERDUE' && !task.istransferredFrom).length;
        const onTimeTasks = tasksInWeek.filter(task => task.fmsTaskCompletedStatus === 'ONTIME' && !task.istransferredFrom).length;
        const delayedTasks = tasksInWeek.filter(task => task.fmsTaskCompletedStatus === 'DELAY' && !task.istransferredFrom).length;

        // Calculate the total task count for the doer within the date range
        const TotalTask = totalTask;
        const TotalCompletedTask = completedTasks;
        const TotalpendingTasks = pendingTasks;
        const TotaloverdueTasks = overdueTasks;
        const TotalonTimeTasks = onTimeTasks;
        const TotaldelayedTasks = delayedTasks;

        // console.log("TotalTask", TotalTask);
        // console.log("TotalCompletedTask", TotalCompletedTask);
        // console.log("TotalpendingTasks", TotalpendingTasks);
        // console.log("TotaloverdueTasks", TotaloverdueTasks);
        // console.log("TotalonTimeTasks", TotalonTimeTasks);
        // console.log("TotaldelayedTasks", TotaldelayedTasks);
        infoLogger.log("info", `company:${companyUrl} successfully fetch the data analaytics:
                      week_no: ${weekNo},
            TotalTask: ${TotalTask},
            TotalCompletedTask:${ TotalCompletedTask},
            TotalpendingTasks:${ TotalpendingTasks},
            TotaloverdueTasks:${ TotaloverdueTasks},
            TotalonTimeTasks: ${TotalonTimeTasks},
            TotaldelayedTasks: ${TotaldelayedTasks}`);

        res.json({
            message: "Tasks fetched successfully",
            week_no: weekNo,
            TotalTask: TotalTask,
            TotalCompletedTask: TotalCompletedTask,
            TotalpendingTasks: TotalpendingTasks,
            TotaloverdueTasks: TotaloverdueTasks,
            TotalonTimeTasks: TotalonTimeTasks,
            TotaldelayedTasks: TotaldelayedTasks,
            status: 200
        });


    } catch (error) {
        console.error("Error Connecting to MongoDB", error);
        errorLogger.log("error", `company:${companyUrl} failed to fetch data analytics due to ${error.message}`);
       return res.status(500).send({ error: "Error transferring task", status: 500 });
    }
});

module.exports = fmsdataanalytics;
