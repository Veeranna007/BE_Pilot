//All these functionas are not working -- validate and the delete it
const moment = require('moment-timezone');

function CurrentIST() {
    const currentDate = moment().tz('Asia/Kolkata').format();
    return currentDate
}

function addHrs(duration, taskStartTime) {
    console.log("inside the add hours" , duration , taskStartTime);
    const currentDate1 =  moment.tz(taskStartTime, 'Asia/Kolkata').add(duration, 'hours').toDate();
    console.log("currentDate1" , currentDate1);
    const currentDate = moment(taskStartTime).tz('Asia/Kolkata').add(hoursToAdd, 'hours').format();
    console.log("currentDate" , currentDate);
    return currentDate;
}

function addDays(inputDate , daysToAdd) {
    const currentDate = moment().tz('Asia/Kolkata').add(daysToAdd, 'days').format();
    return currentDate;
}

function addDaystoADate(inputDate , daysToAdd) {
    const currentDate = moment().tz('Asia/Kolkata').add(daysToAdd, 'days').format();
    return currentDate;
}

function addDaysToADate(inputDate, daysToAdd) {
    // Convert inputDate to a moment object
    let date = moment(inputDate);
    
    // Add days to the date
    date.add(daysToAdd, 'days');
    
    // Format the date and set the timezone
    const currentDate = date.tz('Asia/Kolkata').format();
    
    return currentDate;
}
// Example usage
console.log(addDaysToADate('2024-05-16', 5));


function getCurrentDateInIST(inputTime) {
    let currentTime = moment().tz("Asia/Kolkata"); // Get the current time in IST

    let adjustedTime = currentTime.clone()
       .hour(moment(inputTime, "HH:mm:ss").hour())
       .minute(moment(inputTime, "HH:mm:ss").minute())
       .second(moment(inputTime, "HH:mm:ss").second()); // Include seconds if present

    // Format the adjusted time as desired
    let formattedDate = adjustedTime.format();
    return formattedDate;
}

function formatDateFromDateObjectToString(dateObject) {
    // Extract the year, month, and day
    var year = dateObject.getFullYear();
    var month = ("0" + (dateObject.getMonth() + 1)).slice(-2); // Months are zero-based
    var day = ("0" + dateObject.getDate()).slice(-2);

    // Return the formatted date string
    return year + '-' + month + '-' + day;
}

  


  module.exports = { CurrentIST, addHrs, addDays, addDaysToADate ,formatDateFromDateObjectToString,  getCurrentDateInIST };