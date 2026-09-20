'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useUserStore } from '@/lib/store';
import {
    LayoutDashboard,
    TrendingUp,
    ClipboardList,
    User,
    Users,
    UserPlus,
    Settings,
    FileStack,
    ChevronLeft,
    ChevronRight,
    ArrowLeftRight,
    Bitcoin,
    ShieldCheck,
    BadgeDollarSign,
    Coins
} from 'lucide-react';

import { createPortal } from 'react-dom';

interface SidebarProps {
    isCollapsed: boolean;
    toggleSidebar: () => void;
    isMobileOpen?: boolean;
    onMobileClose?: () => void;
}

const Sidebar = ({ isCollapsed, toggleSidebar, isMobileOpen = false, onMobileClose }: SidebarProps) => {
    const pathname = usePathname();
    const { user, token } = useUserStore();

    // State for tooltip
    const [hoveredItem, setHoveredItem] = React.useState<{ name: string; top: number } | null>(null);

    if (!token) return null;

    const isActive = (path: string) => pathname === path;

    const navItems = [
        {
            name: 'Dashboard',
            href: '/dashboard',
            icon: LayoutDashboard,
            roles: ['user', 'admin']
        },
        {
            name: 'Invest',
            href: '/invest',
            icon: TrendingUp,
            roles: ['user']
        },
        {
            name: 'Token Swap',
            href: '/swap',
            icon: ArrowLeftRight,
            roles: ['user']
        },
        {
            name: 'Requests',
            href: '/requests',
            icon: ClipboardList,
            roles: ['user']
        },
        {
            name: 'Profile',
            href: '/profile',
            icon: User,
            roles: ['user', 'admin']
        },
        {
            name: 'My Team',
            href: '/referrals/team',
            icon: Users,
            roles: ['user']
        },
        {
            name: 'Earnings',
            href: '/earnings',
            icon: Coins,
            roles: ['user']
        },
        // {
        //     name: 'Pending Placements',
        //     href: '/referrals/pending',
        //     icon: UserPlus,
        //     roles: ['user']
        // },
        {
            name: 'Admin Requests', // Distinguish from User Requests in text, but icon helps
            href: '/admin',
            icon: FileStack,
            roles: ['admin']
        },
        {
            name: 'Investing Plans',
            href: '/admin/plans',
            icon: Settings,
            roles: ['admin']
        },
        {
            name: 'User Management',
            href: '/admin/users',
            icon: Users,
            roles: ['admin']
        },
        {
            name: 'Income Settings',
            href: '/admin/settings/income',
            icon: BadgeDollarSign,
            roles: ['admin']
        },
        {
            name: 'Audit Logs',
            href: '/admin/audit-logs',
            icon: ShieldCheck,
            roles: ['admin']
        },
    ];

    const filteredItems = navItems.filter(item => item.roles.includes(user?.role || 'user'));

    // Determine effective expanded state: Always expanded if mobile menu is open, otherwise respect isCollapsed prop
    const isExpanded = !isCollapsed || isMobileOpen;

    return (
        <>
            {/* Mobile Backdrop */}
            {isMobileOpen && (
                <div
                    className="fixed inset-0 z-[45] bg-black/50 md:hidden backdrop-blur-sm transition-opacity"
                    onClick={onMobileClose}
                />
            )}

            <aside
                className={`fixed top-0 left-0 h-full bg-background border-r border-gray-200 overflow-y-auto z-50 flex flex-col transition-all duration-300 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none] 
                    ${isCollapsed ? 'md:w-20' : 'md:w-64'}
                    ${isMobileOpen ? 'translate-x-0 w-64' : '-translate-x-full md:translate-x-0'}
                    md:top-16 md:h-[calc(100vh-64px)]
                `}
            >
                {/* Toggle Button at the top */}
                <div className="p-4 border-b border-gray-200">
                    <button
                        onClick={isMobileOpen ? onMobileClose : toggleSidebar}
                        className="flex items-center justify-center w-full p-2 rounded-lg text-muted hover:bg-secondary hover:text-foreground transition-colors"
                    >
                        {(isCollapsed && !isMobileOpen) ? <ChevronRight className="w-5 h-5" /> : <ChevronLeft className="w-5 h-5" />}
                    </button>
                </div>

                <div className="flex-1 p-4 space-y-2">
                    {filteredItems.map((item) => {
                        const active = isActive(item.href);
                        return (
                            <Link
                                key={item.href}
                                href={item.href}
                                onMouseEnter={(e) => {
                                    // Only show tooltip if collapsed AND not in mobile mode
                                    if (!isExpanded) {
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        setHoveredItem({ name: item.name, top: rect.top + rect.height / 2 });
                                    }
                                }}
                                onMouseLeave={() => setHoveredItem(null)}
                                className={`flex items-center ${!isExpanded ? 'justify-center px-0' : 'justify-start px-4'} py-3 rounded-xl transition-all duration-200 group relative ${active
                                    ? 'bg-primary/10 text-primary border border-primary/20'
                                    : 'text-muted hover:text-foreground hover:bg-secondary'
                                    }`}
                            >
                                <item.icon
                                    className={`w-5 h-5 flex-shrink-0 ${active
                                        ? 'text-primary'
                                        : 'text-muted group-hover:text-primary transition-colors'
                                        }`}
                                />

                                {isExpanded && (
                                    <>
                                        <span className="font-medium text-sm ml-3 truncate transition-opacity duration-300">
                                            {item.name}
                                        </span>
                                        {active && (
                                            <div className="ml-auto w-1.5 h-1.5 rounded-full bg-primary shadow-[0_0_8px_rgba(212,175,55,0.6)] animate-pulse" />
                                        )}
                                    </>
                                )}
                            </Link>
                        );
                    })}
                </div>
            </aside>

            {/* Portal Tooltip - Only show if truly collapsed (not expanded via mobile) */}
            {isCollapsed && !isMobileOpen && hoveredItem && typeof document !== 'undefined' && createPortal(
                <div
                    className="fixed left-20 z-[9999] px-3 py-1.5 ml-2 text-xs font-medium text-white bg-gray-900 border border-gray-700 rounded-md shadow-xl pointer-events-none animate-in fade-in zoom-in-95 duration-200"
                    style={{ top: hoveredItem.top, transform: 'translateY(-50%)' }}
                >
                    {hoveredItem.name}
                    {/* Arrow */}
                    <div className="absolute top-1/2 -left-1 -translate-y-1/2 w-2 h-2 bg-gray-900 border-l border-b border-gray-700 transform rotate-45" />
                </div>,
                document.body
            )}
        </>
    );
};

export default Sidebar;
