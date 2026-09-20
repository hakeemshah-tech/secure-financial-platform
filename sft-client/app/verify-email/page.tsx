'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import axios from 'axios';
import { useUserStore } from '@/lib/store';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Spinner } from '@/components/Spinner';

export default function VerifyEmailPage() {
    return (
        <React.Suspense fallback={<div className="flex justify-center items-center h-screen"><Spinner /></div>}>
            <VerifyEmailContent />
        </React.Suspense>
    );
}

function VerifyEmailContent() {
    const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
    const [message, setMessage] = useState('Verifying your email...');
    const router = useRouter();
    const searchParams = useSearchParams();
    const token = searchParams.get('token');
    const { setToken, setUser } = useUserStore();

    useEffect(() => {
        if (!token) {
            setStatus('error');
            setMessage('Invalid verification link.');
            return;
        }

        const verify = async () => {
            try {
                const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
                const { data } = await axios.post(`${apiBase}/auth/verify-email`, { token });

                setStatus('success');
                setMessage('Email verified successfully! Redirecting...');

                // Auto login user
                if (data.token) {
                    setToken(data.token);
                    setUser(data.user);
                    setTimeout(() => {
                        router.push('/dashboard');
                    }, 2000);
                } else {
                    setTimeout(() => {
                        router.push('/login');
                    }, 2000);
                }

            } catch (error: any) {
                setStatus('error');
                setMessage(error.response?.data?.message || 'Verification failed. The link may be expired.');
            }
        };

        verify();
    }, [token, router, setToken, setUser]);

    return (
        <div className="flex min-h-[calc(100vh-80px)] items-center justify-center py-4 px-4">
            <div className="w-full max-w-md bg-white backdrop-blur-xl border border-gray-200 rounded-2xl p-8 shadow-xl text-center">

                <div className="mb-6 flex justify-center">
                    {status === 'verifying' && <Loader2 className="w-12 h-12 text-primary animate-spin" />}
                    {status === 'success' && <CheckCircle className="w-12 h-12 text-green-500" />}
                    {status === 'error' && <XCircle className="w-12 h-12 text-red-500" />}
                </div>

                <h2 className="text-2xl font-bold mb-2 text-foreground">
                    {status === 'verifying' ? 'Verifying...' : status === 'success' ? 'Verified!' : 'Verification Failed'}
                </h2>

                <p className="text-muted mb-8">{message}</p>

                {status === 'error' && (
                    <Link
                        href="/login"
                        className="block w-full bg-primary hover:bg-accent text-white font-bold py-3 rounded-xl transition-all"
                    >
                        Go to Login
                    </Link>
                )}

                {status === 'success' && (
                    <div className="w-full bg-green-50 text-green-600 font-medium py-3 rounded-xl">
                        Redirecting you to dashboard...
                    </div>
                )}
            </div>
        </div>
    );
}
