'use client';

import { useState } from 'react';
import axios from 'axios';
import Link from 'next/link';

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');
        setError('');

        try {
            const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
            await axios.post(`${apiBase}/auth/forgot-password`, { email });
            setMessage('Password reset email sent. Please check your inbox.');
        } catch (err: any) {
            console.error(err);
            const errorMsg = err.response?.data?.message || err.message || 'Something went wrong. Please try again.';
            setError(errorMsg);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex min-h-[calc(100vh-80px)] items-center justify-center">
            <div className="w-full max-w-md bg-white backdrop-blur-xl border border-gray-200 rounded-2xl p-8 shadow-xl">
                <div>
                    <h2 className="text-3xl font-bold text-center mb-6 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                        Forgot Password
                    </h2>
                    <p className="mt-2 text-center text-sm text-gray-600">
                        Enter your email address to receive a password reset link.
                    </p>
                </div>
                <form className="mt-8 space-y-6" onSubmit={handleSubmit}>
                    <div>
                        <label htmlFor="email-address" className="block text-sm text-gray-600 mb-1">
                            Email address
                        </label>
                        <input
                            id="email-address"
                            name="email"
                            type="email"
                            autoComplete="email"
                            required
                            className="w-full bg-gray-50 border border-gray-200 rounded-lg p-3 focus:outline-none focus:border-primary text-gray-900"
                            placeholder="Email address"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                        />
                    </div>

                    {message && (
                        <div className="bg-green-50 text-green-600 p-3 rounded-lg text-sm text-center border border-green-200">
                            {message}
                        </div>
                    )}

                    {error && (
                        <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm text-center border border-red-200">
                            {error}
                        </div>
                    )}

                    <div>
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-primary hover:bg-accent text-white font-bold py-3 rounded-xl shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? 'Sending...' : 'Send Reset Link'}
                        </button>
                    </div>

                    <div className="text-center">
                        <Link href="/login" className="text-sm font-medium text-primary hover:text-accent">
                            Back to Login
                        </Link>
                    </div>
                </form>
            </div>
        </div>
    );
}
