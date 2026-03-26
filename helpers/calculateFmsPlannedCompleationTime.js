const express = require("express");
var MongoClient = require("mongodb").MongoClient;
const axios = require("axios");
//const moment = require('moment-timezone');
const { CurrentIST, addHrs, addDays, addDaysToADate, formatDateFromDateObjectToString, getCurrentDateInIST } = require("./convertGMTtoIST");
const moment = require("moment");
const { infoLogger, errorLogger } = require('../middleware/logger')

const calculateFmsPlannedCompletionTime = async (
  companyUrl,
  duration,
  durationType,
  working,
  endTime,
  type,
  answer,
  taskStartTime,
  plannedCompletionTime,
  plannedCompletionTimeIST,
  employeeList,
  typeOfShift
) => {
  try {
    console.log("employeeList", employeeList);
    console.log("typeOfShift" , typeOfShift);
    
    //Calculate Fms Planned Completion Time
    if (type == "TAThrs" && durationType == "hrs") {
      infoLogger.log("info", `Company: ${companyUrl} hits the function calculateFmsPlannedComplitionTime and selected type as ${type} and duration type as ${durationType}`);
      if (working == "OUTSIDE") {
        infoLogger.log("info", `Company: ${companyUrl} selected a ${working} working hour shift with a duration of ${duration}.`);
        console.log("Inside Planned Completion Time IST OUTSIDE working hrs");
        let currentDateTimeFinal = moment
          .tz(taskStartTime, "Asia/Kolkata")
          .add(duration, "hours");

        // Directly format the moment object to get the desired output
        //let plannedCompletionTime = currentDateTimeFinal.format('YYYY-MM-DDTHH:mm:ssZ');
        plannedCompletionTime = currentDateTimeFinal.format(
          "YYYY-MM-DDTHH:mm:ssZ"
        );
        infoLogger.log("info", `The planned completion date and time for FMS, based on user inputs from company: ${companyUrl}, was successfully calculated with a result of ${plannedCompletionTime} (excluding IST timezone).`);

        plannedCompletionTimeIST = plannedCompletionTime;
        let employeeId;
        if(typeOfShift === 'Individual'){
          employeeId = await fetchEmployeeShiftOnPlannedDate(companyUrl, plannedCompletionTimeIST, employeeList);
          return { plannedCompletionTimeIST, employeeId };
        }else{
          return plannedCompletionTimeIST ;
        }

      } else {
        infoLogger.log("info", `Company: ${companyUrl} hits the function calculateFmsPlannedComplitionTime and selected type as ${type} and duration type as ${durationType}`);
        try {
          infoLogger.log("info", `Company: ${companyUrl} selected a ${working} working hour shift with a duration of ${duration}.`);
          const currentDateTimeFinal = moment
            .tz(taskStartTime, "Asia/Kolkata")
            .add(duration, "hours")
            .toDate();
          console.log("currenDateTimeFinal", currentDateTimeFinal);
          currentDateTimeFinal.setHours(currentDateTimeFinal.getHours() + 5);
          currentDateTimeFinal.setMinutes(
            currentDateTimeFinal.getMinutes() + 30
          );

          console.log("after adding 5:30 hours", currentDateTimeFinal);
          console.log("Initial plannedCompletionTime:", currentDateTimeFinal);

          const plannedTimeDate = currentDateTimeFinal;

          const fetchShiftDate = new Date(plannedTimeDate);
          console.log("fetchShiftDate", fetchShiftDate);

          const instanceWorkingShift = axios.create({ httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }) });
          const response = await instanceWorkingShift.post(
            process.env.MAIN_BE_WORKING_SHIFT_URL_BY_DATE,
            {
              verify_company_url: companyUrl,
              date: fetchShiftDate
            }
          );
          infoLogger.log("info", `Company: ${companyUrl} successfully fetched working shift details based on the current date.`);

          let shiftStartTimeStr = response.data.result[0].shiftStartTime;
          let shiftEndTimeStr = response.data.result[0].shiftEndTime;

          let shiftStartTime = new Date(
            moment.tz(shiftStartTimeStr, "Asia/Kolkata").format()
          );
          let shiftEndTime = new Date(
            moment.tz(shiftEndTimeStr, "Asia/Kolkata").format()
          );

          shiftStartTime.setHours(shiftStartTime.getHours() + 5);
          shiftStartTime.setMinutes(shiftStartTime.getMinutes() + 30);

          console.log("shiftStartTime", shiftStartTime);
          console.log("shiftEndTime", shiftEndTime);

          shiftEndTime.setHours(shiftEndTime.getHours() + 5);
          shiftEndTime.setMinutes(shiftEndTime.getMinutes() + 30);

          console.log("shiftStart", shiftStartTimeStr);
          console.log("shiftEnd", shiftEndTimeStr);

          console.log("plannedDate Final Alteration", plannedTimeDate);
          const shiftEndTimeDate = new Date(shiftEndTime);
          console.log("shiftEndTimeDate", shiftEndTimeDate);

          infoLogger.log("info", `Company: ${companyUrl} successfully calculated the shift end date and time: ${shiftEndTimeDate}.`);

          function calculateBalanceHours(plannedCompletionTime, shiftEndTime) {
            if (plannedCompletionTime > shiftEndTime) {
              console.log(
                "plannedCompletionTime inside the function",
                plannedCompletionTime
              );
              let diffMillis =
                plannedCompletionTime.getTime() - shiftEndTime.getTime();
              let hours = Math.floor(diffMillis / (1000 * 60 * 60));
              let minutes = Math.floor(
                (diffMillis % (1000 * 60 * 60)) / (1000 * 60)
              );
              let seconds = Math.floor(
                ((diffMillis % (1000 * 60 * 60)) % (1000 * 60)) / 1000
              );

              let overflowForThatDayIs = `${hours
                .toString()
                .padStart(2, "0")}:${minutes
                  .toString()
                  .padStart(2, "0")}:${seconds.toString().padStart(2, "0")}`;
              console.log("overflowForThatDays", overflowForThatDayIs);
              let nextDayCompletionTime = new Date(shiftStartTime);

              console.log("nextDayCompletionTime", nextDayCompletionTime);

              // Check if the planned completion time exceeds the shift end time
              if (
                plannedCompletionTime.getDate() !== shiftEndTime.getDate() ||
                plannedCompletionTime > shiftEndTime
              ) {
                // Add only if the planned completion time exceeds the shift end time
                nextDayCompletionTime.setDate(
                  nextDayCompletionTime.getDate() + 1
                );
              }

              console.log(
                "nextDayCompletionTime after checking date:",
                nextDayCompletionTime
              );

              nextDayCompletionTime.setHours(
                nextDayCompletionTime.getHours() + hours
              );
              nextDayCompletionTime.setMinutes(
                nextDayCompletionTime.getMinutes() + minutes
              );
              nextDayCompletionTime.setSeconds(
                nextDayCompletionTime.getSeconds() + seconds
              );

              console.log(
                "Final planned completion time (before adding offset):",
                nextDayCompletionTime
              );

              plannedCompletionTimeIST = moment(nextDayCompletionTime)
                .tz("Asia/Kolkata")
                .subtract(5, "hours")
                .subtract(30, "minutes")
                .format();

              console.log(
                "Final planned completion time (IST - 05:30):",
                plannedCompletionTimeIST
              );

              return plannedCompletionTimeIST;
            } else if (plannedCompletionTime < shiftEndTime) {
              console.log("plannedTimeDate check here", plannedCompletionTime);
              plannedCompletionTimeIST = plannedCompletionTime;
              plannedCompletionTimeIST = moment(plannedCompletionTimeIST).tz(
                "Asia/Kolkata"
              );
              plannedCompletionTimeIST = plannedCompletionTimeIST
                .subtract(5, "hours")
                .subtract(30, "minutes")
                .format();
              console.log(
                "plannedCompletionTimeIST check here",
                plannedCompletionTimeIST
              );
              return plannedCompletionTimeIST;
            }
          }

          let balanceTime = calculateBalanceHours(
            plannedTimeDate,
            shiftEndTimeDate
          );
          console.log("Balance time:", balanceTime);

          if (
            (plannedTimeDate > shiftEndTime &&
              plannedTimeDate.getDate() !== shiftEndTimeDate.getDate()) ||
            plannedTimeDate.getTime() > shiftEndTimeDate.getTime()
          ) {
            // Perform holiday validation only if planned completion time exceeds shift end time
            plannedCompletionTimeIST = await validateHolidayforHRS(
              balanceTime,
              companyUrl
            );
            infoLogger.log("info", `Company: ${companyUrl} successfully calculated the planned completion date and time. After exceeding the shift end time and accounting for holidays, the planned date is ${plannedCompletionTimeIST}.`);
            console.log(
              "Planned completion time after holiday validation:",
              plannedCompletionTimeIST
            );
          } else {
            console.log(
              "unless the date is more it was not verifying the date",
              balanceTime
            );
            plannedCompletionTimeIST = balanceTime;
            infoLogger.log("info", `Company: ${companyUrl} successfully calculated the planned completion date and time , withput exceeding an shift end date and time the planned date is ${plannedCompletionTimeIST}.`);

          }

          console.log("plannedTimeDate", plannedCompletionTime);
          plannedCompletionTime = plannedTimeDate;
          plannedCompletionTime = plannedTimeDate;
        } catch (error) {
          errorLogger.log("error", `Company: ${companyUrl} failed to fetch working shifts of the company ${error.message}`)
          console.error("Error fetching working shift details:", error);
          return null;
        }
      }
    } else if (type == "TATdays" && durationType == "days") {
      infoLogger.log("info", `Company: ${companyUrl} hits the function calculateFmsPlannedComplitionTime and selected type as ${type} and duration type as ${durationType} with end time as ${endTime}`);
      const currentDateTimeFinal = moment
        .tz(taskStartTime, "Asia/Kolkata")
        .toDate();
      console.log("currenDateTimeFinal", currentDateTimeFinal);
      //   currentDateTimeFinal.setHours(currentDateTimeFinal.getHours() + 5);
      //   currentDateTimeFinal.setMinutes(currentDateTimeFinal.getMinutes() + 30);

      console.log("date check", currentDateTimeFinal);
      plannedCompletionTime = currentDateTimeFinal;
      const dateToFetchInBetweenDates = plannedCompletionTime;

      plannedCompletionTime = moment
        .tz(plannedCompletionTime, "Asia/Kolkata")
        .add(duration, "days")
        .format();

      console.log("plannedCompletionTime for days", plannedCompletionTime);
      plannedCompletionTimeIST = plannedCompletionTime;

      const endTimeCompletion = endTime;
      console.log("plannedCompletionTimeIST", plannedCompletionTimeIST);
      plannedCompletionTimeIST = await validateHolidayforHRS(
        plannedCompletionTimeIST,
        companyUrl,
        type,
        durationType,
        endTimeCompletion,
        dateToFetchInBetweenDates
      );

      console.log("after the planned date return validating holiday", plannedCompletionTimeIST);

      // function to fetch individual employee shift on planned date
      let employeeId;
      if(typeOfShift === 'Individual'){
        employeeId = await fetchEmployeeShiftOnPlannedDate(companyUrl, plannedCompletionTimeIST, employeeList);
        infoLogger.log("info", `Company URL: ${companyUrl} successfully calculated the planned completion date based on the given input, after verifying holidays and other factors: ${plannedCompletionTimeIST}.`);
        return { plannedCompletionTimeIST, employeeId };
      } else{
        // if the type of the shift is all shift
        infoLogger.log("info", `Company URL: ${companyUrl} successfully calculated the planned completion date based on the given input, after verifying holidays and other factors: ${plannedCompletionTimeIST}.`);
        return plannedCompletionTimeIST; 
      }
  

  
      //   plannedCompletionTime = await validateHoliday(
      //     plannedCompletionTime,
      //     duration,
      //     endTimeCompletion,
      //     companyUrl
      //   );
    } else if (type == "T-X") {
      if (durationType == "hrs") {
        infoLogger.log("info", `Company: ${companyUrl} hits the function calculateFmsPlannedComplitionTime and selected type as ${type} and duration type as ${durationType}`);
        console.log("Entering into hours T-X thing with outside working hours");

        const plannedEndDate = answer;
        infoLogger.log("info", `Company: ${companyUrl} started calculated T-X functionality for hours based on the request date ${answer}`);
        console.log("plannedEndDate", plannedEndDate);
        let currentDateTimeFinal = moment
          .tz(plannedEndDate, "Asia/Kolkata")
          .subtract(duration, "hours");
        console.log(
          "currentDateTimeFinal",
          currentDateTimeFinal.format("YYYY-MM-DDTHH:mm:ssZ")
        );

        // Directly format the moment object to get the desired output
        plannedCompletionTime = currentDateTimeFinal.format(
          "YYYY-MM-DDTHH:mm:ssZ"
        );
        console.log("plannedCompletionTime", plannedCompletionTime);
        const dateToFetchInBetweenDates = plannedEndDate;

        plannedCompletionTimeIST = plannedCompletionTime;

        plannedCompletionTimeIST = await validateHolidayforHRS(
          plannedCompletionTimeIST,
          companyUrl,
          type,
          durationType,
          dateToFetchInBetweenDates
        );

        let employeeId;
        if(typeOfShift === 'Individual'){
          console.log("individual shift t-x");
          
          employeeId = await fetchEmployeeShiftOnPlannedDate(companyUrl, plannedCompletionTimeIST, employeeList);
          infoLogger.log("info", `Company URL: ${companyUrl} successfully calculated the planned completion date based on the given input, after verifying holidays and other factors: ${plannedCompletionTimeIST}.`);
          return { plannedCompletionTimeIST, employeeId };
        }else{
          console.log("all shift t-x");
          
          infoLogger.log("info", `Company URL: ${companyUrl} successfully calculated the planned completion date based on the given input, after verifying holidays and other factors: ${plannedCompletionTimeIST}.`);
          return plannedCompletionTimeIST ;
        }

      } else {
        console.log("Entering into days T-X thing");
        infoLogger.log("info", `Company: ${companyUrl} hits the function calculateFmsPlannedComplitionTime and selected type as ${type} and duration type as ${durationType}`);
        const plannedEndDate = answer;

        infoLogger.log("info", `Company: ${companyUrl} started calculated T-X functionality for days based on the request date ${answer}`);
        const plannedEndDateIST = moment
          .tz(plannedEndDate, "Asia/Kolkata")
          .toDate();

        console.log("plannedEndDateIST", plannedEndDateIST);
        plannedEndDateIST.setHours(plannedEndDateIST.getHours() + 5);
        plannedEndDateIST.setMinutes(plannedEndDateIST.getMinutes() + 30);

        console.log("plannedEndDateIST after adding 5 30", plannedEndDateIST);

        let endTimeCompletion;

        if (endTime) {
          endTimeCompletion = endTime;
        } else {
          const fetchEndTime = plannedEndDate.split(" ")[1];
          console.log("fetch", fetchEndTime);
          endTimeCompletion = fetchEndTime;
        }

        console.log("endTimeCompletion", endTimeCompletion);
        const [hours, minutes, seconds] = endTimeCompletion
          .split(":")
          .map(Number);

        console.log("time", hours, minutes, seconds);

        // Calculate plannedCompletionTime by first copying plannedEndDateIST
        plannedCompletionTime = moment.utc(plannedEndDateIST).tz('Asia/Kolkata');

        console.log("normal conversion plannedCompletionTime", plannedCompletionTime);
        // Set the time to match endTimeCompletion
        plannedCompletionTime.set({
          hour: hours,
          minute: minutes,
          second: seconds,
        });

        // Subtract the duration in days
        plannedCompletionTime.subtract(duration, "days");

        console.log("after substracting a durations", plannedCompletionTime);

        // Format the plannedCompletionTime in IST
        plannedCompletionTime = plannedCompletionTime
          .tz("Asia/Kolkata")
          .format("YYYY-MM-DDTHH:mm:ssZ");
        const dateToFetchInBetweenDates = plannedCompletionTime;

        console.log(
          "plannedCompletionTime",
          plannedCompletionTime
        );
        plannedCompletionTimeIST = plannedCompletionTime


        plannedCompletionTimeIST = await validateHolidayforHRS(
          plannedCompletionTimeIST,
          companyUrl,
          type,
          durationType,
          endTimeCompletion,
          dateToFetchInBetweenDates
        );

        let employeeId;
        if(typeOfShift === 'Individual'){
          employeeId = await fetchEmployeeShiftOnPlannedDate(companyUrl, plannedCompletionTimeIST, employeeList);
          infoLogger.log("info", `Company URL: ${companyUrl} successfully calculated the planned completion date based on the given input, after verifying holidays and other factors: ${plannedCompletionTimeIST}.`);
          return { plannedCompletionTimeIST, employeeId };
        }else{
          infoLogger.log("info", `Company URL: ${companyUrl} successfully calculated the planned completion date based on the given input, after verifying holidays and other factors: ${plannedCompletionTimeIST}.`);
          return plannedCompletionTimeIST ;
        }

      }
    }

    // Log final plannedCompletionTimeIST before returning
    console.log(
      "Final plannedCompletionTimeIST before returning:",
      plannedCompletionTimeIST
    );

    return plannedCompletionTimeIST;
  } catch (error) {
    errorLogger.log("error", `company url : ${companyUrl} failed to calculated planned complition date and time due to ${error.message}`)
    console.log(error.message);
    return null;
  }
};

