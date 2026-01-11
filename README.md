# BookTracker PWA

A Progressive Web App for tracking your reading progress and competing with friends. Can be installed on any device and works offline!

## Features

- 📚 **Track Books** - Add books via search, barcode scan, or manual entry
- 📖 **Reading Progress** - Track pages read with visual progress indicators  
- 🏆 **Shared Leaderboard** - Compete with friends in real-time
- 📱 **Install to Home Screen** - Works like a native app
- 🔄 **Offline Support** - Use the app without internet
- 💾 **Local + Cloud Storage** - Data synced via Firebase

## Quick Start

### Step 1: Set Up Firebase (Free - for shared leaderboard)

1. Go to [Firebase Console](https://console.firebase.google.com)
2. Click **"Create a project"** (or use an existing one)
3. Give it a name like "booktracker" and continue
4. Disable Google Analytics (optional) → Create Project
5. Once created, click **"Web"** icon (</>) to add a web app
6. Give it a nickname and click **Register app**
7. Copy the config values shown

Now enable the database:
1. In the left sidebar, click **"Build" → "Realtime Database"**
2. Click **"Create Database"**
3. Choose a location → **Next**
4. Select **"Start in test mode"** → **Enable**

### Step 2: Add Your Firebase Config

Open `app.js` and replace the placeholder config at the top:

```javascript
const FIREBASE_CONFIG = {
    apiKey: "AIzaSy...",           // Your API key
    authDomain: "your-project.firebaseapp.com",
    databaseURL: "https://your-project-default-rtdb.firebaseio.com",
    projectId: "your-project",
    storageBucket: "your-project.appspot.com",
    messagingSenderId: "123456789",
    appId: "1:123456789:web:abc123"
};
```

### Step 3: Deploy to GitHub Pages

1. Create a new GitHub repository
2. Upload all files from this folder
3. Go to Settings → Pages → Select "main" branch → Save
4. Wait 2 minutes, then visit: `https://YOUR-USERNAME.github.io/REPO-NAME/`

### Step 4: Share with Friends

Send your friend the URL! When they:
1. Open the link
2. Go to Profile → Edit Profile → Set their name
3. Add books and update progress

...they'll automatically appear on your leaderboard in real-time!

## Installing on Devices

### iOS (iPhone/iPad)
1. Open the URL in Safari
2. Tap the **Share** button (square with arrow)
3. Scroll down and tap **"Add to Home Screen"**
4. Tap **Add**

### Android
1. Open the URL in Chrome
2. Tap the **three dots** menu
3. Tap **"Add to Home screen"** or **"Install app"**
4. Tap **Add**

## How the Leaderboard Sync Works

- Each user's stats (name, pages read, books completed) are stored in Firebase
- When you add a book, update progress, or change your name, it syncs automatically
- The leaderboard listens for changes in real-time - no refresh needed!
- Book data stays local (only stats are shared, not your book list)

## File Structure

```
BookTrackerPWA/
├── index.html      # Main HTML file
├── styles.css      # All styles
├── app.js          # Application logic + Firebase
├── manifest.json   # PWA configuration
├── sw.js           # Service worker (offline support)
└── icons/          # App icons
```

## Customization

### Changing Colors
Edit `styles.css` and modify the CSS variables:
```css
:root {
    --primary: #4A90A4;      /* Main accent color */
    --secondary: #D4B896;    /* Secondary/tan color */
}
```

### Changing the Icon
Replace the images in the `icons/` folder with your own

## Privacy

- Book details (titles, authors, etc.) stay on your device only
- Only your name and reading stats are synced to Firebase
- Firebase data is accessible to anyone with the database URL (in test mode)
- For production, add Firebase security rules

## Troubleshooting

**Leaderboard shows "Set up Firebase to sync"**
- Make sure you replaced the config in app.js
- Check browser console for errors
- Verify your Firebase database is in "test mode"

**Books not adding**
- Check if the book is already in your library
- Try using manual entry if search doesn't work

**Camera not working for barcode scan**
- Make sure you granted camera permission
- Barcode detection only works in Chrome/Edge
- Use manual entry on unsupported browsers

## License

MIT License - use however you want!
