'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useUserStore } from '@/lib/store';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Spinner } from '@/components/Spinner';
import { Modal } from '@/components/Modal';

interface Plan {
    _id: string;
    name: string;
    description?: string;
    lockInPeriodDays: number;
    sftPrice: number;
    minInvestmentSFT: number;
    roiPercent: number;
    isActive: boolean;
    isDeleted: boolean; // Added isDeleted
    walletAddress?: string;
    investmentCount?: number; // Added investmentCount
}

export default function AdminPlansPage() {
    const { user, token, _hasHydrated } = useUserStore();
    const router = useRouter();
    const [plans, setPlans] = useState<Plan[]>([]);
    const [loading, setLoading] = useState(true);
    const [adminWallet, setAdminWallet] = useState<string>('');

    // Modal state
    const [modalConfig, setModalConfig] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        type: 'info' | 'confirm' | 'warning'; // Added warning
        onConfirm?: () => void;
    }>({
        isOpen: false,
        title: '',
        message: '',
        type: 'info'
    });

    const showModal = (title: string, message: string, type: 'info' | 'confirm' | 'warning' = 'info', onConfirm?: () => void) => {
        setModalConfig({ isOpen: true, title, message, type, onConfirm });
    };

    const closeModal = () => {
        setModalConfig(prev => ({ ...prev, isOpen: false }));
    };

    useEffect(() => {
        if (!_hasHydrated) return;

        if (!token || user?.role !== 'admin') {
            if (user && user.role !== 'admin') {
                router.push('/dashboard');
                return;
            }
            if (!token) {
                router.push('/login');
                return;
            }
        }

        const fetchPlans = async () => {
            try {
                const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
                const [plansRes, walletRes] = await Promise.all([
                    axios.get(`${apiBase}/plans?includeDeleted=true`),
                    axios.get(`${apiBase}/auth/admin-wallet`)
                ]);
                setPlans(plansRes.data);
                setAdminWallet(walletRes.data.walletAddress);
            } catch (err) {
                console.error("Failed to fetch plans", err);
            } finally {
                setLoading(false);
            }
        };

        fetchPlans();
    }, [token, user, _hasHydrated, router]);

    const handleEdit = (plan: Plan) => {
        if (plan.isDeleted) return; // Prevent editing deleted plans

        if (plan.investmentCount && plan.investmentCount > 0) {
            showModal(
                "Cannot Edit Plan",
                "Users have already invested in this plan. Editing is disabled to ensure data consistency.",
                "info"
            );
        } else {
            router.push(`/admin/plans/edit/${plan._id}`);
        }
    };

    const deletePlan = (plan: Plan) => {
        if (plan.isDeleted) return; // Already deleted

        if (plan.investmentCount && plan.investmentCount > 0) {
            showModal(
                "Confirm Soft Delete",
                "This plan has existing investments. It will be temporarily deleted (hidden from users) but kept in the database for verification purposes. Are you sure?",
                "confirm",
                () => executeDelete(plan._id)
            );
        } else {
            showModal(
                "Confirm Permanent Delete",
                "No investments found for this plan. It will be permanently deleted. Are you sure?",
                "confirm",
                () => executeDelete(plan._id)
            );
        }
    };

    const executeDelete = async (id: string) => {
        closeModal();
        try {
            const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
            const res = await axios.delete(`${apiBase}/plans/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            // If it was a hard delete (type='hard'), remove from list.
            // If it was a soft delete (type='soft'), we update the plan in the list to be isDeleted=true.

            if (res.data.type === 'soft') {
                setPlans(plans.map(p => p._id === id ? { ...p, isDeleted: true } : p));
            } else {
                setPlans(plans.filter(p => p._id !== id));
            }

        } catch (err: any) {
            console.error("Failed to delete plan", err);
            showModal("Error", err.response?.data?.message || "Failed to delete plan");
        }
    };

    if (loading || !_hasHydrated) {
        return <div className="flex min-h-[50vh] items-center justify-center"><Spinner size="lg" /></div>;
    }

    return (
        <div className="space-y-8 pb-64 md:pb-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 md:gap-0">
                <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                    Manage Investment Plans
                </h1>
                <Link href="/admin/plans/create">
                    <button className="w-full md:w-auto bg-primary hover:bg-accent text-primary-foreground font-bold py-2 px-4 rounded-lg transition-all">
                        + Create New Plan
                    </button>
                </Link>
            </div>

            {/* Wallet Info Card */}
            <div className={`p-6 rounded-2xl border ${adminWallet && !adminWallet.includes('PLACEHOLDER')
                ? 'bg-green-500/10 border-green-500/30'
                : 'bg-yellow-500/10 border-yellow-500/30'
                }`}>
                <h3 className="text-lg font-semibold mb-2">System Receiving Wallet</h3>
                <div className="flex flex-col md:flex-row items-start md:items-center gap-2 md:gap-4">
                    <code className="bg-black/30 px-4 py-2 rounded-lg font-mono text-sm break-all w-full md:w-auto">
                        {adminWallet || 'Not Configured'}
                    </code>
                    {(!adminWallet || adminWallet.includes('PLACEHOLDER')) && (
                        <span className="text-sm text-yellow-500 flex items-center gap-1">
                            ⚠ Pending Setup. Please "Link Wallet" in the top bar.
                        </span>
                    )}
                    {adminWallet && !adminWallet.includes('PLACEHOLDER') && (
                        <span className="text-sm text-green-500 flex items-center gap-1">
                            ✓ Active
                        </span>
                    )}
                </div>
                <p className="text-xs text-gray-400 mt-2">All investments will be sent to this address.</p>
            </div>

            <div className="bg-white backdrop-blur-xl border border-gray-200 rounded-2xl overflow-x-auto shadow-sm">
                <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                        <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lock Duration</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Investment SFT</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Receiving SFT</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ROI %</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Wallet Address</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200 bg-white">
                        {plans.map(plan => (
                            <tr key={plan._id} className={`hover:bg-gray-50 transition-colors ${plan.isDeleted ? 'opacity-50 grayscale' : ''}`}>
                                <td className="px-6 py-4 whitespace-nowrap">
                                    <div className="text-sm font-bold text-gray-900 flex items-center gap-2">
                                        {plan.name}
                                        {plan.isDeleted && (
                                            <span className="bg-red-500/20 text-red-500 text-[10px] px-2 py-0.5 rounded border border-red-500/30">
                                                DELETED
                                            </span>
                                        )}
                                    </div>
                                    <div className="text-xs text-gray-500">{plan.description || 'No description'}</div>
                                    {plan.investmentCount && plan.investmentCount > 0 ? (
                                        <div className="text-[10px] text-yellow-600 mt-1">Has Investments: {plan.investmentCount}</div>
                                    ) : null}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{plan.lockInPeriodDays} Days</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{plan.minInvestmentSFT} SFT</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{plan.minInvestmentSFT + (plan.minInvestmentSFT * plan.roiPercent / 100)} SFT</td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-semibold">{plan.roiPercent}%</td>
                                <td className="px-6 py-4 whitespace-nowrap text-xs text-gray-500 font-mono">
                                    {plan.walletAddress ? (
                                        <span className="break-all">{plan.walletAddress}</span>
                                    ) : (
                                        <span className="opacity-50">Default (Admin)</span>
                                    )}
                                </td>
                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium flex gap-4">
                                    {!plan.isDeleted ? (
                                        <>
                                            <button
                                                onClick={() => handleEdit(plan)}
                                                className={`text-primary hover:text-accent ${plan.investmentCount && plan.investmentCount > 0 ? 'opacity-50 cursor-not-allowed' : ''}`}
                                            >
                                                Edit
                                            </button>
                                            <button onClick={() => deletePlan(plan)} className="text-red-400 hover:text-red-300">Delete</button>
                                        </>
                                    ) : (
                                        <span className="text-gray-500 italic text-xs">Archived</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {plans.length === 0 && (
                    <div className="p-8 text-center text-gray-500">No investment plans found. Create one to get started.</div>
                )}
            </div>

            <Modal
                isOpen={modalConfig.isOpen}
                onClose={closeModal}
                title={modalConfig.title}
                footer={
                    modalConfig.type === 'confirm' ? (
                        <>
                            <button
                                onClick={closeModal}
                                className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg transition-colors text-sm"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={modalConfig.onConfirm}
                                className="bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white px-4 py-2 rounded-lg transition-all shadow-lg shadow-red-500/20 text-sm font-semibold"
                            >
                                Delete
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={closeModal}
                            className="bg-gray-100 hover:bg-gray-200 text-gray-700 px-4 py-2 rounded-lg transition-colors text-sm"
                        >
                            Close
                        </button>
                    )
                }
            >
                <div>
                    <p className="text-gray-600">{modalConfig.message}</p>
                </div>
            </Modal>
        </div >
    );
}
