'use client';

import React, { useState, useEffect } from 'react';
import { useUserStore } from '@/lib/store';
import { toast } from 'react-hot-toast';
import { Save, Plus, Trash2, Loader2, Coins, Trophy, Users, AlertCircle, CheckCircle2, Target } from 'lucide-react';
import { Spinner } from '@/components/Spinner';
import { Modal } from '@/components/Modal';

interface IncomeSettings {
    referralIncome: number;
    matchingIncome: number;
    levelIncome: number[];
    minWithdrawal: number;
    withdrawalFee: number;
    maxIncomeMultiplier: number;
}

export default function IncomeSettingsPage() {
    const { token } = useUserStore();
    const [loading, setLoading] = useState(true);
    // Separate loading states for each update action
    const [savingReferral, setSavingReferral] = useState(false);
    const [savingMatching, setSavingMatching] = useState(false);
    const [savingLevel, setSavingLevel] = useState(false);
    const [savingWithdrawal, setSavingWithdrawal] = useState(false);
    const [savingMultiplier, setSavingMultiplier] = useState(false);

    const [settings, setSettings] = useState<IncomeSettings>({
        referralIncome: 0,
        matchingIncome: 0,
        levelIncome: [],
        minWithdrawal: 0,
        withdrawalFee: 0,
        maxIncomeMultiplier: 0
    });

    const [successModal, setSuccessModal] = useState({
        isOpen: false,
        title: '',
        message: ''
    });

    useEffect(() => {
        if (token) {
            fetchSettings();
        }
    }, [token]);

    const fetchSettings = async () => {
        try {
            const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
            const res = await fetch(`${apiBase}/settings/income`, {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            if (!res.ok) throw new Error('Failed to fetch settings');

            const data = await res.json();
            setSettings({
                referralIncome: data.referralIncome || 0,
                matchingIncome: data.matchingIncome || 0,
                levelIncome: data.levelIncome || [],
                minWithdrawal: data.minWithdrawal || 0,
                withdrawalFee: data.withdrawalFee || 0,
                maxIncomeMultiplier: data.maxIncomeMultiplier || 0
            });
        } catch (error) {
            console.error('Error fetching settings:', error);
            toast.error('Failed to load income settings');
        } finally {
            setLoading(false);
        }
    };

    const handleSaveReferral = async () => {
        setSavingReferral(true);
        try {
            const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
            const res = await fetch(`${apiBase}/settings/income/referral`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ referralIncome: settings.referralIncome })
            });

            if (!res.ok) throw new Error('Failed to update referral income');

            setSuccessModal({
                isOpen: true,
                title: 'Success!',
                message: 'Referral income configuration has been successfully updated.'
            });
        } catch (error) {
            console.error('Error updating referral income:', error);
            toast.error('Failed to update referral income');
        } finally {
            setSavingReferral(false);
        }
    };

    const handleSaveMatching = async () => {
        setSavingMatching(true);
        try {
            const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
            const res = await fetch(`${apiBase}/settings/income/matching`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ matchingIncome: settings.matchingIncome })
            });

            if (!res.ok) throw new Error('Failed to update matching income');

            setSuccessModal({
                isOpen: true,
                title: 'Success!',
                message: 'Matching income configuration has been successfully updated.'
            });
        } catch (error) {
            console.error('Error updating matching income:', error);
            toast.error('Failed to update matching income');
        } finally {
            setSavingMatching(false);
        }
    };



    const handleSaveLevel = async () => {
        setSavingLevel(true);
        try {
            const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
            const res = await fetch(`${apiBase}/settings/income/level`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({ levelIncome: settings.levelIncome })
            });

            if (!res.ok) throw new Error('Failed to update level income');

            setSuccessModal({
                isOpen: true,
                title: 'Success!',
                message: 'Level income configuration has been successfully updated.'
            });
        } catch (error) {
            console.error('Error updating level income:', error);
            toast.error('Failed to update level income');
        } finally {
            setSavingLevel(false);
        }
    };

    const handleSaveWithdrawal = async () => {
        setSavingWithdrawal(true);
        try {
            const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
            const res = await fetch(`${apiBase}/settings/income/withdrawal`, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${token}`
                },
                body: JSON.stringify({
                    minWithdrawal: settings.minWithdrawal,
                    withdrawalFee: settings.withdrawalFee,
                    maxIncomeMultiplier: settings.maxIncomeMultiplier
                })
            });

            if (!res.ok) throw new Error('Failed to update withdrawal settings');

            setSuccessModal({
                isOpen: true,
                title: 'Success!',
                message: 'Withdrawal settings have been successfully updated.'
            });
        } catch (error) {
            console.error('Error updating withdrawal settings:', error);
            toast.error('Failed to update withdrawal settings');
        } finally {
            setSavingWithdrawal(false);
        }
    };



    const handleLevelChange = (index: number, value: string) => {
        const newLevels = [...settings.levelIncome];
        newLevels[index] = Number(value);
        setSettings({ ...settings, levelIncome: newLevels });
    };

    const addLevel = () => {
        setSettings({
            ...settings,
            levelIncome: [...settings.levelIncome, 0]
        });
    };

    const removeLevel = (index: number) => {
        const newLevels = settings.levelIncome.filter((_, i) => i !== index);
        setSettings({ ...settings, levelIncome: newLevels });
    };

    const closeSuccessModal = () => {
        setSuccessModal(prev => ({ ...prev, isOpen: false }));
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center min-h-[60vh]">
                <Spinner />
            </div>
        );
    }

    return (
        <div className="py-6 md:p-8 pb-64 md:pb-8 max-w-7xl mx-auto">
            {/* Success Modal */}
            <Modal
                isOpen={successModal.isOpen}
                onClose={closeSuccessModal}
                title={successModal.title}
                footer={
                    <button
                        onClick={closeSuccessModal}
                        className="px-6 py-2.5 bg-primary hover:bg-accent text-primary-foreground rounded-xl font-medium transition-colors w-full sm:w-auto"
                    >
                        Continue
                    </button>
                }
            >
                <div className="flex flex-col items-center justify-center py-6 text-center">
                    <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mb-6">
                        <CheckCircle2 className="w-8 h-8 text-green-500" />
                    </div>
                    <p className="text-gray-300 text-lg leading-relaxed max-w-sm">
                        {successModal.message}
                    </p>
                </div>
            </Modal>

            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900">
                    Income Settings
                </h1>
                <p className="text-gray-500 mt-2">
                    Manage referral, level, and matching income configurations independently.
                </p>
            </div>

            {/* Main Grid: 3 Vertical Cards Side-by-Side */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start mb-6">

                {/* Card 1: Referral Income */}
                <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-6 h-full flex flex-col justify-between hover:shadow-md transition-shadow">
                    <div>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-3 bg-primary/10 rounded-xl">
                                <Users className="w-6 h-6 text-primary" />
                            </div>
                            <h2 className="text-xl font-semibold text-gray-900">
                                Referral Income
                            </h2>
                        </div>

                        <div className="space-y-4 mb-6">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">Direct Referral (%)</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={settings.referralIncome}
                                        onChange={(e) => setSettings({ ...settings, referralIncome: Number(e.target.value) })}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:border-primary focus:bg-white transition-colors pl-14"
                                        placeholder="0"
                                        step="0.01"
                                        min="0"
                                        max="100"
                                    />
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-500">%</span>
                                </div>
                                <p className="text-xs text-gray-500 leading-relaxed">
                                    Percentage of investment amount for direct referrals.
                                </p>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={handleSaveReferral}
                        disabled={savingReferral}
                        className="w-full py-3 bg-primary hover:bg-accent text-primary-foreground rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {savingReferral ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Update
                    </button>
                </div>

                {/* Card 2: Level Income */}
                <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-6 h-full flex flex-col justify-between hover:shadow-md transition-shadow">
                    <div>
                        <div className="flex items-center justify-between mb-6">
                            <div className="flex items-center gap-3">
                                <div className="p-3 bg-primary/10 rounded-xl">
                                    <AlertCircle className="w-6 h-6 text-primary" />
                                </div>
                                <h2 className="text-xl font-semibold text-gray-900">
                                    Level Income
                                </h2>
                            </div>
                            <button
                                onClick={addLevel}
                                className="p-2 bg-blue-500/10 text-blue-400 rounded-lg hover:bg-blue-500/20 transition-colors"
                                title="Add Level"
                            >
                                <Plus className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-3 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar mb-6">
                            {settings.levelIncome.length === 0 ? (
                                <div className="text-center py-8 text-gray-500 text-sm bg-gray-50 rounded-xl border border-dashed border-gray-200">
                                    <p>No levels configured.</p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {settings.levelIncome.map((level, index) => (
                                        <div key={index} className="flex items-center gap-3 bg-gray-50 p-3 rounded-xl border border-gray-100 group hover:border-gray-200 transition-colors">
                                            <div className="w-8 h-8 rounded-lg bg-white border border-gray-200 flex items-center justify-center text-gray-600 text-sm font-medium shrink-0">
                                                L{index + 1}
                                            </div>
                                            <div className="flex-1 relative">
                                                <input
                                                    type="number"
                                                    value={level}
                                                    onChange={(e) => handleLevelChange(index, e.target.value)}
                                                    className="w-full bg-transparent text-gray-900 text-sm focus:outline-none pl-1 pr-8 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none font-medium"
                                                    placeholder="0.00"
                                                    step="0.01"
                                                />
                                                <span className="absolute right-0 top-1/2 -translate-y-1/2 text-xs text-gray-400 pointer-events-none pr-3">%</span>
                                            </div>
                                            <button
                                                onClick={() => removeLevel(index)}
                                                className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                        <p className="text-xs text-gray-500 leading-relaxed mt-2">
                            Percentage of investment amount for each level.
                        </p>
                    </div>

                    <button
                        onClick={handleSaveLevel}
                        disabled={savingLevel}
                        className="w-full py-3 bg-primary hover:bg-accent text-primary-foreground rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {savingLevel ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Update
                    </button>
                </div>

                {/* Card 3: Matching Income */}
                <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-6 h-full flex flex-col justify-between hover:shadow-md transition-shadow">
                    <div>
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-3 bg-yellow-500/10 rounded-xl">
                                <Trophy className="w-6 h-6 text-yellow-500" />
                            </div>
                            <h2 className="text-xl font-semibold text-gray-900">
                                Matching Income
                            </h2>
                        </div>

                        <div className="space-y-4 mb-6">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">Matching Bonus (%)</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={settings.matchingIncome}
                                        onChange={(e) => setSettings({ ...settings, matchingIncome: Number(e.target.value) })}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:border-primary focus:bg-white transition-colors pl-14"
                                        placeholder="0.00"
                                        step="0.01"
                                        min="0"
                                        max="100"
                                    />
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-500">%</span>
                                </div>
                                <p className="text-xs text-gray-500 leading-relaxed">
                                    Percentage of matching volume.
                                </p>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={handleSaveMatching}
                        disabled={savingMatching}
                        className="w-full py-3 bg-primary hover:bg-accent text-primary-foreground rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {savingMatching ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Update
                    </button>
                </div>
            </div>

            {/* Horizontal Card: Withdrawal Settings */}
            <div className="bg-white border border-gray-100 shadow-sm rounded-2xl p-6 hover:shadow-md transition-shadow">
                <div className="flex flex-col gap-6">
                    <div className="w-full">
                        <div className="flex items-center gap-3 mb-6">
                            <div className="p-3 bg-indigo-500/10 rounded-xl">
                                <Coins className="w-6 h-6 text-indigo-500" />
                            </div>
                            <h2 className="text-xl font-semibold text-gray-900">
                                Withdrawal Settings
                            </h2>
                        </div>

                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">Minimum Withdrawal (SFT)</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={settings.minWithdrawal}
                                        onChange={(e) => setSettings({ ...settings, minWithdrawal: Number(e.target.value) })}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:border-primary focus:bg-white transition-colors"
                                        placeholder="0"
                                        min="0"
                                    />
                                </div>
                                <p className="text-xs text-gray-500 leading-relaxed">
                                    Minimum amount required to withdraw.
                                </p>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">Max Income Multiplier (x)</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={settings.maxIncomeMultiplier}
                                        onChange={(e) => setSettings({ ...settings, maxIncomeMultiplier: Number(e.target.value) })}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:border-primary focus:bg-white transition-colors"
                                        placeholder="0"
                                        step="0.1"
                                        min="0"
                                    />
                                </div>
                                <p className="text-xs text-gray-500 leading-relaxed">
                                    Total income cap (e.g., 2x or 3x of investment).
                                </p>
                            </div>

                            <div className="space-y-2">
                                <label className="text-sm font-medium text-gray-700">Withdrawal Fee (%)</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={settings.withdrawalFee}
                                        onChange={(e) => setSettings({ ...settings, withdrawalFee: Number(e.target.value) })}
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:outline-none focus:border-primary focus:bg-white transition-colors pl-14"
                                        placeholder="0"
                                        step="0.01"
                                        min="0"
                                        max="100"
                                    />
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm font-medium text-gray-500">%</span>
                                </div>
                                <p className="text-xs text-gray-500 leading-relaxed">
                                    Percentage fee charged on withdrawals.
                                </p>
                            </div>
                        </div>
                    </div>

                    <button
                        onClick={handleSaveWithdrawal}
                        disabled={savingWithdrawal}
                        className="w-full py-3 bg-primary hover:bg-accent text-primary-foreground rounded-xl font-medium transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                    >
                        {savingWithdrawal ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                        Update
                    </button>
                </div>
            </div>
        </div>
    );
}
