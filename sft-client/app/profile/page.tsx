'use client';

import React, { useState, useEffect } from 'react';
import { useUserStore } from '@/lib/store';
import axios from 'axios';

import { useRouter } from 'next/navigation';
import { Spinner } from '@/components/Spinner';
import { CopyButton } from '@/components/CopyButton';
import { EmailVerificationModal } from '@/components/EmailVerificationModal';
import { ChangeEmailModal } from '@/components/ChangeEmailModal';
import { ChangePasswordModal } from '@/components/ChangePasswordModal';

export default function ProfilePage() {
    const { user, token, _hasHydrated, disconnectWallet, setUser } = useUserStore();
    const router = useRouter();
    const [profileData, setProfileData] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [activeNetwork, setActiveNetwork] = useState<any>(null);
    const [adminWallet, setAdminWallet] = useState<string | null>(null);
    const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false);
    const [isChangeEmailModalOpen, setIsChangeEmailModalOpen] = useState(false);
    const [isChangePasswordModalOpen, setIsChangePasswordModalOpen] = useState(false);

    // Fetch Profile and System Settings
    useEffect(() => {
        if (!_hasHydrated) return;

        if (!token) {
            router.push('/login');
            return;
        }

        const loadData = async () => {
            try {
                const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

                // Parallel fetch for efficiency
                const [profileRes, settingsRes, adminWalletRes] = await Promise.allSettled([
                    axios.get(`${apiBase}/auth/me`, { headers: { Authorization: `Bearer ${token}` } }),
                    axios.get(`${apiBase}/settings`),
                    axios.get(`${apiBase}/auth/admin-wallet`)
                ]);

                // Handle Profile
                if (profileRes.status === 'fulfilled') {
                    setProfileData(profileRes.value.data);
                } else {
                    console.error('Failed to fetch profile', profileRes.reason);
                    if (user) setProfileData(user);
                }

                // Handle Settings
                if (settingsRes.status === 'fulfilled' && settingsRes.value.data.active_network) {
                    setActiveNetwork(settingsRes.value.data.active_network);
                }

                // Handle Admin Wallet
                if (adminWalletRes.status === 'fulfilled') {
                    setAdminWallet(adminWalletRes.value.data.walletAddress);
                }

            } catch (error) {
                console.error('Error loading data', error);
            } finally {
                setLoading(false);
            }
        };

        loadData();
    }, [token, router, _hasHydrated, user]);

    const handleUnlink = async () => {
        try {
            if (token) {
                const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
                await axios.post(`${apiBase}/auth/unlink-wallet`, {}, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            }
            // Disconnect from store
            disconnectWallet();
            // Update local state to reflect removal
            setProfileData((prev: any) => ({ ...prev, walletAddress: null }));

            // Update global user store to reflect removal
            if (user) {
                setUser({ ...user, walletAddress: null });
            }


            // Re-fetch or manually update profileData to remove wallet
            if (profileData) {
                setProfileData({ ...profileData, walletAddress: null });
            }

            alert("Wallet unlinked successfully.");
        } catch (error) {
            console.error("Unlink failed:", error);
            alert("Failed to unlink wallet.");
        }
    };

    if (loading || !_hasHydrated) {
        return <div className="flex min-h-[50vh] items-center justify-center"><Spinner size="lg" /></div>;
    }

    if (!profileData) return null;

    const isAdmin = profileData.role === 'admin' || (typeof profileData.role === 'object' && profileData.role?.name === 'admin');

    return (
        <>
            <div className="max-w-2xl mx-auto mt-4 p-4 md:p-6 bg-white backdrop-blur-xl border border-gray-200 rounded-2xl animate-in fade-in slide-in-from-bottom-4 shadow-xl mb-20">
                <h1 className="text-2xl md:text-3xl font-bold mb-4 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                    {isAdmin ? 'Admin Profile' : 'User Profile'}
                </h1>

                <div className="space-y-4">

                    {/* Network Info Map - Moved from Navbar for Mobile visibility */}
                    {!isAdmin && (
                        <div>
                            <label className="block text-sm text-muted mb-1">Network Settings</label>
                            <div className="bg-secondary p-4 rounded-lg border border-gray-200 text-foreground">
                                <div className="flex flex-col gap-2">
                                    <div className="flex justify-between items-center">
                                        <span className="text-muted text-sm">Receiver Network</span>
                                        <span className={`font-bold ${activeNetwork ? 'text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 to-orange-400' : 'text-gray-500'}`}>
                                            {activeNetwork ? activeNetwork.chainName : 'Not Set'}
                                        </span>
                                    </div>
                                    {adminWallet && (
                                        <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                                            <span className="text-muted text-sm">Admin Wallet</span>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-mono text-foreground">
                                                    {adminWallet.slice(0, 6)}...{adminWallet.slice(-6)}
                                                </span>
                                                <CopyButton text={adminWallet} />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}

                    <div>
                        <label className="block text-sm text-muted mb-1">Wallet Address</label>
                        <div className="bg-secondary p-3 rounded-lg font-mono text-sm break-all border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-foreground">
                            <span>{profileData.walletAddress || 'Not Linked'}</span>
                            <div className="flex items-center gap-2 self-end sm:self-auto">
                                {profileData.walletAddress && <CopyButton text={profileData.walletAddress} />}
                                {profileData.walletAddress && (
                                    <button
                                        onClick={handleUnlink}
                                        className="text-xs bg-red-100 text-red-600 px-2 py-1 rounded hover:bg-red-200 transition-colors border border-red-200"
                                    >
                                        Unlink
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
                        <div>
                            <label className="block text-sm text-muted mb-1">Role</label>
                            <div className="bg-secondary p-3 rounded-lg capitalize border border-gray-200 text-foreground">
                                {profileData.role?.name || profileData.role || 'User'}
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm text-muted mb-1">Referral Code</label>
                            <div className="bg-secondary p-3 rounded-lg font-mono border border-gray-200 text-foreground">
                                {profileData.referralCode || 'N/A'}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm text-muted mb-1">Username</label>
                            <div className="bg-secondary p-3 rounded-lg border border-gray-200 text-foreground">
                                {profileData.username || 'N/A'}
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm text-muted mb-1">Email</label>
                            <div className="bg-secondary p-3 rounded-lg border border-gray-200 text-foreground flex justify-between items-center gap-2">
                                <span className="truncate flex-1 min-w-0" title={profileData.email}>{profileData.email || 'N/A'}</span>
                                {!isAdmin && (
                                    <button
                                        onClick={() => setIsChangeEmailModalOpen(true)}
                                        className="text-xs bg-primary/10 text-primary px-3 py-1.5 rounded-md font-medium hover:bg-primary/20 transition-colors whitespace-nowrap"
                                    >
                                        Change
                                    </button>
                                )}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm text-muted mb-1">Password</label>
                            <div className="bg-secondary p-3 rounded-lg border border-gray-200 text-foreground flex justify-between items-center gap-2">
                                <span className="text-muted text-sm">••••••••••••</span>
                                <button
                                    onClick={() => setIsChangePasswordModalOpen(true)}
                                    className="text-xs bg-primary/10 text-primary px-3 py-1.5 rounded-md font-medium hover:bg-primary/20 transition-colors whitespace-nowrap"
                                >
                                    Change
                                </button>
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm text-muted mb-1">Phone Number</label>
                            <div className="bg-secondary p-3 rounded-lg border border-gray-200 text-foreground">
                                {profileData.phoneNumber || 'N/A'}
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm text-muted mb-1">Country</label>
                            <div className="bg-secondary p-3 rounded-lg border border-gray-200 text-foreground">
                                {profileData.country || 'N/A'}
                            </div>
                        </div>

                        <div>
                            <label className="block text-sm text-muted mb-1">Date of Birth</label>
                            <div className="bg-secondary p-3 rounded-lg border border-gray-200 text-foreground">
                                {profileData.dateOfBirth ? new Date(profileData.dateOfBirth).toLocaleDateString('en-GB') : 'N/A'}
                            </div>
                        </div>
                        <div>
                            <label className="block text-sm text-muted mb-1">Zip Code</label>
                            <div className="bg-secondary p-3 rounded-lg border border-gray-200 text-foreground">
                                {profileData.zipCode || 'N/A'}
                            </div>
                        </div>
                        <div className="grid-cols-1 md:col-span-2">
                            <label className="block text-sm text-muted mb-1">Your Referral Link</label>
                            <div className="bg-secondary p-3 rounded-lg font-mono text-sm break-all border border-gray-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-foreground">
                                <span>{typeof window !== 'undefined' ? `${window.location.origin}/signup?referral=${profileData.referralCode || ''}` : ''}</span>
                                <div className="self-end sm:self-auto">
                                    {profileData.referralCode && <CopyButton text={typeof window !== 'undefined' ? `${window.location.origin}/signup?referral=${profileData.referralCode}` : ''} />}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="pt-4 border-t border-gray-200">
                        <h3 className="text-lg font-semibold mb-2 text-foreground">Account Status</h3>
                        <div className="flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <span className={`w-3 h-3 rounded-full ${profileData.isEmailVerified ? 'bg-green-500' : 'bg-yellow-500'}`}></span>
                                <span className="text-sm text-muted">{profileData.isEmailVerified ? 'Verified Account' : 'Unverified Account'}</span>
                            </div>
                            {!isAdmin && (
                                <div className="flex items-center gap-2">
                                    <span className={`w-3 h-3 rounded-full ${profileData.isActive ? 'bg-green-600' : 'bg-red-500'}`}></span>
                                    <span className="text-sm text-muted">{profileData.isActive ? 'Active Account' : 'Inactive Account'}</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

            </div>
            <EmailVerificationModal
                isOpen={isVerificationModalOpen}
                onClose={() => setIsVerificationModalOpen(false)}
            />

            <ChangeEmailModal
                isOpen={isChangeEmailModalOpen}
                onClose={() => setIsChangeEmailModalOpen(false)}
                currentEmail={profileData.email}
            />

            <ChangePasswordModal
                isOpen={isChangePasswordModalOpen}
                onClose={() => setIsChangePasswordModalOpen(false)}
            />
        </>
    );
}