async function validateHolidayforHRS(
  plannedCompletionTimeIST,
  companyUrl,
  type,
  durationType,
  endTimeCompletion,
  dateToFetchInBetweenDates
) {
  try {
    console.log(
      "inside get next working day, holiday validation input is ",
      plannedCompletionTimeIST
    );

    console.log("type", type);
    console.log("durationType", durationType);
    console.log(("endTimeComplition", endTimeCompletion));

    // Split the string using "T" as the separator
    let parts = plannedCompletionTimeIST.split("T");
    let inputDateString = parts[0].trim();
    let inputTimeString = parts[1].trim();

    console.log("inputDateString", inputDateString);
    console.log("inputTimeString", inputTimeString);

    console.log("date and time before the duration", dateToFetchInBetweenDates);

    // Parse the input dates
    let startDate = new Date(dateToFetchInBetweenDates);
    console.log("startDate", startDate);
    let endDate = new Date(inputDateString);
    console.log("endDate", endDate);
    // Normalize both dates to the start of the day (00:00:00)
    startDate.setHours(0, 0, 0, 0);
    endDate.setHours(0, 0, 0, 0);

    // Array to hold the dates
    let datesInBetween = [];

    // Function to format date as YYYY-MM-DD
    function formatDate(date) {
      let d = new Date(date),
        month = "" + (d.getMonth() + 1),
        day = "" + d.getDate(),
        year = d.getFullYear();

      if (month.length < 2) month = "0" + month;
      if (day.length < 2) day = "0" + day;

      return [year, month, day].join("-");
    }

    // Loop to generate dates, starting from the day after startDate
    for (
      let d = new Date(startDate.setDate(startDate.getDate() + 1));
      d <= endDate;
      d.setDate(d.getDate() + 1)
    ) {
      datesInBetween.push(formatDate(d));
    }

    const instanceNonWorkingDayString = axios.create({ httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }) });
    const responseHoliday = await instanceNonWorkingDayString.post(
      process.env.MAIN_BE_HOLIDAY_NONWORKINGDAY_URL_STRING_DATE,
      {
        verify_company_url: companyUrl
      }
    );

    // const responseHoliday = await axios.post(
    //   process.env.MAIN_BE_HOLIDAY_NONWORKINGDAY_URL_STRING_DATE,
    //   { verify_company_url: companyUrl }
    // );

    const instanceNonWorkignDay = axios.create({ httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }) });
    const responseWorkingDays = await instanceNonWorkignDay.post(
      process.env.MAIN_BE_WORKINGDAYS_URL_STRING_DATE,
      {
        verify_company_url: companyUrl
      }
    );

    // const responseWorkingDays = await axios.post(
    //   process.env.MAIN_BE_WORKINGDAYS_URL_STRING_DATE,
    //   { verify_company_url: companyUrl }
    // );

    const datesArrayAsObjects = responseHoliday.data.map((dateString) => {
      let utcDate = new Date(dateString + "T00:00:00Z");
      return utcDate;
    });

    const workingDatesAsObjects = responseWorkingDays.data.map((workingDate) => {
      let utcDate = new Date(workingDate + "T00:00:00Z");
      return utcDate;
    });

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

    console.log("datesArrayAsObjects1", datesArrayAsObjects);
    const consecutiveArrays = groupConsecutiveDates(datesArrayAsObjects);
    console.log("consecutive", consecutiveArrays);

    const inputDate = new Date(inputDateString.trim());

    function isDateInRange(date, startDate, endDate) {
      return date >= startDate && date <= endDate;
    }

    let belongsToElement = -1;

    for (let i = 0; i < consecutiveArrays.length; i++) {
      const dateArray = consecutiveArrays[i];
      const startDate = dateArray[0];
      const endDate = dateArray[dateArray.length - 1];

      if (isDateInRange(inputDate, startDate, endDate)) {
        belongsToElement = i;
        break;
      }
    }

    console.log(
      "inputDate",
      inputDate,
      belongsToElement,
      "element ",
      "which is a holiday"
    );

    if (belongsToElement <= 0 && type === 'TATdays' && durationType == 'days') {
      console.log("inside the TAT in days so enter the block");
      let dateBelongsToOutside = consecutiveArrays;

      const dateInBetweenArray = datesInBetween.map(
        (dateStr) => new Date(dateStr)
      );

      console.log("dateInBetweenArray", dateInBetweenArray);

      const dateBelongsToArray = datesArrayAsObjects.map(
        (dateStr) => new Date(dateStr)
      );

      console.log("dateBelongsToArray", dateBelongsToArray);

      const workingDatesArray = workingDatesAsObjects.map(
        (dateStr) => new Date(dateStr)
      );

      const holidaysArray = dateBelongsToArray.map(
        (dateStr) => new Date(dateStr)
      );

      function isSameDate(date1, date2) {
        return (
          date1.getFullYear() === date2.getFullYear() &&
          date1.getMonth() === date2.getMonth() &&
          date1.getDate() === date2.getDate()
        );
      }

      let holidayCount = 0;

      dateInBetweenArray.forEach((date1) => {
        holidaysArray.forEach((holiday) => {
          if (isSameDate(date1, holiday)) {
            holidayCount++;
          }
        });
      });

      console.log("holidayCount", holidayCount);
      console.log("plannedCompletionTimeIST", plannedCompletionTimeIST);

      const dateBeforeAddingHoliday = plannedCompletionTimeIST.split("T");
      let beforeDate = dateBeforeAddingHoliday[0].trim();
      let beforeTime = dateBeforeAddingHoliday[1].trim();

      plannedCompletionTimeIST = moment.tz(plannedCompletionTimeIST, "Asia/Kolkata")
        .add(holidayCount, "days")
        .format();

      const reCheckPlannedComplitionDates = plannedCompletionTimeIST;

      plannedCompletionTimeIST = holidayValidationRecursive(beforeDate, reCheckPlannedComplitionDates, holidaysArray, plannedCompletionTimeIST);
      console.log("plannedCompletionTimeIST after duration addition", plannedCompletionTimeIST);
      console.log("final plannedCompletionTimeIST", plannedCompletionTimeIST);
    }

    if (belongsToElement >= 0) {
      console.log("Input date belongs to element:", belongsToElement);
      let dateBelongsTo = consecutiveArrays[belongsToElement];

      console.log(dateBelongsTo);
      let lastElementinTheArray = dateBelongsTo[dateBelongsTo.length - 1];
      console.log(lastElementinTheArray);

      if (type == "TATdays" && durationType == "days") {
        console.log("inputDate", dateBelongsTo);

        const dateInBetweenArray = datesInBetween.map(
          (dateStr) => new Date(dateStr)
        );

        console.log("dateInBetweenArray", dateInBetweenArray);

        const dateBelongsToArray = datesArrayAsObjects.map(
          (dateStr) => new Date(dateStr)
        );

        console.log("dateBelongsToArray", dateBelongsToArray);

        const holidaysArray = dateBelongsToArray.map(
          (dateStr) => new Date(dateStr)
        );

        function isSameDate(date1, date2) {
          return (
            date1.getFullYear() === date2.getFullYear() &&
            date1.getMonth() === date2.getMonth() &&
            date1.getDate() === date2.getDate()
          );
        }

        let holidayCount = 0;

        dateInBetweenArray.forEach((date1) => {
          holidaysArray.forEach((holiday) => {
            if (isSameDate(date1, holiday)) {
              holidayCount++;
            }
          });
        });

        console.log("holidayCount:", holidayCount);

        const dateBeforeAddingHoliday = plannedCompletionTimeIST.split("T");
        let beforeDate = dateBeforeAddingHoliday[0].trim();
        let beforeTime = dateBeforeAddingHoliday[1].trim();

        plannedCompletionTimeIST = moment.tz(plannedCompletionTimeIST, "Asia/Kolkata")
          .add(holidayCount, "days")
          .format();

        infoLogger.log("info", `Company URL: ${companyUrl} started verifying if the planned completion date falls on any holiday. Details provided: normal date range before holiday verification: ${beforeDate}, holiday array: ${holidaysArray}, and the initially calculated planned date and time: ${plannedCompletionTimeIST}.`);
        let returnedDateFromRecursiveFun = holidayValidationRecursive(beforeDate, plannedCompletionTimeIST, holidaysArray, plannedCompletionTimeIST);


        console.log("returnedDateFromRecursiveFun", returnedDateFromRecursiveFun);

        let workingDay = new Date(returnedDateFromRecursiveFun);

        let nextWorkingDayString = formatDate(workingDay);
        console.log("nextWorkingDayString Day", nextWorkingDayString);

        let timeToUse = endTimeCompletion || inputTimeString;
        let finalNextWorkingDay = nextWorkingDayString + "T" + timeToUse;

        infoLogger.log("info", `Company URL: ${companyUrl} successfully calculated the planned completion date and time. The final date is ${finalNextWorkingDay}.`);
        console.log("finalNext working day for days", finalNextWorkingDay);
        return finalNextWorkingDay;
      } else {
        let nextWorkingDay = new Date(lastElementinTheArray.getTime());
        nextWorkingDay.setDate(nextWorkingDay.getDate() + 1);
        let nextWorkingDayString = formatDate(nextWorkingDay);
        console.log("nextWorkingDayString", nextWorkingDayString);

        let finalNextWorkingDay = nextWorkingDayString + "T" + inputTimeString;
        console.log("finalNextWorkingDay", finalNextWorkingDay);

        var finalNextWorkingDaydateObject = new Date(finalNextWorkingDay);
        console.log(finalNextWorkingDaydateObject);

        var istfinalNextWorkingDaydateObject = moment.tz(
          finalNextWorkingDaydateObject,
          "Asia/Kolkata"
        );
        var formattedIstDate = istfinalNextWorkingDaydateObject.format();
        console.log("formattedIstDate", formattedIstDate);
        return formattedIstDate;
      }
    } else {
      let timeToUse;
      if (type == 'T-X' && durationType == 'hrs') {
        timeToUse = inputTimeString;
      } else {
        timeToUse = endTimeCompletion || inputTimeString;
      }
      console.log("inside the without holiday", plannedCompletionTimeIST);
      console.log("timeTouse", timeToUse);
      plannedCompletionTimeIST = moment
        .tz(plannedCompletionTimeIST.split("T")[0] + "T" + timeToUse, "Asia/Kolkata")
        .format();
      console.log("plannedComplitionTimeIST For Days", plannedCompletionTimeIST);
      return plannedCompletionTimeIST;
    }
  } catch (error) {
    errorLogger.log("error", `companyUrl : ${companyUrl} failed to verify a holidays and to calculate planned complition date and time due to ${error.message}`)
    return { error: error.message, status: 500 };
  }
}


