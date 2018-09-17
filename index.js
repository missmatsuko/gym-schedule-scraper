// Built-in Node Modules
const assert = require('assert'); // To add assertion tests
const fs = require('fs'); // To create files
const https = require('https'); // To make https request
const url = require('url'); // To parse URL

// NPM Modules
require('dotenv').config(); // To get variables from .env
const ics = require('ics') // To ics-formatted data
const jsdom = require('jsdom'); // To parse as HTML like a DOM
const { JSDOM } = jsdom;
const luxon = require('luxon'); // To parse and format dates
const DateTime = luxon.DateTime;
const RRule = require('rrule').RRule; // To create RRULE-formatted string

// Variables
const numberOfDaysInAWeek = 7;
const scheduleURL = new URL(process.env.GYM_SCHEDULE_PAGE);

// Make https request to the schedule page
https.get(scheduleURL.href, (res) => {
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
    assert(scheduleRangeElement != null);

    const scheduleDayElements = document.querySelectorAll('#Weekly-Schedule-View>ul>li'); // For each day of the week; contains list of classes
    assert(scheduleDayElements.length);

    // Get start and end dates of range
    const scheduleRangeDates = scheduleRangeElement.textContent.match(/((\d){2}\/){2}(\d){4}/g).map((scheduleRangeDateString) => {
      const scheduleRangeDate = DateTime.fromFormat(scheduleRangeDateString, 'dd/LL/yyyy');
      assert(scheduleRangeDate.isValid);
      return scheduleRangeDate;
    });
    assert(scheduleRangeDates.length === 2);

    const scheduleRangeStartDate = scheduleRangeDates[0].startOf('day');
    const scheduleRangeEndDate = scheduleRangeDates[1].endOf('day');
    assert(scheduleRangeStartDate < scheduleRangeEndDate);

    const scheduleRangeStartDayOfWeek = scheduleRangeStartDate.weekday;

    // Create RRULE for events in this schedule
    const rrule = new RRule({
      freq: RRule.WEEKLY,
      until: scheduleRangeEndDate,
    }).toString();
    assert(rrule.length);

    // Create an array of events formatted for input into ics
    const events = [...scheduleDayElements].reduce((acc, scheduleDayElement) => {
      // Create key info for each day in the schedule
      const scheduleDayDayOfWeek = DateTime.fromFormat(scheduleDayElement.querySelector('h4').textContent, 'cccc').weekday; // Day of week
      assert(typeof scheduleDayDayOfWeek === 'number');
      assert(scheduleDayDayOfWeek >= 1);
      assert(scheduleDayDayOfWeek <= numberOfDaysInAWeek);
      const scheduleDayOffset = scheduleDayDayOfWeek - scheduleRangeStartDayOfWeek + (scheduleDayDayOfWeek >= scheduleRangeStartDayOfWeek ? 0 : numberOfDaysInAWeek); // Get number of days after the start date of schedule that the schedule date occurs
      const scheduleDate = scheduleRangeStartDate.plus({days: scheduleDayOffset}); // Get the first date in the schedule for that weekday

      // Get elements containing info about each class within each day in the schedule
      const classElements = scheduleDayElement.querySelectorAll('ul li');

      // If the schedule day doesn't have any classes, don't add classes to accumulator
      if (!classElements.length) {
        return acc;
      }

      // Format classes for ics
      const classes = [...classElements].map((classElement) => {
        // Info about each class
        const className = classElement.querySelector('.class-name').textContent.trim();
        assert(className.length);
        const classTimes = classElement.querySelector('.time').textContent.trim().split(' - ').map((classTimeString) => {
          const classTime = DateTime.fromFormat(classTimeString, 'h:mma')
          assert(classTime.isValid);
          return classTime;
        });
        const classStartTime = classTimes[0];
        const classEndTime = classTimes[1];
        assert(classTimes.length === 2);
        const classRoom = classElement.querySelector('.room').textContent.trim() || '';
        const classHref = `${scheduleURL.origin}${classElement.querySelector('a').href}` || '';
        const classDescription = `Details: ${classHref !== scheduleURL.origin ? classHref : scheduleURL.href}`;

        return {
          title: className,
          location: classRoom,
          description: classDescription,
          start: [scheduleDate.year, scheduleDate.month, scheduleDate.day, classStartTime.hour, classStartTime.minute],
          end: [scheduleDate.year, scheduleDate.month, scheduleDate.day, classEndTime.hour, classEndTime.minute],
        };
      });

      // Add classes to accumulator
      return acc.concat(classes);
    }, []);

    // Create ics-formatted data
    ics.createEvents(events, (error, value) => {
      if (error) {
        console.error(error)
      }

      // Add RRULE to each event because ics package currently doesn't support RRULE (repeating events)
      value = value.replace(/^END:VEVENT$/gm, `${rrule}\nEND:VEVENT`);

      // Write ics-formatted data to an ics file
      fs.writeFileSync(`${__dirname}/output/calendar.ics`, value);
    });

  });

}).on('error', (error) => {
  console.error(error);
});
