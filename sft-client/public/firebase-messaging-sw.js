importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

// A service worker is a static asset: it is served verbatim and cannot read the Next.js
// build-time environment. Configuration is therefore passed in as query parameters when
// the worker is registered, e.g.
//
//   navigator.serviceWorker.register(`/firebase-messaging-sw.js?${new URLSearchParams(cfg)}`)
//
// Committing the values here instead would publish the messaging project identifiers in a
// world-readable file at a well-known path.
const params = new URLSearchParams(self.location.search);

const firebaseConfig = {
    apiKey: params.get('apiKey'),
    authDomain: params.get('authDomain'),
    projectId: params.get('projectId'),
    storageBucket: params.get('storageBucket'),
    messagingSenderId: params.get('messagingSenderId'),
    appId: params.get('appId'),
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Received background message ', payload);
    const notificationTitle = payload.notification.title;
    const notificationOptions = {
        body: payload.notification.body,
        icon: '/logo.png', // Ensure you have a logo.png in public folder
    };

    self.registration.showNotification(notificationTitle, notificationOptions);
});
