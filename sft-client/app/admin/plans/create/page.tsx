'use client';

import React, { useState } from 'react';
import axios from 'axios';
import { useUserStore } from '@/lib/store';
import { useRouter } from 'next/navigation';
import { Spinner } from '@/components/Spinner';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export default function CreatePlanPage() {
    const { token } = useUserStore();
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        lockInPeriodDays: 30,
        sftPrice: 0.10,
        minInvestmentSFT: '',
        roiPercent: 5,
        walletAddress: ''
    });
    // Local state for "SFT You Will Receive" input
    const [sftCount, setSftCount] = useState<number>(500);

    // Auto-calculate Receiving SFT based on Investment SFT and ROI
    React.useEffect(() => {
        const investment = Number(formData.minInvestmentSFT);
        const roi = Number(formData.roiPercent);

        if (investment >= 0 && roi >= 0) {
            // Formula: Investment + (Investment * ROI / 100)
            const calculatedSFT = investment + (investment * roi / 100);
            setSftCount(Number(calculatedSFT));
        } else {
            setSftCount(0);
        }
    }, [formData.minInvestmentSFT, formData.roiPercent]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
        const { name, value } = e.target;
        if (name === 'sftCount') {
            // No-op 
        } else if (name === 'lockInPeriodDays' || name === 'roiPercent') {
            setFormData({ ...formData, [name]: Number(value) });
        } else {
            setFormData({ ...formData, [name]: value });
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
            // Calculate sftPrice before sending
            const investmentSFT = Number(formData.minInvestmentSFT);
            // Price (USDT) / SFT Count = Price per Token
            const calculatedSftPrice = sftCount > 0 ? (investmentSFT / sftCount) : 0;

            await axios.post(`${apiBase}/plans`, {
                ...formData,
                minInvestmentSFT: investmentSFT,
                sftPrice: calculatedSftPrice
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            router.push('/admin/plans');
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to create plan');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto pt-8 pb-64 md:pb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">

            {/* Navigation */}
            <div className="mb-8">
                <Link
                    href="/admin/plans"
                    className="inline-flex items-center text-sm text-gray-400 hover:text-gray-900 transition-colors gap-2"
                >
                    <ArrowLeft size={16} />
                    Back to Plans
                </Link>
            </div>

            {/* Main Card Container */}
            <div className="bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100">
                {/* Header */}
                <div className="p-8 border-b border-gray-100 text-center bg-gray-50/50">
                    <h1 className="text-3xl font-bold text-gray-900 mb-2">
                        Create New Investment Plan
                    </h1>
                    <p className="text-gray-500">
                        Configure the details for your new investment package
                    </p>
                </div>

                <form onSubmit={handleSubmit} className="p-8 space-y-8">
                    {error && (
                        <div className="bg-red-50 text-red-600 p-4 rounded-xl text-sm flex items-center gap-2 border border-red-100">
                            <span className="font-bold">Error:</span> {error}
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Left Column */}
                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Plan Name</label>
                                <input
                                    type="text"
                                    name="name"
                                    required
                                    value={formData.name}
                                    onChange={handleChange}
                                    className="w-full bg-white border border-gray-200 rounded-xl p-3 text-gray-900 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-gray-400"
                                    placeholder="e.g. Starter Plan"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Wallet Address</label>
                                <input
                                    type="text"
                                    name="walletAddress"
                                    required
                                    value={formData.walletAddress}
                                    onChange={handleChange}
                                    className="w-full bg-white border border-gray-200 rounded-xl p-3 text-gray-900 font-mono text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-gray-400"
                                    placeholder="0x..."
                                />
                                <p className="text-xs text-gray-500 mt-2">The receiving wallet for this plan.</p>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Description <span className="text-gray-400 font-normal">(Optional)</span></label>
                                <textarea
                                    name="description"
                                    value={formData.description}
                                    onChange={handleChange}
                                    className="w-full bg-white border border-gray-200 rounded-xl p-3 text-gray-900 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all min-h-[120px] resize-none placeholder:text-gray-400"
                                    placeholder="Brief description of the plan..."
                                />
                            </div>
                        </div>

                        {/* Right Column */}
                        <div className="space-y-6">
                            <div className="grid grid-cols-2 gap-6">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Investment (SFT)</label>
                                    <input
                                        type="number"
                                        name="minInvestmentSFT"
                                        required
                                        value={formData.minInvestmentSFT}
                                        onChange={handleChange}
                                        className="w-full bg-white border border-gray-200 rounded-xl p-3 text-gray-900 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-gray-400"
                                        placeholder="0.00"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">ROI (%)</label>
                                    <input
                                        type="number"
                                        name="roiPercent"
                                        step="0.01"
                                        required
                                        value={formData.roiPercent}
                                        onChange={handleChange}
                                        className="w-full bg-white border border-gray-200 rounded-xl p-3 text-gray-900 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-gray-400"
                                    />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Lock Duration</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        name="lockInPeriodDays"
                                        required
                                        value={formData.lockInPeriodDays}
                                        onChange={handleChange}
                                        className="w-full bg-white border border-gray-200 rounded-xl p-3 text-gray-900 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all placeholder:text-gray-400"
                                    />
                                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">
                                        Days
                                    </div>
                                </div>
                            </div>

                            <div className="bg-gray-50 border border-gray-200 rounded-xl p-6">
                                <label className="block text-sm font-bold text-gray-900 mb-2">Estimated Return</label>
                                <div className="flex items-center gap-4">
                                    <div className="flex-1">
                                        <div className="text-xs text-gray-500 mb-1">Total SFT User Receives</div>
                                        <div className="text-2xl font-bold text-primary">{sftCount.toLocaleString()} <span className="text-sm font-normal text-gray-500">SFT</span></div>
                                    </div>
                                </div>
                                <p className="text-xs text-gray-400 mt-3 border-t border-gray-200 pt-3">
                                    Formula: Investment + (Investment × {formData.roiPercent}%)
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="pt-6 border-t border-gray-100 flex justify-end gap-4">
                        <Link href="/admin/plans">
                            <button
                                type="button"
                                className="bg-white border border-gray-200 hover:bg-gray-50 text-gray-700 px-6 py-3 rounded-xl transition-all font-medium"
                            >
                                Cancel
                            </button>
                        </Link>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="bg-primary hover:bg-primary/90 text-white font-bold px-8 py-3 rounded-xl shadow-lg shadow-primary/20 transition-all flex justify-center items-center disabled:opacity-70 disabled:cursor-not-allowed min-w-[140px] whitespace-nowrap"
                        >
                            {isLoading ? <Spinner size="sm" className="border-white/30 border-t-white" /> : 'Create Plan'}
                        </button>
                    </div>
                </form>
            </div >
        </div >
    );
}
