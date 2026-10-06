# Neighbourly

Neighbourly is a public community help board for lending, requests, tutoring, and rides. Visitors can browse without signing in. Posting creates a private Firebase anonymous guest session in the background; it does not require a Google account and does not expose an email address.

## Trust and safety features

- Firestore rules validate post fields and prevent editing or deleting board posts from the public website.
- A guest session can post once per minute. The cooldown is enforced by Firestore rules, not just by the page.
- Visitors can report a post once per guest session. Reports are private; the Firebase project owner can review them in the Firebase Console under Firestore → `reports` and remove harmful content from the console.
- Posters can choose to include a block and room number; both are optional and are shown publicly on the post. The form warns people not to publish phone numbers, home addresses, or other sensitive details.

These safeguards reduce casual abuse but do not verify a person's real-world identity. A moderator should review reports and periodically remove outdated posts.

## Set up public access and posting

1. Create a Firebase project at [Firebase Console](https://console.firebase.google.com/) and add a **Web app**.
2. In **Authentication → Sign-in method**, enable **Anonymous**. Google sign-in is not used.
3. In **Firestore Database**, create a database, then publish the included `firestore.rules` in Firestore → Rules.
4. Copy the Firebase web app config from **Project settings → Your apps** into the `firebaseConfig` object at the top of `app.js`, replacing the `YOUR_...` values. Firebase web config is designed to appear in a website; the Firestore rules protect the data.
5. From this folder, associate it with your Firebase project using the Firebase CLI (`firebase use --add`), then deploy Hosting and the included rules (`firebase deploy --only hosting,firestore:rules`). The included `firebase.json` serves this folder. Add the resulting host domain under **Authentication → Settings → Authorized domains** if it is not already listed.
6. Open the hosted page in a private browser window. Confirm that visitors can browse, post once, see the new note appear, wait 60 seconds before posting again, and report a note.

Firebase must be connected before the shared public board and guest posting are available. Until then, the page displays the site design and explains that setup is needed when someone tries to post.

## Local preview

Serve this folder over HTTP/HTTPS because `app.js` uses browser modules. Opening the HTML directly as a `file://` URL will not load its Firebase modules. No build step is required.