function holidayValidationRecursive(dateBeforeAddingHoliday, reCheckPlannedCompletionDates, holidayArray, plannedCompletionTimeIST) {
  try {
    console.log("Inside the recursive function");
    console.log("Function input data:", { dateBeforeAddingHoliday, reCheckPlannedCompletionDates, holidayArray });

    let dateAfterAddingHoliday = reCheckPlannedCompletionDates.split("T");
    let afterdate = dateAfterAddingHoliday[0].trim();
    let aftertime = dateAfterAddingHoliday[1].trim();

    console.log("Date after splitting:", { afterdate, aftertime });

    let startDate = new Date(dateBeforeAddingHoliday);
    let endDate = new Date(afterdate);

    console.log("Start Date:", startDate);
    console.log("End Date:", endDate);

    // Function to format the date to yyyy-mm-dd
    function formatDate(date) {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0'); // Month is zero-based, so add 1
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }

    // Function to check if two dates are the same
    function isSameDate(date1, date2) {
      return formatDate(new Date(date1)) === formatDate(new Date(date2));
    }

    // Recursive function to adjust for holidays
    function adjustForHolidays(startDate, endDate, holidayCount) {
      console.log("Adjusting for holidays", { startDate, endDate, holidayCount });

      let datesInBetween = [];

      // Loop to generate dates, starting from the day after startDate
      for (
        let d = new Date(startDate.setDate(startDate.getDate() + 1)); // Start from the day after startDate
        d <= endDate;
        d.setDate(d.getDate() + 1) // Increment the date by 1 day each time
      ) {
        console.log(`Considering date: ${formatDate(d)} - Will it be pushed? ${d <= endDate}`);
        datesInBetween.push(formatDate(d));
      }

      // Check if endDate needs to be added
      if (!datesInBetween.includes(formatDate(endDate))) {
        datesInBetween.push(formatDate(endDate));
      }

      console.log("Dates in Between (excluding startDate, including endDate):", datesInBetween);


      // Count dates that fall on holidays
      let holidayCountFinal = holidayCount;
      let isHoliday = false;
      holidayArray.forEach((holiday) => {
        datesInBetween.forEach((date) => {
          if (isSameDate(holiday, date)) {
            holidayCountFinal++;
            isHoliday = true;
            console.log("Matching Date Found:", formatDate(holiday)); // Log the matching date
          }
        });
      });

      console.log("Holiday Count Final:", holidayCountFinal);

      if (isHoliday) {
        const beforeAddingHoliday = new Date(plannedCompletionTimeIST);
        console.log("beforeAddingHoliday", beforeAddingHoliday);
        plannedCompletionTimeIST = moment.tz(plannedCompletionTimeIST, "Asia/Kolkata").add(holidayCountFinal, "days").format();
        console.log("Planned Completion Time after adding a holiday:", plannedCompletionTimeIST);

        let newEndDate = new Date(plannedCompletionTimeIST.split("T")[0].trim());
        console.log("New End Date:", newEndDate);

        return adjustForHolidays(beforeAddingHoliday, newEndDate, 0);
      } else {
        console.log("Final Planned Completion Time:", plannedCompletionTimeIST);
        return plannedCompletionTimeIST;
      }
    }

    return adjustForHolidays(startDate, endDate, 0);

  } catch (error) {
    errorLogger.log("error", `Failed to excute recursive holiday verification function due to ${error.message}`);
    console.log("Error:", error.message);
  }
}


