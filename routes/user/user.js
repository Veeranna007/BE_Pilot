const express = require("express");
const axios = require('axios');



// Function to make a POST request
function getUserDetails(token) {

    const url  = process.env.MAIN_BE_URL
    
 return axios.post(url, {token : token})
    .then(response => {
      console.log('Data posted successfully:', response.data);
      return response.data; // Return the response data
    })
    .catch(error => {
      console.error('Error posting data:', error);
      throw error; // Rethrow the error to be handled by the caller
    });
}

module.exports = getUserDetails;