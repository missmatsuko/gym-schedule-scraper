// Built-in Node Modules
const https = require('https'); // To make https request
const fs = require('fs'); // To create files

// NPM Modules
const dotenv = require('dotenv').config(); // To get variables from .env
const ics = require('ics') // To ics-formatted data
const jsdom = require("jsdom"); // To parse as HTML like a DOM
const { JSDOM } = jsdom;
const luxon = require('luxon'); // To parse and format dates
const DateTime = luxon.DateTime;
const RRule = require('rrule').RRule; // To create RRULE-formatted string

// Variables
const numberOfDaysInAWeek = 7;

// Make https request to the schedule page
https.get(process.env.GYM_SCHEDULE_PAGE, (res) => {
  // Set up empty string to store HTML
  let data = '';

  // Concatenate chunks received
  res.on('data', (chunk) => {
    data += chunk;
  });

  // When all chunks are received
  res.on('end', () => {
    // Parse HTML string like a DOM
    const { document } = (new JSDOM(data)).window;

    // Get elements on page that contain data needed for calendar events
    const scheduleRangeElement = document.querySelector('.schedule-selector option[selected]'); // Contains name of schedule and its date range
    const scheduleDayElements = document.querySelectorAll('#Weekly-Schedule-View>ul>li'); // For each day of the week; contains list of classes

    // Get start and end dates of range
    const scheduleRangeDates = scheduleRangeElement.textContent.match(/((\d){2}\/){2}(\d){4}/g).map((date) => {
      return DateTime.fromFormat(date, 'dd/LL/yyyy');
    });
    const scheduleRangeStartDate = scheduleRangeDates[0];
    const scheduleRangeEndDate = scheduleRangeDates[1].endOf('day');
    const scheduleRangeStartDayOfWeek = scheduleRangeStartDate.weekday;

    // Create RRULE for events in this schedule
    const rrule = new RRule({
      freq: RRule.WEEKLY,
      until: scheduleRangeEndDate,
    }).toString();

    // Create an array of events formatted for input into ics
    const events = [...scheduleDayElements].reduce((acc, scheduleDayElement) => {
      // Create key info for each day in the schedule
      const scheduleDayDayOfWeek = DateTime.fromFormat(scheduleDayElement.querySelector('h4').textContent, 'cccc').weekday; // Day of week
      const scheduleDayOffset = scheduleDayDayOfWeek - scheduleRangeStartDayOfWeek + (scheduleDayDayOfWeek >= scheduleRangeStartDayOfWeek ? 0 : numberOfDaysInAWeek); // Get number of days after the start date of schedule that the schedule date occurs
      const scheduleDate = scheduleRangeStartDate.plus({days: scheduleDayOffset}); // Get the first date in the schedule for that weekday

      // Get elements containing info about each class within each day in the schedule
      const classElements = scheduleDayElement.querySelectorAll('ul li');

      // Format classes for ics
      const classes = [...classElements].map((classElement) => {
        // Get info about each class from HTML
        const className = classElement.querySelector('.class-name').textContent.trim();
        const classTimes = classElement.querySelector('.time').textContent.trim().split(' - ').map((time) => {
          return DateTime.fromFormat(time, 'h:mma');
        });
        const classRoom = classElement.querySelector('.room').textContent.trim();
        const classURL = classElement.querySelector('a').href;

        // Get start and end times of class
        const classStartTime = classTimes[0];
        const classEndTime = classTimes[1];

        return {
          title: className,
          location: classRoom,
          description: classURL,
          start: [scheduleDate.year, scheduleDate.month, scheduleDate.day, classStartTime.hour, classStartTime.minute],
          end: [scheduleDate.year, scheduleDate.month, scheduleDate.day, classEndTime.hour, classEndTime.minute],
        };
      });

      return acc.concat(classes);
    }, []);

    // Create ics-formatted data
    ics.createEvents(events, (error, value) => {
      if (error) {
        console.log(error)
      }

      // Add RRULE to each event because ics package currently doesn't support RRULE (repeating events)
      value = value.replace(/^END:VEVENT$/gm, `${rrule}\nEND:VEVENT`);

      // Write ics-formatted data to an ics file
      fs.writeFileSync(`${__dirname}/output/calendar.ics`, value);
    });

  });

}).on('error', (e) => {
  console.error(e);
});
