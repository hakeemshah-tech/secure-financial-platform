'use client';

import React, { useEffect, useState } from 'react';
import { useUserStore } from '@/lib/store';
import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { Spinner } from '@/components/Spinner';
import { TransactionHistory } from '@/components/TransactionHistory';
import { ChevronLeft } from 'lucide-react';

export default function AdminUserViewPage() {
    const { token, user, _hasHydrated } = useUserStore();
    const router = useRouter();
    const params = useParams();
    const userId = params.id as string;

    const [isLoading, setIsLoading] = useState(true);
    const [viewedUser, setViewedUser] = useState<any>(null);
    const [investments, setInvestments] = useState<any[]>([]);

    // Stats State
    const [stats, setStats] = useState({
        totalIncome: 0,
        totalWithdrawn: 0,
        totalPending: 0
    });

    useEffect(() => {
        if (!_hasHydrated) return;
        if (!token || user?.role !== 'admin') {
            router.push('/login');
            return;
        }

        fetchData();
    }, [token, userId, _hasHydrated]);

    const fetchData = async () => {
        try {
            setIsLoading(true);
            const axios = await import('axios').then(m => m.default);
            const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

            // 1. Fetch User Details
            const userRes = await axios.get(`${apiBase}/users/${userId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setViewedUser(userRes.data);

            // 2. Fetch Earnings Summary (Admin endpoint)
            const statsRes = await axios.get(`${apiBase}/earnings/admin/summary/${userId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setStats({
                totalIncome: statsRes.data.totalIncome || 0,
                totalPending: statsRes.data.totalPending || 0,
                totalWithdrawn: statsRes.data.totalWithdrawn || 0
            });

            // 3. Fetch Investments (Admin endpoint)
            const invRes = await axios.get(`${apiBase}/investments/admin/user/${userId}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setInvestments(invRes.data.investments || []);



        } catch (error: any) {
            console.error("Failed to fetch user data", error);
            if (error.response?.status === 404) {
                alert("User not found");
                router.push('/admin/users');
            }
        } finally {
            setIsLoading(false);
        }
    };



    if (isLoading || !_hasHydrated) return <div className="flex min-h-screen items-center justify-center"><Spinner size="lg" /></div>;

    const totalInvestedSFT = investments
        .filter((inv: any) => ['PAID', 'COMPLETED'].includes(inv.status))
        .reduce((sum: number, inv: any) => sum + (inv.amountSFT || 0), 0);

    return (
        <div className="space-y-8 pb-24 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header / Nav */}
            <div className="flex items-center gap-4">
                <Link href="/admin/users" className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors">
                    <ChevronLeft size={24} className="text-gray-600" />
                </Link>
                <div>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                        User Details: {viewedUser?.username || 'Unknown'}
                    </h1>
                    <div className="flex items-center gap-3 text-sm text-gray-500 mt-1">
                        <span>{viewedUser?.email}</span>
                        <span>•</span>
                        <span className="font-mono">{viewedUser?.walletAddress || 'No Wallet'}</span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold border ${viewedUser?.isActive
                            ? 'bg-green-100 text-green-700 border-green-200'
                            : 'bg-red-100 text-red-700 border-red-200'}`}>
                            {viewedUser?.isActive ? 'Active Plan' : 'Inactive'}
                        </span>
                        {viewedUser?.referrer && (
                            <>
                                <span>•</span>
                                <span>Referred by: {viewedUser.referrer.username || viewedUser.referrer.email}</span>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatsCard title="Total SFT Locked" value={`${totalInvestedSFT.toFixed(2)} SFT`} icon="🔒" color="gold" />
                <StatsCard title="Total Withdrawal Pending" value={`${stats.totalPending.toFixed(2)} SFT`} icon="⏳" color="blue" />
                <StatsCard title="Total Earnings" value={`${stats.totalIncome.toFixed(2)} SFT`} icon="💰" color="green" />
            </div>

            {/* Navigation Cards */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <Link href={`/admin/users/${userId}/tree`} className="group">
                    <div className="bg-white hover:bg-green-50/50 border border-gray-200 p-6 rounded-2xl transition-all hover:shadow-lg hover:-translate-y-1">
                        <div className="flex items-center gap-4 mb-3">
                            <div className="p-3 bg-green-100 rounded-xl text-green-600 group-hover:bg-green-200 transition-colors">
                                <span className="text-2xl">🌳</span>
                            </div>
                            <h3 className="text-xl font-bold text-gray-800">Binary Tree</h3>
                        </div>
                        <p className="text-sm text-gray-500">View detailed referral network structure and placement.</p>
                    </div>
                </Link>

                <Link href={`/admin/users/${userId}/requests`} className="group">
                    <div className="bg-white hover:bg-blue-50/50 border border-gray-200 p-6 rounded-2xl transition-all hover:shadow-lg hover:-translate-y-1">
                        <div className="flex items-center gap-4 mb-3">
                            <div className="p-3 bg-blue-100 rounded-xl text-blue-600 group-hover:bg-blue-200 transition-colors">
                                <span className="text-2xl">📝</span>
                            </div>
                            <h3 className="text-xl font-bold text-gray-800">Requests History</h3>
                        </div>
                        <p className="text-sm text-gray-500">View investments, withdrawals, and other requests.</p>
                    </div>
                </Link>

                <Link href={`/admin/users/${userId}/earnings`} className="group">
                    <div className="bg-white hover:bg-purple-50/50 border border-gray-200 p-6 rounded-2xl transition-all hover:shadow-lg hover:-translate-y-1">
                        <div className="flex items-center gap-4 mb-3">
                            <div className="p-3 bg-purple-100 rounded-xl text-purple-600 group-hover:bg-purple-200 transition-colors">
                                <span className="text-2xl">💰</span>
                            </div>
                            <h3 className="text-xl font-bold text-gray-800">Earnings Report</h3>
                        </div>
                        <p className="text-sm text-gray-500">Detailed breakdown of income sources and wallet balance.</p>
                    </div>
                </Link>
            </div>

            {/* Content Area */}
            <div className="grid grid-cols-1 lg:grid-cols-1 gap-8">

                {/* Investments */}
                <div className="bg-white backdrop-blur-xl border border-gray-200 rounded-2xl p-6 shadow-xl">
                    <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                        <span className="p-2 bg-primary/10 rounded-lg text-primary">📈</span> Investments (Latest)
                    </h2>
                    <div className="space-y-4 max-h-[400px] overflow-y-auto">
                        {investments.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-32 text-gray-400 border-2 border-dashed border-gray-100 rounded-xl">
                                <p>No investments found</p>
                            </div>
                        ) : (
                            investments.map((inv: any) => (
                                <div key={inv._id} className="bg-secondary/50 p-4 rounded-xl border border-gray-200">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h3 className="font-bold text-gray-900">{inv.plan?.name || 'Unknown Plan'}</h3>
                                            <p className="text-sm text-gray-500">{inv.amountSFT} SFT</p>
                                        </div>
                                        <div className="text-right">
                                            <span className={`text-xs font-bold px-2 py-1 rounded-full ${inv.status === 'PAID' ? 'bg-purple-100 text-purple-600' :
                                                inv.status === 'COMPLETED' ? 'bg-green-100 text-green-600' :
                                                    inv.status === 'PENDING' ? 'bg-yellow-100 text-yellow-600' :
                                                        'bg-red-100 text-red-600'
                                                }`}>
                                                {inv.status}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="mt-2 text-xs text-gray-400 flex justify-between">
                                        <span>Allocated: {inv.sftAllocated}</span>
                                        <span>{new Date(inv.createdAt).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Recent Transactions Preview (Linked to full page) */}
            <div className="mt-8">
                <div className="flex justify-between items-center mb-4">
                    <h2 className="text-xl font-semibold flex items-center gap-2">
                        <span className="p-2 bg-primary/10 rounded-lg text-primary">📜</span> Recent Transactions
                    </h2>
                    <Link href={`/admin/users/${userId}/requests`} className="text-primary hover:underline text-sm font-medium">
                        View All
                    </Link>
                </div>
                {/* We can re-use TransactionHistory but limit it or just rely on the link. 
                    Let's just show the component with limit 5 explicitly if possible, or just the link. 
                    User asked to "show the main page (dashboard view of that user there should include transaction history also)".
                    So I will keep TransactionHistory but maybe limit it? The component defaults to 10. That's fine.
                */}
                <TransactionHistory apiEndpoint={`/investments/admin/user/${userId}/transactions`} />
            </div>
        </div>
    );
}

const StatsCard = ({ title, value, icon, color }: { title: string, value: string, icon: string, color: string }) => {
    const colorClasses = {
        gold: { border: 'hover:border-primary/50', bg: 'bg-primary/10', hoverBg: 'group-hover:bg-primary/20' },
        green: { border: 'hover:border-green-500/50', bg: 'bg-green-500/10', hoverBg: 'group-hover:bg-green-500/20' },
        blue: { border: 'hover:border-blue-500/50', bg: 'bg-blue-500/10', hoverBg: 'group-hover:bg-blue-500/20' }
    };
    const colors = colorClasses[color as keyof typeof colorClasses] || colorClasses.gold;

    return (
        <div className={`bg-white backdrop-blur-xl border border-gray-200 p-6 rounded-2xl relative overflow-hidden group ${colors.border} transition-colors shadow-sm`}>
            <div className={`absolute -right-4 -top-4 w-24 h-24 ${colors.bg} rounded-full blur-2xl ${colors.hoverBg} transition-all`}></div>
            <div className="relative z-10">
                <div className="flex justify-between items-start mb-4">
                    <p className="text-muted text-sm font-medium">{title}</p>
                    <span className="text-2xl">{icon}</span>
                </div>
                <h3 className="text-3xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-foreground to-muted">
                    {value}
                </h3>
            </div>
        </div>
    );
}
