# M104 Bus Alert

Sends a daily SMS at ~8 AM with real-time M104 bus arrival times at 86th & Broadway (southbound).

## Example Text Message

```
M104 @ 86th St: 8:14 AM (12 min), 8:27 AM (25 min)
```

## Setup Instructions

### 1. Get MTA Bus Time API Key (Free)

1. Go to https://bt.mta.info/wiki/Developers/Index
2. Click the link to register for an API key
3. Fill out the form - you'll receive the key via email

### 2. Get SendGrid API Key (Free)

SendGrid's free tier includes 100 emails/day forever - plenty for one daily text.

1. Sign up at https://signup.sendgrid.com/
2. Go to Settings > API Keys
3. Click "Create API Key"
4. Select "Full Access" (or at minimum "Mail Send")
5. Copy the key (you'll only see it once!)

### 3. Verify a Sender Email in SendGrid

1. Go to Settings > Sender Authentication
2. Click "Verify a Single Sender"
3. Add your email address (e.g., your Gmail)
4. Click the verification link sent to that email

### 4. Create GitHub Repository

1. Create a new repository on GitHub (can be public - no secrets in code)
2. Clone it locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/m104-bus-alert.git
   ```
3. Copy these files into it:
   ```
   index.js
   package.json
   .github/workflows/bus-alert.yml
   ```
4. Push to GitHub:
   ```bash
   git add .
   git commit -m "Initial commit"
   git push
   ```

### 5. Add GitHub Secrets

In your GitHub repository:

1. Go to Settings > Secrets and variables > Actions
2. Click "New repository secret" and add these four secrets:

| Secret Name | Value |
|------------|-------|
| `MTA_API_KEY` | Your MTA Bus Time API key |
| `SENDGRID_API_KEY` | Your SendGrid API key |
| `PHONE_NUMBER` | Your 10-digit phone number (e.g., `2125551234`) |
| `FROM_EMAIL` | Your verified SendGrid sender email |

### 6. Test It

1. Go to the Actions tab in your repository
2. Click "M104 Bus Alert" in the left sidebar
3. Click "Run workflow" > "Run workflow"
4. Check your phone for the text!

## How It Works

- GitHub Actions runs at 7:58 AM ET on weekdays (Mon-Fri)
- Fetches real-time bus data from MTA Bus Time API
- Filters for M104 arrivals between 8:00-8:30 AM
- Sends an email to `yourphone@vtext.com` (Verizon's email-to-SMS gateway)
- You receive it as a regular text message

## Pause/Resume Alerts

Going on vacation or no school this week? You can pause and resume alerts from your iPhone home screen.

See **[IOS-SHORTCUTS-SETUP.md](IOS-SHORTCUTS-SETUP.md)** for instructions to add "Pause Bus Alert" and "Resume Bus Alert" buttons to your home screen.

## Troubleshooting

**No text received?**
- Check GitHub Actions logs for errors
- Verify your phone number is correct (10 digits, no dashes)
- Check spam folder in case Verizon flagged it
- Make sure SendGrid sender is verified

**Wrong times?**
- The script filters for buses arriving 8:00-8:30 AM Eastern Time
- Edit `START_HOUR`, `START_MINUTE`, `END_HOUR`, `END_MINUTE` in index.js to adjust

**Want to change the bus stop?**
- Find your stop ID at https://bustime.mta.info/
- Update `STOP_ID` in index.js

## Cost

$0/month
- MTA API: Free
- SendGrid: Free (100 emails/day)
- GitHub Actions: Free for public repos
- Verizon email-to-SMS: Free

## Files

```
m104-bus-alert/
├── index.js                      # Main script
├── package.json                  # Node.js config
├── README.md                     # This file
├── IOS-SHORTCUTS-SETUP.md        # Pause/resume shortcuts guide
└── .github/
    └── workflows/
        └── bus-alert.yml         # GitHub Actions schedule
```