const fetchEmployeeShiftOnPlannedDate = async (companyUrl, plannedCompletionTimeIST, employeeList) => {
  const onlyDate = new Date(plannedCompletionTimeIST);

      const plannedDateOnly = new Intl.DateTimeFormat("en-GB", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        timeZone: "Asia/Kolkata"
      }).format(onlyDate);

      console.log(plannedDateOnly);
      const [day, month, year] = plannedDateOnly.split("/");
      const formatedDatePayload = `${year}-${month}-${day}`;
      console.log("formatedDatePayload", formatedDatePayload);


      const instanceWorkinShiftByDateUserId = axios.create({ httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }) });
      const shiftResponse = await instanceWorkinShiftByDateUserId.post(
        process.env.MAIN_BE_WORKING_SHIFT_DATE_USERID,
        {
          verify_company_url: companyUrl,
          date: formatedDatePayload,
          employeeids: employeeList
        }
      );

      console.log("shift Response", shiftResponse.data.result);

      const findEmployeeForPlannedTime = (plannedCompletionTimeIST, shiftResponse) => {
        const plannedTime = moment(plannedCompletionTimeIST);

        for (const shift of shiftResponse.data.result) {
          const shiftStart = moment(shift.shiftStartTime);
          const shiftEnd = moment(shift.shiftEndTime);

          // Check if planned time falls within shift start and end time
          if (plannedTime.isBetween(shiftStart, shiftEnd, null, "[)")) {
            return shift.employeeId; // Return the first matching employeeId
          }
        }

        return null; // Return null if no matching shift is found
      };

      const employeeId = findEmployeeForPlannedTime(plannedCompletionTimeIST, shiftResponse);

      console.log("Employee ID for planned completion time:", employeeId);
      return employeeId;
}


module.exports = { calculateFmsPlannedCompletionTime };
