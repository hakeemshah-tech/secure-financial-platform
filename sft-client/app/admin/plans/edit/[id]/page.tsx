'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useUserStore } from '@/lib/store';
import { useRouter, useParams } from 'next/navigation';
import { Spinner } from '@/components/Spinner';

export default function EditPlanPage() {
    const { token, _hasHydrated } = useUserStore();
    const router = useRouter();
    const params = useParams();
    const { id } = params;

    const [isLoading, setIsLoading] = useState(true);
    const [isSaving, setIsSaving] = useState(false);
    const [error, setError] = useState('');

    const [formData, setFormData] = useState({
        name: '',
        description: '',
        lockInPeriodDays: 30,
        sftPrice: 0.10,
        minInvestmentSFT: 50,
        roiPercent: 5,
        walletAddress: ''
    });
    // Local state for "SFT You Will Receive" input (Read-only)
    const [sftCount, setSftCount] = useState<number>(0);

    // Fetch Plan Data
    useEffect(() => {
        if (!_hasHydrated) return;
        if (!token) return;

        const fetchPlan = async () => {
            try {
                const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
                const { data } = await axios.get(`${apiBase}/plans?includeDeleted=true`);
                // Since the API currently returns all plans, we filter client side. 
                const plan = data.find((p: any) => p._id === id);

                if (plan) {
                    setFormData({
                        name: plan.name,
                        description: plan.description || '',
                        lockInPeriodDays: plan.lockInPeriodDays,
                        sftPrice: plan.sftPrice,
                        minInvestmentSFT: plan.minInvestmentSFT,
                        roiPercent: plan.roiPercent,
                        walletAddress: plan.walletAddress || ''
                    });
                } else {
                    setError('Plan not found');
                }
            } catch (err) {
                console.error("Failed to fetch plan", err);
                setError('Failed to load plan details');
            } finally {
                setIsLoading(false);
            }
        };

        fetchPlan();
    }, [id, token, _hasHydrated]);

    // Auto-calculate Receiving SFT based on Investment SFT and ROI
    useEffect(() => {
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
            // Read-only, do nothing
        } else if (name === 'lockInPeriodDays' || name === 'roiPercent' || name === 'minInvestmentSFT') {
            setFormData({ ...formData, [name]: Number(value) });
        } else {
            setFormData({ ...formData, [name]: value });
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSaving(true);
        setError('');

        try {
            const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
            // Calculate sftPrice before sending: Price (USDT) / SFT Count = Price per Token
            // Wait, logic in Create page was: 
            // const calculatedSftPrice = sftCount > 0 ? (investmentSFT / sftCount) : 0;
            // But usually Price is fixed or SFT Price is fixed. 
            // The logic seems to be: SFT Price is derived from Investment Amount and Total SFT received? 
            // Actually, if we look at Create Page:
            // const calculatedSftPrice = sftCount > 0 ? (investmentSFT / sftCount) : 0;
            // This implies Investment SFT / Total SFT = Price.
            // But Investment SFT is in SFT units! Not USDT.
            // If minInvestment is 100 SFT. ROI is 10%. User gets 110 SFT.
            // Price = 100 / 110 = 0.909 ?? That doesn't make sense if price is USDT/SFT.
            // Let's stick to what Create Page does to ensure consistency, even if the business logic seems odd.
            // Create Page:
            // const investmentSFT = Number(formData.minInvestmentSFT);
            // const calculatedSftPrice = sftCount > 0 ? (investmentSFT / sftCount) : 0;

            const investmentSFT = Number(formData.minInvestmentSFT);
            const calculatedSftPrice = sftCount > 0 ? (investmentSFT / sftCount) : 0;

            await axios.put(`${apiBase}/plans/${id}`, {
                ...formData,
                sftPrice: calculatedSftPrice
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            router.push('/admin/plans');
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to update plan');
        } finally {
            setIsSaving(false);
        }
    };

    if (isLoading || !_hasHydrated) {
        return <div className="flex min-h-[50vh] items-center justify-center"><Spinner size="lg" /></div>;
    }

    if (error === 'Plan not found') {
        return <div className="text-center mt-20 text-red-400">Plan not found</div>;
    }

    return (
        <div className="max-w-2xl mx-auto space-y-8 pt-8 pb-64 md:pb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Edit Investment Plan
            </h1>

            <form onSubmit={handleSubmit} className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-8 space-y-6">
                {error && <div className="bg-red-500/20 text-red-400 p-3 rounded-lg text-sm">{error}</div>}

                <div>
                    <label className="block text-sm text-gray-400 mb-1">Plan Name</label>
                    <input
                        type="text"
                        name="name"
                        required
                        value={formData.name}
                        onChange={handleChange}
                        className="w-full bg-white border border-gray-200 rounded-lg p-3 text-foreground focus:outline-none focus:border-primary"
                    />
                </div>

                <div>
                    <label className="block text-sm text-gray-400 mb-1">Description (Optional)</label>
                    <textarea
                        name="description"
                        value={formData.description}
                        onChange={handleChange}
                        className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-blue-500 min-h-[100px]"
                    />
                </div>

                <div>
                    <label className="block text-sm text-gray-400 mb-1">Wallet Address for this Plan</label>
                    <input
                        type="text"
                        name="walletAddress"
                        required
                        value={formData.walletAddress}
                        onChange={handleChange}
                        className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-blue-500 font-mono text-sm"
                        placeholder="0x..."
                    />
                </div>

                <div className="grid grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm text-gray-400 mb-1">Receiving SFT</label>
                        <input
                            type="number"
                            name="sftCount"
                            required
                            readOnly
                            value={sftCount}
                            className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white/70 focus:outline-none focus:border-blue-500 cursor-not-allowed opacity-75"
                        />
                        <p className="text-xs text-gray-500 mt-1">Total SFT tokens user receives</p>
                    </div>
                    <div>
                        <label className="block text-sm text-gray-400 mb-1">Investment SFT</label>
                        <input
                            type="number"
                            name="minInvestmentSFT"
                            required
                            value={formData.minInvestmentSFT}
                            onChange={handleChange}
                            className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-blue-500"
                        />
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                    <div>
                        <label className="block text-sm text-gray-400 mb-1">Lock Duration (Days)</label>
                        <input
                            type="number"
                            name="lockInPeriodDays"
                            required
                            value={formData.lockInPeriodDays}
                            onChange={handleChange}
                            className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-blue-500"
                        />
                    </div>
                    <div>
                        <label className="block text-sm text-gray-400 mb-1">ROI (%)</label>
                        <input
                            type="number"
                            name="roiPercent"
                            step="0.01"
                            required
                            value={formData.roiPercent}
                            onChange={handleChange}
                            className="w-full bg-black/20 border border-white/10 rounded-lg p-3 text-white focus:outline-none focus:border-blue-500"
                        />
                        <p className="text-xs text-gray-500 mt-1">Percentage return after lock-in</p>
                    </div>
                </div>

                <div className="pt-4">
                    <button
                        type="submit"
                        disabled={isSaving}
                        className="w-full bg-primary hover:bg-accent text-primary-foreground font-bold py-3 rounded-xl shadow-lg transition-all flex justify-center items-center disabled:opacity-70 disabled:cursor-not-allowed whitespace-nowrap"
                    >
                        {isSaving ? <Spinner size="sm" className="border-white/30 border-t-white" /> : 'Update Plan'}
                    </button>
                </div>
            </form>
        </div>
    );
}
