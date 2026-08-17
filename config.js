/* config.js — deployment configuration.
   Cloud sync is optional. Leave `firebase` as null and Backstage runs on the device it's opened on.
   To sync every device: paste your Firebase web config here (or use Settings → Cloud sync inside the app,
   which stores it on that device only). Web API keys are safe to publish — access is enforced by
   Firestore rules + your PIN (see firestore.rules).
*/
window.FLOWORK_CONFIG = {
  firebase: null,
  /* example:
  firebase: {
    apiKey: "AIza...",
    authDomain: "flowork-backstage.firebaseapp.com",
    projectId: "flowork-backstage",
    storageBucket: "flowork-backstage.appspot.com",
    messagingSenderId: "1234567890",
    appId: "1:1234567890:web:abcdef",
  },
  */
  ownerEmail: "",            // the Firebase user whose password is your PIN
  workspace: {},
};
