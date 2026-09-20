import { useEffect, useState } from 'react';
import { messaging, registerMessagingServiceWorker } from '../lib/firebase';
import { getToken, onMessage } from 'firebase/messaging';
import axios from 'axios';
import { useUserStore } from '@/lib/store'; // [NEW] Import store
import { useRouter } from 'next/navigation';

const useFcmToken = () => {
    const [token, setToken] = useState<string | null>(null);
    const [notificationPermissionStatus, setNotificationPermissionStatus] = useState<NotificationPermission>('default');
    const { token: authToken, logout } = useUserStore(); // [NEW] Get auth token from store
    const router = useRouter();

    useEffect(() => {
        const retrieveToken = async () => {
            try {
                if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
                    const msg = await messaging();
                    if (!msg) return;

                    const permission = await Notification.requestPermission();
                    setNotificationPermissionStatus(permission);

                    if (permission === 'granted') {
                        // Registered explicitly so the worker receives its configuration;
                        // the default auto-registration would load it without parameters.
                        const swRegistration = await registerMessagingServiceWorker();

                        const currentToken = await getToken(msg, {
                            vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY,
                            serviceWorkerRegistration: swRegistration,
                        });
                        if (currentToken) {
                            console.log('FCM Token:', currentToken);
                            setToken(currentToken);
                        } else {
                            console.log('No registration token available. Request permission to generate one.');
                        }
                    }
                }
            } catch (error) {
                console.log('An error occurred while retrieving token:', error);
            }
        };

        retrieveToken();
    }, []);

    // [NEW] Effect to save token to backend whenever we have BOTH fcmToken AND authToken
    useEffect(() => {
        const save = async () => {
            if (token && authToken) {
                await saveTokenToBackend(token, authToken);
            }
        };
        save();
    }, [token, authToken]);

    useEffect(() => {
        const handleForegroundMessage = async () => {
            try {
                const msg = await messaging();
                if (!msg) return;

                onMessage(msg, (payload) => {
                    console.log('Foreground message received:', payload);

                    // [NEW] Check for Force Logout
                    if (payload.data && payload.data.type === 'FORCE_LOGOUT') {
                        console.log('Force Logout Signal Received');
                        logout();
                        router.push('/login');
                        return;
                    }

                    if (Notification.permission === "granted") {
                        new Notification(payload.notification?.title || "New Message", {
                            body: payload.notification?.body,
                            icon: "/logo.png"
                        });
                    }
                });
            } catch (error) {
                console.error("Error setting up foreground message listener:", error);
            }
        }
        handleForegroundMessage();
    }, [token, logout, router]);

    return { fcmToken: token, notificationPermissionStatus };
};

const saveTokenToBackend = async (fcmToken: string, authToken: string) => {
    console.log('[useFcmToken] Attempting to save token to backend...');
    try {
        // Robust Base URL Construction
        let baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

        // Remove trailing slash if present
        if (baseUrl.endsWith('/')) {
            baseUrl = baseUrl.slice(0, -1);
        }

        // Ensure '/api' is present if not already in baseUrl
        if (!baseUrl.endsWith('/api')) {
            baseUrl = `${baseUrl}/api`;
        }

        const url = `${baseUrl}/notifications/subscribe`;
        console.log('[useFcmToken] POST URL:', url);

        await axios.post(url, {
            fcmToken: fcmToken,
        }, {
            headers: {
                Authorization: `Bearer ${authToken}`
            }
        });
        console.log('[useFcmToken] ✅ FCM token sent/saved to server successfully');
    } catch (error: any) {
        console.error('[useFcmToken] ❌ Error sending FCM token to server:', error);
        if (error.response) {
            console.error('[useFcmToken] Server Response:', error.response.status, error.response.data);
        }
    }
}

export default useFcmToken;
