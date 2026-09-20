'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import { useUserStore } from '@/lib/store';
import { Eye, EyeOff } from 'lucide-react';

import { Modal } from '@/components/Modal';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [otp, setOtp] = useState('');
    const [showOtpInput, setShowOtpInput] = useState(false);
    const [isEditEmailModalOpen, setIsEditEmailModalOpen] = useState(false);
    const [newEmail, setNewEmail] = useState('');
    const [editError, setEditError] = useState('');
    const [editSuccess, setEditSuccess] = useState('');

    const router = useRouter();
    const { setToken, setUser } = useUserStore();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');
        try {
            const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

            if (showOtpInput) {
                const { data } = await axios.post(`${apiBase}/auth/verify-otp`, {
                    email,
                    otp
                });
                completeLogin(data);
                return;
            }

            const { data, status } = await axios.post(`${apiBase}/auth/login`, {
                email,
                password
            });

            if (status === 202 && data.require2fa) {
                setShowOtpInput(true);
                return;
            }

            completeLogin(data);

        } catch (err: any) {
            setError(err.response?.data?.message || 'Login failed');
        }
    };

    const completeLogin = (data: any) => {
        setToken(data.token);
        setUser(data);

        if (data.walletAddress &&
            !data.walletAddress.startsWith('PENDING_') &&
            !data.walletAddress.startsWith('ADMIN_') &&
            !data.walletAddress.includes('PLACEHOLDER')) {
            useUserStore.getState().connectWallet(data.walletAddress);
        }

        router.push('/dashboard');
    };

    const handleEditEmailRequest = async () => {
        if (!newEmail) {
            setEditError('Please enter a new email');
            return;
        }
        try {
            setEditError('');
            setEditSuccess('');
            const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
            await axios.post(`${apiBase}/email-change/request`, {
                oldEmail: email,
                password: password,
                newEmail: newEmail
            });
            setEditSuccess(`Request submitted! Admin will review it within 24 hours. After approval, the admin will send a verification email, and then you can verify your ${newEmail} (new) email.`);
            setNewEmail(''); // Clear input but keep modal open with success message
        } catch (err: any) {
            setEditError(err.response?.data?.message || 'Failed to submit request');
        }
    };

    return (
        <div className="flex min-h-[calc(100vh-80px)] items-center justify-center">
            <div className="w-full max-w-md bg-white backdrop-blur-xl border border-gray-200 rounded-2xl p-8 shadow-xl">
                <h2 className="text-3xl font-bold text-center mb-6 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                    {showOtpInput ? 'Two-Factor Auth' : 'Login'}
                </h2>
                {error && <div className="bg-red-500/10 text-red-600 p-3 rounded-lg mb-4 text-center">{error}</div>}
                {success && <div className="bg-green-500/10 text-green-600 p-3 rounded-lg mb-4 text-center">{success}</div>}

                {showOtpInput && (
                    <div className="bg-blue-50 text-blue-800 p-3 rounded-lg mb-4 text-sm text-center">
                        An OTP has been sent to <strong>{email}</strong>. Please enter it below.
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                    {!showOtpInput ? (
                        <>
                            <div>
                                <label className="block text-sm text-muted mb-1">Email Address</label>
                                <input
                                    type="email"
                                    required
                                    className="w-full bg-secondary border border-gray-200 rounded-lg p-3 focus:outline-none focus:border-primary text-foreground"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>
                            <div>
                                <label className="block text-sm text-muted mb-1">Password</label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        required
                                        className="w-full bg-secondary border border-gray-200 rounded-lg p-3 pr-10 focus:outline-none focus:border-primary text-foreground"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-muted hover:text-primary"
                                    >
                                        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                                    </button>
                                </div>
                                <div className="flex justify-end mt-2">
                                    <Link href="/forgot-password" className="text-sm text-primary hover:text-accent font-medium">
                                        Forgot Password?
                                    </Link>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div>
                            <label className="block text-sm text-muted mb-1">Enter OTP</label>
                            <input
                                type="text"
                                required
                                maxLength={6}
                                placeholder="000000"
                                className="w-full bg-secondary border border-gray-200 rounded-lg p-3 text-center text-2xl tracking-widest focus:outline-none focus:border-primary text-foreground"
                                value={otp}
                                onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, ''))}
                            />
                        </div>
                    )}

                    <button type="submit" className="w-full bg-primary hover:bg-accent text-white font-bold py-3 rounded-xl shadow-lg transition-all">
                        {showOtpInput ? 'Verify & Login' : 'Sign In'}
                    </button>
                </form>



                {!showOtpInput && (
                    <div className="mt-6 text-center text-sm text-muted">
                        Don't have an account? <Link href="/signup" className="text-primary hover:text-accent font-semibold">Sign Up</Link>
                    </div>
                )}
            </div>

            <Modal
                isOpen={isEditEmailModalOpen}
                onClose={() => setIsEditEmailModalOpen(false)}
                title="Edit Email Address"
                footer={
                    editSuccess ? (
                        <button
                            onClick={() => {
                                setIsEditEmailModalOpen(false);
                                setEditSuccess('');
                            }}
                            className="w-full px-4 py-2 text-sm text-white bg-primary hover:bg-primary/90 rounded-lg shadow-md transition-all"
                        >
                            Close
                        </button>
                    ) : (
                        <div className="flex gap-2">
                            <button onClick={() => setIsEditEmailModalOpen(false)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-all">Cancel</button>
                            <button onClick={handleEditEmailRequest} className="px-4 py-2 text-sm text-white bg-primary hover:bg-primary/90 rounded-lg shadow-md transition-all">Submit Request</button>
                        </div>
                    )
                }
            >
                <div className="space-y-4">
                    {!editSuccess && (
                        <>
                            <p className="text-sm text-gray-600">Enter your new email address below. Admin will review your request.</p>
                            {editError && <div className="text-red-500 text-sm bg-red-50 p-2 rounded">{editError}</div>}
                            <input
                                type="email"
                                placeholder="New Email Address"
                                value={newEmail}
                                onChange={(e) => setNewEmail(e.target.value)}
                                className="w-full border border-gray-300 rounded-lg p-2 focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                            />
                        </>
                    )}
                    {editSuccess && (
                        <div className="flex flex-col items-center gap-4 py-4">
                            <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                </svg>
                            </div>
                            <div className="text-green-600 text-sm bg-green-50 p-4 rounded-lg text-center font-medium leading-relaxed">
                                {editSuccess}
                            </div>
                        </div>
                    )}
                </div>
            </Modal>
        </div>
    );
}
