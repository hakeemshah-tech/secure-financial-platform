'use client';

import React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Mail } from 'lucide-react';

export default function VerifyEmailSentPage() {
    return (
        <React.Suspense fallback={<div>Loading...</div>}>
            <VerifyEmailSentContent />
        </React.Suspense>
    );
}

function VerifyEmailSentContent() {
    const searchParams = useSearchParams();
    const email = searchParams.get('email');

    return (
        <div className="flex min-h-[calc(100vh-80px)] items-center justify-center py-4 px-4">
            <div className="w-full max-w-md bg-white backdrop-blur-xl border border-gray-200 rounded-2xl p-8 shadow-xl text-center">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6">
                    <Mail className="w-8 h-8 text-primary" />
                </div>

                <h2 className="text-2xl font-bold mb-4 text-foreground">Verify your email</h2>

                <p className="text-muted mb-6">
                    We've sent a verification link to <span className="font-semibold text-foreground">{email || 'your email'}</span>.
                    Please check your inbox and click the link to activate your account.
                </p>

                <div className="space-y-4">
                    <Link
                        href="/login"
                        className="block w-full bg-primary hover:bg-accent text-white font-bold py-3 rounded-xl transition-all"
                    >
                        Back to Login
                    </Link>

                    <p className="text-xs text-muted">
                        Didn't receive the email? Check your spam folder or try logging in to resend.
                    </p>
                </div>
            </div>
        </div>
    );
}
