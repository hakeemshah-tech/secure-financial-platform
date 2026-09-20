import { initializeApp, getApps, getApp } from 'firebase/app';
import { getMessaging, isSupported } from 'firebase/messaging';

// Project-specific identifiers are supplied entirely by the environment. No fallback
// literals are committed: a missing variable must fail loudly at configuration time
// rather than silently binding the app to someone else's messaging project.
const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Presence check only. The configuration object itself is never logged, since it would
// otherwise be written verbatim into the browser console on every page load.
if (process.env.NODE_ENV !== 'production') {
    const missing = Object.entries(firebaseConfig)
        .filter(([, value]) => !value)
        .map(([key]) => key);

    if (missing.length > 0) {
        console.warn('Firebase configuration incomplete. Missing keys:', missing.join(', '));
    }
}

// Initialize Firebase
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

const messaging = async () => {
    const supported = await isSupported();
    return supported ? getMessaging(app) : null;
};

/**
 * Registers the background-messaging service worker, passing the Firebase configuration
 * as query parameters. The worker is a static asset and cannot read the build environment,
 * so the values are handed to it at registration time instead of being committed to
 * `public/firebase-messaging-sw.js`.
 */
const registerMessagingServiceWorker = async (): Promise<ServiceWorkerRegistration | undefined> => {
    if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return undefined;

    const params = new URLSearchParams(
        Object.entries(firebaseConfig).filter(([, value]) => Boolean(value)) as [string, string][]
    );

    return navigator.serviceWorker.register(`/firebase-messaging-sw.js?${params.toString()}`);
};

export { app, messaging, firebaseConfig, registerMessagingServiceWorker };
