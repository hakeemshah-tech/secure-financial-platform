'use client';

import React, { useEffect, useState } from 'react';
import Navbar from './Navbar';
import Sidebar from './Sidebar';
import { useUserStore } from '@/lib/store';
import { usePathname, useRouter } from 'next/navigation';

export default function ClientPageLayout({ children }: { children: React.ReactNode }) {
    const { token, _hasHydrated, user } = useUserStore();
    const [mounted, setMounted] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(true);
    const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
    const pathname = usePathname();
    const router = useRouter(); // Import useRouter

    useEffect(() => {
        // Restricted paths for admins
        const restrictedPaths = ['/invest', '/referrals/team', '/referrals/pending'];

        // Check if user is admin and trying to access a restricted path
        if (token && user?.role === 'admin') {
            const isRestricted = restrictedPaths.some(path =>
                pathname === path || pathname.startsWith(`${path}/`)
            );

            if (isRestricted) {
                router.replace('/admin');
            }
        }
    }, [pathname, user, token, router]);

    useEffect(() => {
        setMounted(true);
    }, []);

    // Close mobile sidebar on route change
    useEffect(() => {
        setIsMobileSidebarOpen(false);
    }, [pathname]);

    // If not hydrated yet, we can show a loader or just render nothing/basic layout to avoid mismatch
    // But since we are client-side only for this logic, checking mounted is safe.

    // We determine if sidebar is shown based on authentication AND not being on homepage
    const showSidebar = mounted && !!token && pathname !== '/';

    return (
        <div className="min-h-screen flex flex-col">
            <Navbar onToggleMobileSidebar={() => setIsMobileSidebarOpen(prev => !prev)} />

            <div className="flex-1 flex pt-16 overflow-hidden">
                {/* Sidebar - only rendered if logged in */}
                {showSidebar && (
                    <Sidebar
                        isCollapsed={isCollapsed}
                        toggleSidebar={() => setIsCollapsed(!isCollapsed)}
                        isMobileOpen={isMobileSidebarOpen}
                        onMobileClose={() => setIsMobileSidebarOpen(false)}
                    />
                )}

                {/* Main Content Area */}
                {/* 
                    If sidebar is valid (token exists), we add margin on desktop.
                    If not, it's centered as before.
                */}
                <main
                    className={`
                        flex-1 
                        min-w-0
                        px-4 sm:px-6 lg:px-8 
                        w-full
                        overflow-x-hidden
                        transition-all duration-300
                        ${showSidebar
                            ? (isCollapsed ? 'md:ml-20' : 'md:ml-64')
                            : 'max-w-7xl mx-auto'
                        }
                    `}
                >
                    {children}
                </main>
            </div>
        </div>
    );
}
