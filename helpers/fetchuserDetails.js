const axios = require('axios');
const jwtToken = require('jsonwebtoken')
const { infoLogger, errorLogger } = require("../middleware/logger");

async function fetchUserDetails(authHeader , req , res) {

  // Initialize variables to hold user details
  let userName = "";
  let userID = "";
  let companyUrl = "";
  let userEmail = "";
  let roleName = "";

  //console.log('Iniside the Get User Details Function')
  //console.log(authHeader)
  //const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer")) {
    console.log("error: Authorization header missing or malformed");
    errorLogger.log("error", `Token ${req.headers.authorization} is un-authorized as authorization header missing or malformed for api fmsStep1`);
    return res.status(401).json({ error: 'Unauthorized' });
  }
  const token = authHeader.split(" ")[1];
  //infoLogger.log("info", `token ${token} is verified successfuly for the api fmsStep1`);
  //console.log('token fetched is ' , token)
  const payload = jwtToken.verify(token, process.env.ACCESS_SECRET_KEY);
  console.log("payload in fms", payload);

 // req.user = { verify_company_url: payload.verify_company_url, user_id: payload.user_id, role_name: payload.role_name, role_id: payload.role_id, email_id: payload.email_id, company_name: payload.company_name, emp_name: payload.emp_name };

  // const instance = axios.create({httpsAgent: new (require('https').Agent)({ rejectUnauthorized: false }) });
  // const response = await instance.post(process.env.MAIN_BE_URL, { token: token })
  // .then(response => {
  //console.log('Fetched User Details and Company Details', response.data);
  
  userName = payload.emp_name;
  userID = payload.user_id;
  companyUrl = payload.verify_company_url;
  userEmail = payload.email_id;
  roleName = payload.role_name;

  // })
  // .catch(error => {
  //  console.error('Error:', error);
  // });

  console.log("userName" , userName)
  console.log("userID" , userID)
  console.log("companyUrl" , companyUrl)
  console.log("userEmail" , userEmail)
  console.log("roleName" , roleName);

  let userDetails = {
    userName: userName,
    userID: userID,
    companyUrl: companyUrl,
    userEmail: userEmail
  }

  return userDetails;
}

module.exports = { fetchUserDetails }; 