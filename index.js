const https = require('https');
const nodemailer = require('nodemailer');

// Configuration from environment variables
const MTA_API_KEY = process.env.MTA_API_KEY;
const GMAIL_ADDRESS = process.env.GMAIL_ADDRESS;
const GMAIL_APP_PASSWORD = process.env.GMAIL_APP_PASSWORD;
const PHONE_NUMBER = process.env.PHONE_NUMBER; // Just digits, e.g., 2125551234

// M104 Southbound at Broadway & W 86 St
const STOP_ID = '403162';
const LINE_REF = 'MTA NYCT_M104';

// Time window: 8:00 AM - 8:30 AM ET
const START_HOUR = 8;
const START_MINUTE = 0;
const END_HOUR = 8;
const END_MINUTE = 30;

function httpsRequest(url, options = {}) {
  return new Promise((resolve, reject) => {
    const req = https.request(url, options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve({ statusCode: res.statusCode, body: data });
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${data}`));
        }
      });
    });
    req.on('error', reject);
    if (options.body) req.write(options.body);
    req.end();
  });
}

async function fetchBusArrivals() {
  const url = new URL('https://bustime.mta.info/api/siri/stop-monitoring.json');
  url.searchParams.set('key', MTA_API_KEY);
  url.searchParams.set('OperatorRef', 'MTA');
  url.searchParams.set('MonitoringRef', STOP_ID);
  url.searchParams.set('LineRef', LINE_REF);
  url.searchParams.set('version', '2');

  const response = await httpsRequest(url.toString());
  return JSON.parse(response.body);
}

function parseArrivals(data) {
  const arrivals = [];

  try {
    const visits = data?.Siri?.ServiceDelivery?.StopMonitoringDelivery?.[0]?.MonitoredStopVisit || [];

    for (const visit of visits) {
      const journey = visit.MonitoredVehicleJourney;
      const call = journey?.MonitoredCall;

      if (!call) continue;

      // Get expected arrival time (use ExpectedArrivalTime if available, else AimedArrivalTime)
      const arrivalTimeStr = call.ExpectedArrivalTime || call.AimedArrivalTime;
      if (!arrivalTimeStr) continue;

      const arrivalTime = new Date(arrivalTimeStr);
      const now = new Date();

      // Convert to ET for comparison
      const etOptions = { timeZone: 'America/New_York', hour: 'numeric', minute: 'numeric', hour12: false };
      const arrivalET = new Date(arrivalTime.toLocaleString('en-US', { timeZone: 'America/New_York' }));
      const arrivalHour = arrivalET.getHours();
      const arrivalMinute = arrivalET.getMinutes();

      // Check if within our time window (8:00 AM - 8:30 AM)
      const arrivalTotalMinutes = arrivalHour * 60 + arrivalMinute;
      const startTotalMinutes = START_HOUR * 60 + START_MINUTE;
      const endTotalMinutes = END_HOUR * 60 + END_MINUTE;

      if (arrivalTotalMinutes >= startTotalMinutes && arrivalTotalMinutes <= endTotalMinutes) {
        // Format as 8:14 AM
        const formattedTime = arrivalTime.toLocaleTimeString('en-US', {
          timeZone: 'America/New_York',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true
        });

        // Calculate minutes away
        const minutesAway = Math.round((arrivalTime - now) / 60000);

        arrivals.push({
          time: formattedTime,
          minutesAway: minutesAway,
          arrivalDate: arrivalTime
        });
      }
    }

    // Sort by arrival time
    arrivals.sort((a, b) => a.arrivalDate - b.arrivalDate);

  } catch (err) {
    console.error('Error parsing arrivals:', err);
  }

  return arrivals;
}

function formatMessage(arrivals) {
  if (arrivals.length === 0) {
    return 'M104 @ 86th: No buses expected 8:00-8:30 AM. Check MTA app.';
  }

  const times = arrivals.map(a => {
    if (a.minutesAway > 0) {
      return `${a.time} (${a.minutesAway} min)`;
    }
    return a.time;
  }).join(', ');

  return `M104 @ 86th St: ${times}`;
}

async function sendSMS(message) {
  // Send via Gmail to Verizon's email-to-SMS gateway
  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
      user: GMAIL_ADDRESS,
      pass: GMAIL_APP_PASSWORD
    }
  });

  const mailOptions = {
    from: GMAIL_ADDRESS,
    to: `${PHONE_NUMBER}@vtext.com`,
    subject: 'M104',
    text: message
  };

  const result = await transporter.sendMail(mailOptions);
  return result;
}

function isWithinRunWindow() {
  // Only run if current time in ET is between 7:45 AM and 8:10 AM
  // This handles daylight saving time - both crons will trigger but only one will be in window
  const now = new Date();
  const etTime = new Date(now.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const hour = etTime.getHours();
  const minute = etTime.getMinutes();
  const totalMinutes = hour * 60 + minute;

  const windowStart = 7 * 60 + 45;  // 7:45 AM
  const windowEnd = 8 * 60 + 10;    // 8:10 AM

  return totalMinutes >= windowStart && totalMinutes <= windowEnd;
}

async function main() {
  // Check if we're in the right time window (handles DST with dual cron jobs)
  // Skip this check for manual runs (MANUAL_RUN=true)
  if (process.env.MANUAL_RUN !== 'true' && !isWithinRunWindow()) {
    console.log('Outside run window (7:45-8:10 AM ET). Skipping.');
    return;
  }

  console.log('Fetching M104 bus arrivals...');

  // Validate environment variables
  if (!MTA_API_KEY) throw new Error('MTA_API_KEY is required');
  if (!GMAIL_ADDRESS) throw new Error('GMAIL_ADDRESS is required');
  if (!GMAIL_APP_PASSWORD) throw new Error('GMAIL_APP_PASSWORD is required');
  if (!PHONE_NUMBER) throw new Error('PHONE_NUMBER is required');

  try {
    const data = await fetchBusArrivals();
    const arrivals = parseArrivals(data);
    const message = formatMessage(arrivals);

    console.log('Message:', message);

    await sendSMS(message);
    console.log('SMS sent successfully!');

  } catch (err) {
    // Send error notification
    const errorMessage = 'M104 alert: No data available. Check MTA app.';
    console.error('Error:', err.message);

    try {
      await sendSMS(errorMessage);
      console.log('Error notification sent.');
    } catch (sendErr) {
      console.error('Failed to send error notification:', sendErr.message);
      process.exit(1);
    }
  }
}

main();
