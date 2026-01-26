# iOS Shortcuts Setup

Add two shortcuts to your iPhone home screen to pause/resume bus alerts.

## Step 1: Create a GitHub Personal Access Token

1. Go to https://github.com/settings/tokens?type=beta (Fine-grained tokens)
2. Click **"Generate new token"**
3. Fill in:
   - **Token name**: `Bus Alert Control`
   - **Expiration**: Choose "No expiration" (or set a reminder to renew)
   - **Repository access**: Select "Only select repositories" → choose your `m104-bus-alert` repo
   - **Permissions**: Expand "Repository permissions" → set **Actions** to "Read and write"
4. Click **"Generate token"**
5. **Copy the token** (starts with `github_pat_...`) — you'll only see it once!

---

## Step 2: Create "Pause Bus Alert" Shortcut

1. Open the **Shortcuts** app on your iPhone
2. Tap **+** to create a new shortcut
3. Tap **"Add Action"**
4. Search for **"URL"** and select it
5. Enter this URL (replace YOUR_USERNAME with your GitHub username):
   ```
   https://api.github.com/repos/YOUR_USERNAME/m104-bus-alert/actions/workflows/bus-alert.yml/disable
   ```
6. Tap **+** below the URL to add another action
7. Search for **"Get Contents of URL"** and select it
8. Tap **"Show More"** on that action
9. Change **Method** to **PUT**
10. Under **Headers**, tap **"Add new header"**:
    - **Key**: `Authorization`
    - **Text**: `Bearer YOUR_GITHUB_TOKEN` (paste your token after "Bearer ")
11. Add another header:
    - **Key**: `Accept`
    - **Text**: `application/vnd.github+json`
12. Tap the shortcut name at the top → rename to **"Pause Bus Alert"**
13. Tap the dropdown arrow next to the name → **"Add to Home Screen"**
14. Choose an icon (I suggest a red pause icon)
15. Tap **"Add"**

---

## Step 3: Create "Resume Bus Alert" Shortcut

Repeat the same steps as above, but:

- Use this URL instead (note: `enable` instead of `disable`):
  ```
  https://api.github.com/repos/YOUR_USERNAME/m104-bus-alert/actions/workflows/bus-alert.yml/enable
  ```
- Name it **"Resume Bus Alert"**
- Choose a green play icon

---

## How to Use

- **Going on vacation?** Tap "Pause Bus Alert" on your home screen
- **Back and ready for school runs?** Tap "Resume Bus Alert"

The shortcut will briefly flash and complete. No confirmation message (keeps it simple), but you can check the Actions tab on GitHub to verify the workflow is disabled/enabled.

---

## Troubleshooting

**Shortcut fails or shows an error?**
- Make sure the token hasn't expired
- Verify the repository name matches exactly
- Check that the token has "Actions: Read and write" permission

**Want a confirmation message?**
Add a "Show Notification" action at the end of each shortcut with text like "Bus alerts paused!"

---

## Security Note

Your GitHub token is stored in the shortcut on your device. Don't share the shortcut file with anyone, as it contains your token.
