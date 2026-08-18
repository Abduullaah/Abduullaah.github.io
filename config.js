/* config.js — deployment configuration.
   The Firebase web config is safe to publish: it only names the project. Access is controlled by
   your PIN (the password of ownerEmail in Firebase Authentication) and by firestore.rules.
*/
window.FLOWORK_CONFIG = {
  firebase: {
    apiKey: "AIzaSyCEyQnrKbzxyP_dDL9doceyb0hrQ4ta6cU",
    authDomain: "flowork-backstage.firebaseapp.com",
    projectId: "flowork-backstage",
    storageBucket: "flowork-backstage.firebasestorage.app",
    messagingSenderId: "1079573785194",
    appId: "1:1079573785194:web:9534ab35389558e3ec7813",
  },
  ownerEmail: "podcast@flowork.me",   // the Firebase user whose password is your PIN
  workspace: {},
};
