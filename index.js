const dotenv = require('dotenv').config(); // Get variables from .env
const https = require('https'); // Require built-in HTTPS Node module
const jsdom = require("jsdom"); // Require jsdom for dom parsing
const { JSDOM } = jsdom;

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
    // Parse the HTML string
    const { document } = (new JSDOM(data)).window;

    // Get elements containing info for each day of the week
    const dayElements = document.querySelectorAll('#Weekly-Schedule-View>ul>li'); // NOTE: dayElements don't have any classes or IDs to target

    // Create new array, weekSchedule, containing key info
    const weekSchedule = [...dayElements].map((dayElement) => {
      // Get elements containing class info
      const classElements = dayElement.querySelectorAll('ul li'); // NOTE: classElements don't have any classes or IDs to target

      // Create key info
      const dayOfWeek = dayElement.querySelector('h4').textContent;
      const classes = [...classElements].map((classElement) => {
        const name = classElement.querySelector('.class-name').textContent.trim();
        const time = classElement.querySelector('.time').textContent.trim();
        const room = classElement.querySelector('.room').textContent.trim();
        const link = classElement.querySelector('a').href;

        return {name,time,room,link};
      });

      return {dayOfWeek,classes};
    });

    console.log(weekSchedule);

  });

}).on('error', (e) => {
  console.error(e);
});
