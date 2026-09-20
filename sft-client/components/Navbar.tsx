'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { X, Wallet, User as UserIcon, LogOut } from 'lucide-react';
import { useUserStore } from '@/lib/store';
import NotificationBell from './NotificationBell';
import { connectBNBWallet } from '@/lib/ethereum';
import axios from 'axios';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { CopyButton } from './CopyButton';
import { NetworkSelectionModal } from './NetworkSelectionModal';
import { BNB_MAINNET_PARAMS, TARGET_NETWORK } from '@/lib/ethereum';
import { Modal } from './Modal';

import { Menu } from 'lucide-react';

interface NavbarProps {
    onToggleMobileSidebar?: () => void;
}

const Navbar = ({ onToggleMobileSidebar }: NavbarProps) => {
    const { isConnected, walletAddress, connectWallet, disconnectWallet, token, setToken, setUser, logout: storeLogout, user, activeNetwork, setActiveNetwork } = useUserStore();
    const router = useRouter();
    const pathname = usePathname();
    const [isConnecting, setIsConnecting] = React.useState(false);
    const [showNetworkModal, setShowNetworkModal] = React.useState(false);
    // Removed local activeNetwork state
    const [adminWallet, setAdminWallet] = React.useState<string | null>(null);
    const [isProfileDropdownOpen, setIsProfileDropdownOpen] = React.useState(false);
    const profileDropdownRef = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (profileDropdownRef.current && !profileDropdownRef.current.contains(event.target as Node)) {
                setIsProfileDropdownOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    // Generic Modal State
    const [modalConfig, setModalConfig] = React.useState<{
        isOpen: boolean;
        title: string;
        message: string;
        type: 'info' | 'confirm';
        onConfirm?: () => void;
    }>({
        isOpen: false,
        title: '',
        message: '',
        type: 'info'
    });

    React.useEffect(() => {
        const fetchSettings = async () => {
            try {
                const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
                const axios = await import('axios').then(m => m.default);

                // Fetch Network Settings
                const { data: settingsData } = await axios.get(`${apiBase}/settings`);
                if (settingsData.active_network) {
                    setActiveNetwork(settingsData.active_network);
                    if (settingsData.active_network.adminWallet) {
                        setAdminWallet(settingsData.active_network.adminWallet);
                    }
                } else {
                    setActiveNetwork(null);
                }

                // Fetch Admin Wallet
                try {
                    const { data: walletData } = await axios.get(`${apiBase}/auth/admin-wallet`);
                    setAdminWallet(walletData.walletAddress);
                } catch (e) {
                    console.error("Failed to fetch admin wallet", e);
                }

                // [REMOVED]


            } catch (error) {
                console.error("Failed to load system settings", error);
            }
        };
        fetchSettings();
    }, []);

    React.useEffect(() => {
        const fetchUserProfile = async () => {
            if (token) {
                try {
                    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
                    const axios = await import('axios').then(m => m.default);

                    const { data: userData } = await axios.get(`${apiBase}/auth/me`, {
                        headers: { Authorization: `Bearer ${token}` }
                    });

                    console.log("[Navbar] Fetched fresh user profile:", userData.username);
                    setUser(userData);
                } catch (e: any) {
                    if (e.response?.status === 403 && e.response?.data?.message?.includes('blocked')) {
                        // Suppress console error for blocked users
                        // console.warn("User blocked, logging out...");
                        storeLogout();
                        router.push('/login');
                        return;
                    }
                    console.error("Failed to refresh user profile in Navbar", e);
                }
            }
        };

        fetchUserProfile();
    }, [token]);

    const showModal = (title: string, message: string, type: 'info' | 'confirm' = 'info', onConfirm?: () => void) => {
        setModalConfig({ isOpen: true, title, message, type, onConfirm });
    };

    const closeModal = () => {
        setModalConfig(prev => ({ ...prev, isOpen: false }));
    };

    const handleLogout = () => {
        storeLogout();
        router.push('/');
    };

    const handleConnectClick = () => {
        setShowNetworkModal(true);
    };

    const handleNetworkSelect = async (networkParams: any) => {
        setShowNetworkModal(false);
        setIsConnecting(true);
        try {
            const connectBNBWallet = await import('@/lib/ethereum').then(m => m.connectBNBWallet);
            const address = await connectBNBWallet(networkParams);
            if (address) {
                // Update local state immediately for UI feedback
                connectWallet(address);

                // If logged in, link wallet
                if (token) {
                    try {
                        const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
                        // Dynamically import axios to avoid SSR issues if any
                        const axios = await import('axios').then(m => m.default);
                        await axios.post(`${apiBase}/auth/link-wallet`, {
                            walletAddress: address
                        }, {
                            headers: { Authorization: `Bearer ${token}` }
                        });

                        // [FIX] Update global user state so Profile page updates immediately
                        if (user) {
                            setUser({ ...user, walletAddress: address });
                        }

                        // [NEW] If user is admin, automatically set this network as the Global Receiver Network
                        if (user?.role === 'admin') {
                            try {
                                const payload = {
                                    ...networkParams,
                                    adminWallet: address
                                };
                                await axios.put(`${apiBase}/settings/network`, payload, {
                                    headers: { Authorization: `Bearer ${token}` }
                                });
                                // Update global store immediately
                                setActiveNetwork({ ...networkParams, adminWallet: address });
                                showModal("Success", `Global Receiver Network updated to ${networkParams.chainName}`);
                            } catch (err) {
                                console.error("Failed to auto-update active network", err);
                                // Don't block the connection, just log/warn
                            }
                        }
                    } catch (e: any) {
                        console.error("Link wallet failed", e);
                        // [FIX] Disconnect and show error if linking fails (e.g. duplicate wallet)
                        disconnectWallet();
                        showModal(
                            "Wallet Connection Failed",
                            e.response?.data?.message || "Failed to link wallet. It may be already used by another account.",
                            "info"
                        );
                        return; // Stop execution
                    }
                }
            }
        } catch (error: any) {
            console.error("Connection error:", error);
            showModal("Connection Error", error.message || "Failed to connect wallet");
            // Ensure we don't leave a half-connected state if initial connection failed
            disconnectWallet();
        } finally {
            setIsConnecting(false);
        }
    };

    const handleUnlink = async () => {
        showModal(
            "Confirm Unlink",
            "Are you sure you want to unlink your wallet?",
            "confirm",
            () => executeUnlink()
        );
    };

    const executeUnlink = async () => {
        closeModal();
        try {
            if (token) {
                const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
                const axios = await import('axios').then(m => m.default);
                await axios.post(`${apiBase}/auth/unlink-wallet`, {}, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            }
            // Disconnect from store
            disconnectWallet();

            // Update global user store to reflect removal
            if (user) {
                setUser({ ...user, walletAddress: null });
            }

            showModal("Success", "Wallet unlinked successfully.");
            // Optional: force reload to plain state or relying on store updates
        } catch (error: any) {
            console.error("Unlink failed:", error);
            showModal("Error", "Failed to unlink wallet from account.");
        }
    };

    return (
        <nav className="fixed top-0 w-full z-50 bg-white/80 backdrop-blur-md border-b border-gray-200">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
                <div className="flex items-center justify-between h-16">
                    {/* ... (Logo section) */}
                    {/* Logo Section */}
                    <div className="flex items-center gap-2">

                        {/* Mobile Hamburger Menu - Hide on Home Page */}
                        {pathname !== '/' && (
                            <button
                                onClick={onToggleMobileSidebar}
                                className="md:hidden p-2 text-muted-foreground hover:bg-secondary rounded-lg transition-colors"
                            >
                                <Menu className="w-6 h-6" />
                            </button>
                        )}

                        <Link href="/" className="flex items-center gap-2">
                            <div className="relative w-10 h-10">
                                <Image
                                    src="/logo/sft_logo.png"
                                    alt="SFT Logo"
                                    fill
                                    className="object-contain"
                                />
                            </div>
                            <span className="text-2xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                                SFT
                            </span>
                        </Link>
                        {/* Nav links removed */}
                    </div>

                    {/* Right Side Actions */}
                    <div>
                        {!token ? (
                            <div className="flex items-center gap-4">
                                <Link href="/login" className="text-muted hover:text-foreground px-3 py-2 text-sm font-medium">Login</Link>
                                <Link href="/signup" className="bg-primary hover:bg-primary/90 text-white font-bold py-2 px-4 rounded-full transition-all shadow-lg shadow-primary/30">Sign Up</Link>
                            </div>
                        ) : (
                            <div className="flex items-center gap-4">
                                {/* Admin/Receiver Network Indicator - Only show for non-admins */}
                                {user?.role !== 'admin' && (
                                    <div className="hidden lg:flex flex-col items-start gap-0.5 px-3 py-1 rounded-lg bg-secondary border border-gray-200 text-[10px] min-w-[140px]">

                                        {/* Network Part */}
                                        <div className="flex items-center gap-2 w-full justify-between">
                                            <span className="text-muted">Receiver Network:</span>
                                            <span className={`font-bold ${activeNetwork ? 'text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-400' : 'text-gray-500'}`}>
                                                {activeNetwork ? activeNetwork.chainName : '_____'}
                                            </span>
                                        </div>

                                        {/* Wallet Address Part (New Line) */}
                                        <div className="w-full border-t border-gray-200 pt-0.5 mt-0.5">
                                            {adminWallet && !adminWallet.startsWith('PENDING_') && !adminWallet.startsWith('ADMIN_') ? (
                                                <div className="flex items-center justify-between gap-2">
                                                    <span className="text-foreground font-mono text-[9px]">
                                                        {adminWallet.slice(0, 6)}...{adminWallet.slice(-6)}
                                                    </span>
                                                    <div className="scale-75 origin-right">
                                                        <CopyButton text={adminWallet} />
                                                    </div>
                                                </div>
                                            ) : (
                                                <div className="flex items-center justify-between">
                                                    <span className="text-gray-400 italic text-[9px]">No Wallet</span>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                )}

                                {!isConnected ? (
                                    <button
                                        onClick={handleConnectClick}
                                        disabled={isConnecting}
                                        className="bg-primary hover:bg-accent text-primary-foreground font-bold py-2 px-4 rounded-full transition-all text-sm disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-primary/20"
                                    >
                                        {isConnecting ? 'Connecting...' : 'Link Wallet'}
                                    </button>
                                ) : (
                                    <div className="hidden md:flex items-center gap-2">
                                        <span className="text-sm text-foreground font-mono bg-secondary/10 px-2 py-1 rounded border border-gray-200 flex items-center gap-2">
                                            {walletAddress?.slice(0, 4)}...{walletAddress?.slice(-4)}
                                            <CopyButton text={walletAddress || ''} />
                                        </span>
                                        <button
                                            onClick={handleUnlink}
                                            className="text-red-600 hover:text-red-700 text-xs border border-red-200 px-2 py-1 rounded hover:bg-red-50 transition-colors"
                                            title="Unlink Wallet"
                                        >
                                            Unlink
                                        </button>
                                    </div>
                                )}

                                {/* Notification Bell */}
                                {user && <NotificationBell />}

                                {/* Profile Dropdown */}
                                <div className="relative ml-2" ref={profileDropdownRef}>
                                    <button
                                        onClick={() => setIsProfileDropdownOpen(!isProfileDropdownOpen)}
                                        className="flex items-center gap-2 focus:outline-none text-muted hover:text-foreground transition-colors"
                                    >
                                        <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/10 flex items-center justify-center overflow-hidden">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="lucide lucide-user text-primary"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                                        </div>
                                    </button>

                                    {/* Dropdown Menu */}
                                    {isProfileDropdownOpen && (
                                        <div className="absolute right-0 mt-2 w-48 py-2 bg-white border border-gray-200 rounded-xl shadow-xl z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                                            <div className="px-4 py-2 border-b border-gray-100 mb-1">
                                                <p className="text-sm font-medium text-foreground truncate">
                                                    {user?.role === 'admin' ? 'Admin' : (user?.username || 'User')}
                                                </p>
                                                <p className="text-xs text-muted truncate">{user?.email}</p>
                                            </div>

                                            <Link
                                                href="/profile"
                                                onClick={() => setIsProfileDropdownOpen(false)}
                                                className="block px-4 py-2 text-sm text-muted hover:bg-secondary hover:text-foreground transition-colors flex items-center gap-2"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>
                                                Profile
                                            </Link>

                                            <button
                                                onClick={() => {
                                                    setIsProfileDropdownOpen(false);
                                                    handleLogout();
                                                }}
                                                className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 transition-colors flex items-center gap-2"
                                            >
                                                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" x2="9" y1="12" y2="12" /></svg>
                                                Logout
                                            </button>
                                        </div>
                                    )}
                                </div>

                            </div>
                        )}
                    </div>
                </div>
            </div>
            <NetworkSelectionModal
                isOpen={showNetworkModal}
                onClose={() => setShowNetworkModal(false)}
                onSelectNetwork={handleNetworkSelect}
            />
            <Modal
                isOpen={modalConfig.isOpen}
                onClose={closeModal}
                title={modalConfig.title}
                footer={
                    modalConfig.type === 'confirm' ? (
                        <>
                            <button
                                onClick={closeModal}
                                className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg transition-colors text-sm"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={modalConfig.onConfirm}
                                className="bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white px-4 py-2 rounded-lg transition-all shadow-lg shadow-red-500/20 text-sm font-semibold"
                            >
                                Confirm
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={closeModal}
                            className="bg-white/10 hover:bg-white/20 text-white px-4 py-2 rounded-lg transition-colors text-sm"
                        >
                            Close
                        </button>
                    )
                }
            >
                <div>
                    <p className="text-gray-300">{modalConfig.message}</p>
                </div>
            </Modal>
        </nav>
    );
};

export default Navbar;
