// Modules
const dotenv = require('dotenv').config(); // Get variables from .env
const https = require('https'); // Require built-in HTTPS Node module
const fs = require('fs'); // Require writeFileSync to create calendar files
const ics = require('ics') // Require ics to create ics calendar files
const jsdom = require("jsdom"); // Require jsdom for dom parsing
const { JSDOM } = jsdom;
const luxon = require('luxon'); // Require Luxon to parse and format dates
const DateTime = luxon.DateTime;
const RRule = require('rrule').RRule;

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

    // Get selected schedule's name to later parse the schedule's start and end dates.
    const scheduleName = document.querySelector('.schedule-selector option[selected]').textContent; // NOTE: The date range only appears on the page in this select filter

    // Get elements containing info for each day of the week
    const dayElements = document.querySelectorAll('#Weekly-Schedule-View>ul>li'); // NOTE: dayElements don't have any classes or IDs to target

    // Create an array of a week of events formatted for input into ics
    const startEndDates = scheduleName.match(/((\d){2}\/){2}(\d){4}/g).map((date) => {
      return DateTime.fromFormat(date, 'dd/LL/yyyy');
    });
    const startDate = startEndDates[0];
    const endDate = startEndDates[1].endOf('day');
    const startDayOfWeek = startDate.weekday;

    // Create RRULE
    const rrule = new RRule({
      freq: RRule.WEEKLY,
      until: endDate,
    }).toString();

    const events = [...dayElements].reduce((acc, dayElement) => {
      // Get elements containing class info
      const classElements = dayElement.querySelectorAll('ul li'); // NOTE: classElements don't have any classes or IDs to target

      // Create key info
      const dayOfWeek = DateTime.fromFormat(dayElement.querySelector('h4').textContent, 'cccc').weekday;
      const dayOffset = dayOfWeek - startDayOfWeek + (dayOfWeek >= startDayOfWeek ? 0 : 7);
      const date = startDate.plus({days: dayOffset});
      const classes = [...classElements].map((classElement) => {

        // Get class info from HTML
        const name = classElement.querySelector('.class-name').textContent.trim();
        const times = classElement.querySelector('.time').textContent.trim().split(' - ').map((time) => {
          return DateTime.fromFormat(time, 'h:mma');
        });
        const room = classElement.querySelector('.room').textContent.trim();
        const url = classElement.querySelector('a').href;

        // Calculate start and end
        const start = [date.year, date.month, date.day, times[0].hour, times[0].minute];
        const end = [date.year, date.month, date.day, times[1].hour, times[1].minute];

        return {
          title: name,
          location: room,
          description: url,
          start,
          end,
        };
      });

      return acc.concat(classes);
    }, []);

    // Create ics calendar file
    ics.createEvents(events, (error, value) => {
      if (error) {
        console.log(error)
      }

      // Add RRULE to each event
      value = value.replace(/^END:VEVENT$/gm, `${rrule}\nEND:VEVENT`);

      fs.writeFileSync(`${__dirname}/output/calendar.ics`, value);
    });

  });

}).on('error', (e) => {
  console.error(e);
});
