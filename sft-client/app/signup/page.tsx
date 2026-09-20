'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import axios from 'axios';
import { useUserStore } from '@/lib/store';
import { Eye, EyeOff } from 'lucide-react';
import { countries } from '@/lib/countries';

import { Spinner } from '@/components/Spinner';
import { CustomSelect } from '@/components/CustomSelect';

function SignupContent() {
    const [username, setUsername] = useState('');
    const [email, setEmail] = useState('');
    const [countryIso, setCountryIso] = useState('IN');
    const [phoneNumber, setPhoneNumber] = useState('');
    const [dateOfBirth, setDateOfBirth] = useState('');
    const [zipCode, setZipCode] = useState('');
    const [country, setCountry] = useState('India');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [referralCode, setReferralCode] = useState('');
    const [isReferralReadOnly, setIsReferralReadOnly] = useState(false);
    const [error, setError] = useState('');
    const [position, setPosition] = useState('');
    const [placement, setPlacement] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const router = useRouter();
    const searchParams = useSearchParams();

    React.useEffect(() => {
        const ref = searchParams.get('referral');
        const pos = searchParams.get('position');
        const place = searchParams.get('placement');
        if (ref) {
            setReferralCode(ref);
            setIsReferralReadOnly(true);
        }
        if (pos) {
            setPosition(pos);
        }
        if (place) {
            setPlacement(place);
        }
    }, [searchParams]);
    const { setToken, setUser } = useUserStore();

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (password !== confirmPassword) {
            setError('Passwords do not match');
            return;
        }

        setIsLoading(true);
        try {
            const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
            const selectedCountry = countries.find(c => c.iso === countryIso);
            const dialCode = selectedCountry?.code || '+1';

            const { data } = await axios.post(`${apiBase}/auth/register`, {
                username,
                email,
                phoneNumber: `${dialCode}${phoneNumber}`,
                dateOfBirth,
                zipCode,
                country,
                password,
                referralCode,
                position,
                placement
            });
            // Direct login for unverified users
            setToken(data.token);
            setUser(data);
            router.push('/dashboard');
            // router.push(`/verify-email-sent?email=${encodeURIComponent(email)}`);
        } catch (err: any) {
            setIsLoading(false);
            setError(err.response?.data?.message || 'Registration failed');
        }
    };


    return (
        <div className="flex min-h-[calc(100vh-80px)] items-center justify-center py-4">
            <div className="w-full max-w-2xl bg-white backdrop-blur-xl border border-gray-200 rounded-2xl p-6 shadow-xl">
                <h2 className="text-2xl font-bold text-center mb-4 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">Create Account</h2>
                {error && <div className="bg-red-500/10 text-red-600 p-2 rounded-lg mb-4 text-center text-sm">{error}</div>}
                <form onSubmit={handleSubmit} className="space-y-4">

                    {/* Row 1: Username & Email */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs text-muted mb-1">Username</label>
                            <input
                                type="text"
                                required
                                className="w-full bg-secondary border border-gray-200 rounded-lg p-2.5 focus:outline-none focus:border-primary text-sm text-foreground"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-muted mb-1">Email Address</label>
                            <input
                                type="email"
                                required
                                className="w-full bg-secondary border border-gray-200 rounded-lg p-2.5 focus:outline-none focus:border-primary text-sm text-foreground"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Row 2: Phone Number */}
                    <div>
                        <label className="block text-xs text-muted mb-1">Phone Number</label>
                        <div className="flex gap-2">
                            <CustomSelect
                                options={countries}
                                value={countryIso}
                                onChange={setCountryIso}
                                valueKey="iso"
                                className="w-[140px]"
                                renderValue={(c) => (
                                    <>
                                        <img
                                            src={`https://flagcdn.com/w20/${c.iso.toLowerCase()}.png`}
                                            alt={c.iso}
                                            className="w-5 h-3.5 object-cover rounded-[1px]"
                                        />
                                        <span>{c.iso}</span>
                                    </>
                                )}
                                renderOption={(c) => (
                                    <>
                                        <img
                                            src={`https://flagcdn.com/w20/${c.iso.toLowerCase()}.png`}
                                            alt={c.iso}
                                            className="w-5 h-3.5 object-cover rounded-[1px]"
                                        />
                                        <span>{c.iso} ({c.code})</span>
                                    </>
                                )}
                                searchable={true}
                            />
                            <input
                                type="tel"
                                required
                                className="flex-1 bg-secondary border border-gray-200 rounded-lg p-2.5 focus:outline-none focus:border-primary text-sm text-foreground"
                                value={phoneNumber}
                                onChange={(e) => setPhoneNumber(e.target.value)}
                                placeholder="Phone number"
                            />
                        </div>
                    </div>

                    {/* Row 3: DOB & Zip */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs text-muted mb-1">Date of Birth</label>
                            <input
                                type="date"
                                required
                                className="w-full bg-secondary border border-gray-200 rounded-lg p-2.5 focus:outline-none focus:border-primary text-foreground text-sm"
                                value={dateOfBirth}
                                onChange={(e) => setDateOfBirth(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-muted mb-1">Zip Code</label>
                            <input
                                type="text"
                                required
                                className="w-full bg-secondary border border-gray-200 rounded-lg p-2.5 focus:outline-none focus:border-primary text-sm text-foreground"
                                value={zipCode}
                                onChange={(e) => setZipCode(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Row 4: Country */}
                    <div>
                        <label className="block text-xs text-muted mb-1">Country</label>
                        <CustomSelect
                            options={countries}
                            value={country}
                            onChange={setCountry}
                            valueKey="name"
                            renderOption={(c) => (
                                <>
                                    <img
                                        src={`https://flagcdn.com/w20/${c.iso.toLowerCase()}.png`}
                                        alt={c.iso}
                                        className="w-5 h-3.5 object-cover rounded-[1px]"
                                    />
                                    <span>{c.name}</span>
                                </>
                            )}
                            searchable={true}
                        />
                    </div>

                    {/* Row 5: Passwords */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-xs text-muted mb-1">Password</label>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    required
                                    className="w-full bg-secondary border border-gray-200 rounded-lg p-2.5 pr-8 focus:outline-none focus:border-primary text-sm text-foreground"
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-muted hover:text-primary"
                                >
                                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>
                        <div>
                            <label className="block text-xs text-muted mb-1">Confirm Password</label>
                            <div className="relative">
                                <input
                                    type={showConfirmPassword ? "text" : "password"}
                                    required
                                    className="w-full bg-secondary border border-gray-200 rounded-lg p-2.5 pr-8 focus:outline-none focus:border-primary text-sm text-foreground"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                    className="absolute right-2 top-1/2 transform -translate-y-1/2 text-muted hover:text-primary"
                                >
                                    {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Row 6: Referral Code */}
                    <div>
                        <label className="block text-xs text-muted mb-1">Referral Code (Optional)</label>
                        <input
                            type="text"
                            value={referralCode}
                            onChange={(e) => setReferralCode(e.target.value)}
                            readOnly={isReferralReadOnly}
                            className={`w-full bg-secondary border border-gray-200 rounded-lg p-2.5 focus:outline-none focus:border-primary text-sm text-foreground ${isReferralReadOnly ? 'opacity-60 cursor-not-allowed' : ''}`}
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-primary hover:bg-accent text-white font-bold py-2.5 rounded-xl shadow-lg transition-all flex justify-center items-center disabled:opacity-70 disabled:cursor-not-allowed mt-2"
                    >
                        {isLoading ? <Spinner size="sm" className="border-white/30 border-t-white" /> : 'Sign Up'}
                    </button>
                </form>
                <div className="mt-4 text-center text-xs text-muted">
                    Already have an account? <Link href="/login" className="text-primary hover:text-accent font-semibold">Login</Link>
                </div>
            </div>
        </div>
    );
}

export default function SignupPage() {
    return (
        <React.Suspense fallback={<div className="flex justify-center items-center min-h-[calc(100vh-80px)]"><Spinner /></div>}>
            <SignupContent />
        </React.Suspense>
    );
}
