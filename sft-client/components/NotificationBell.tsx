"use client";

import { useState, useEffect, useRef } from 'react';
import { Bell, Check } from 'lucide-react';
import axios from 'axios';
import { useUserStore } from '@/lib/store';
import { formatDistanceToNow } from 'date-fns';

interface Notification {
    _id: string;
    title: string;
    body: string;
    type: 'INFO' | 'SUCCESS' | 'WARNING' | 'ERROR';
    createdAt: string;
    isRead: boolean;
}

const NotificationBell = () => {
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const [count, setCount] = useState(0);
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const { token } = useUserStore(); // [NEW] Get token from store

    // Debug log to verify token presence
    useEffect(() => {
        if (process.env.NODE_ENV === 'development') {
            console.log('[NotificationBell] Current Token:', token ? token.substring(0, 10) + '...' : 'None');
        }
    }, [token]);

    const fetchNotifications = async () => {
        try {
            // Token is now from store hook
            if (!token) return;

            const res = await axios.get(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/notifications/unread`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setNotifications(res.data.notifications);
            setCount(res.data.count);
        } catch (error) {
            console.error('Error fetching notifications:', error);
        }
    };

    const markRead = async (ids: string[] = []) => {
        try {
            // Token is now from store hook
            if (!token) return;

            await axios.put(`${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/notifications/read`,
                { notificationIds: ids },
                { headers: { Authorization: `Bearer ${token}` } }
            );

            // Refresh list
            fetchNotifications();
        } catch (error) {
            console.error('Error marking read:', error);
        }
    };

    // Polling every 10 seconds to keep fresh (simple real-time substitute)
    useEffect(() => {
        fetchNotifications();
        fetchNotifications();
        const interval = setInterval(fetchNotifications, 60000);
        return () => clearInterval(interval);
    }, [token]);

    // Close on click outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const getTypeColor = (type: string) => {
        switch (type) {
            case 'SUCCESS': return 'text-green-500 bg-green-500/10';
            case 'WARNING': return 'text-yellow-500 bg-yellow-500/10';
            case 'ERROR': return 'text-red-500 bg-red-500/10';
            default: return 'text-blue-500 bg-blue-500/10';
        }
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="relative p-2 rounded-full hover:bg-muted text-gray-500 hover:text-foreground transition-colors"
                aria-label="Notifications"
            >
                <Bell size={20} />
                {count > 0 && (
                    <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500"></span>
                    </span>
                )}
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-80 md:w-96 bg-white border border-gray-100 shadow-2xl rounded-2xl z-50 overflow-hidden ring-1 ring-black/5">
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100 bg-gray-50/50">
                        <h3 className="font-semibold text-sm">Notifications</h3>
                        <div className="flex items-center gap-2">
                            {/* <button
                                onClick={async (e) => {
                                    e.stopPropagation();
                                    try {
                                        if (!token) {
                                            alert("No login token found in store. Please log in.");
                                            return;
                                        }

                                        // Robust Base URL Construction
                                        let baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

                                        // Remove trailing slash if present
                                        if (baseUrl.endsWith('/')) {
                                            baseUrl = baseUrl.slice(0, -1);
                                        }

                                        // Ensure '/api' is present if not already in baseUrl
                                        // This handles cases where user sets env to 'http://localhost:5000' without /api
                                        if (!baseUrl.endsWith('/api')) {
                                            baseUrl = `${baseUrl}/api`;
                                        }

                                        const url = `${baseUrl}/notifications/send`;

                                        console.log("[TestPush] Sending to:", url);

                                        await axios.post(url,
                                            { title: 'Test Push', body: 'If you see this, push notifications are working!' },
                                            { headers: { Authorization: `Bearer ${token}` } }
                                        );
                                        // Refresh to show the new DB notification
                                        fetchNotifications();
                                        alert("Test Notification Sent! Check your connection.");
                                    } catch (err: any) {
                                        console.error("Test Push Error:", err);
                                        console.error("Test Push URL was:", `${process.env.NEXT_PUBLIC_API_URL || 'default'}/notifications/send`);
                                        if (err.response && err.response.status === 401) {
                                            alert("Auth Error: Your session may have expired. Please login again.");
                                        } else if (err.response && err.response.status === 404) {
                                            alert("Error: Push Notification service not reachable (404).");
                                        } else {
                                            alert(`Failed to send test push: ${err.message}`);
                                        }
                                    }
                                }}
                                className="text-[10px] bg-blue-50 text-blue-600 px-2 py-1 rounded border border-blue-100 hover:bg-blue-100"
                                title="Send a test push notification to yourself"
                            >
                                Test Push
                            </button> */}
                            {count > 0 && (
                                <button
                                    onClick={() => markRead([])}
                                    className="text-xs text-primary hover:text-primary/80 flex items-center gap-1"
                                >
                                    <Check size={12} /> Mark all read
                                </button>
                            )}
                        </div>
                    </div>

                    <div className="max-h-[70vh] overflow-y-auto">
                        {notifications.length === 0 ? (
                            <div className="p-8 text-center text-muted-foreground text-sm">
                                No new notifications
                            </div>
                        ) : (
                            <div>
                                {notifications.map((notif) => (
                                    <div
                                        key={notif._id}
                                        className="p-4 border-b last:border-0 hover:bg-muted/50 cursor-default transition-colors"
                                    >
                                        <div className="flex gap-3 items-start">
                                            <div className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${getTypeColor(notif.type).split(' ')[0]}`} />
                                            <div className="flex-1 space-y-1">
                                                <p className="text-sm font-medium leading-none">{notif.title}</p>
                                                <p className="text-xs text-muted-foreground line-clamp-2">
                                                    {notif.body}
                                                </p>
                                                <div className="flex justify-between items-center mt-2">
                                                    <span className="text-[10px] text-muted-foreground">
                                                        {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true })}
                                                    </span>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            markRead([notif._id]);
                                                        }}
                                                        className="text-[10px] hover:underline opacity-50 hover:opacity-100"
                                                    >
                                                        Mark read
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="p-2 border-t border-gray-100 bg-gray-50/50 text-center">
                        <button onClick={() => setIsOpen(false)} className="text-xs text-muted-foreground hover:text-foreground">
                            Close
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default NotificationBell;
