const dotenv = require('dotenv').config(); // Get variables from .env
const https = require('https'); // Require built-in HTTPS Node module

// Get HTML from schedule page
https.get(process.env.GYM_SCHEDULE_PAGE, (res) => {
  // Set up empty string to store HTML
  let data = '';

  // Concatenate chunks received
  res.on('data', (chunk) => {
    data += chunk;
  });

  // Console log the HTML
  res.on('end', () => {
    console.log(data);
  });

}).on('error', (e) => {
  console.error(e);
});
