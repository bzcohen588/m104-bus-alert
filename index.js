const https = require('https');

// Configuration from environment variables
const MTA_API_KEY = process.env.MTA_API_KEY;
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY;
const PHONE_NUMBER = process.env.PHONE_NUMBER; // Just digits, e.g., 2125551234
const FROM_EMAIL = process.env.FROM_EMAIL; // Your verified SendGrid sender

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
  // Send via SendGrid to Verizon's email-to-SMS gateway
  const toEmail = `${PHONE_NUMBER}@vtext.com`;

  const emailData = {
    personalizations: [{ to: [{ email: toEmail }] }],
    from: { email: FROM_EMAIL },
    subject: 'M104 Bus', // Subject appears as sender name in SMS
    content: [{ type: 'text/plain', value: message }]
  };

  const response = await httpsRequest('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SENDGRID_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(emailData)
  });

  return response;
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
  if (!isWithinRunWindow()) {
    console.log('Outside run window (7:45-8:10 AM ET). Skipping.');
    return;
  }

  console.log('Fetching M104 bus arrivals...');

  // Validate environment variables
  if (!MTA_API_KEY) throw new Error('MTA_API_KEY is required');
  if (!SENDGRID_API_KEY) throw new Error('SENDGRID_API_KEY is required');
  if (!PHONE_NUMBER) throw new Error('PHONE_NUMBER is required');
  if (!FROM_EMAIL) throw new Error('FROM_EMAIL is required');

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
