'use client';

import { useState, useEffect, use } from 'react';
import axios from 'axios';
import { useUserStore } from '@/lib/store';
import { useRouter } from 'next/navigation';
import { Banknote, Users, Download, Clock, ArrowRightLeft } from 'lucide-react';
import { Spinner } from '@/components/Spinner';

export default function AdminUserEarningsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: userId } = use(params);
    const router = useRouter();
    const { token, user, _hasHydrated } = useUserStore();

    const [summary, setSummary] = useState<any>(null);
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    // Pagination
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    useEffect(() => {
        if (!_hasHydrated) return;
        if (!token || user?.role !== 'admin') {
            router.push('/login');
            return;
        }

        fetchData();
    }, [token, userId, page, _hasHydrated]);

    const fetchData = async () => {
        try {
            const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
            const config = { headers: { Authorization: `Bearer ${token}` } };
            const limit = 10;

            const [summaryRes, historyRes] = await Promise.all([
                axios.get(`${apiBase}/earnings/admin/summary/${userId}`, config),
                axios.get(`${apiBase}/investments/admin/user/${userId}/transactions?page=${page}&limit=${limit}`, config)
            ]);

            setSummary(summaryRes.data);
            setHistory(historyRes.data.transactions || []);
            setTotalPages(historyRes.data.pagination?.pages || 1);
        } catch (error) {
            console.error("Error fetching admin user earnings:", error);
        } finally {
            setLoading(false);
        }
    };

    if (loading || !_hasHydrated) {
        return <div className="flex justify-center p-10"><Spinner size="lg" /></div>;
    }

    return (
        <div className="space-y-8 min-h-screen p-4 animate-in fade-in duration-700">
            <div className="flex items-center gap-4">
                <button
                    onClick={() => router.back()}
                    className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors"
                >
                    ← Back
                </button>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">User Earnings Report</h1>
            </div>

            {/* Withdrawal Limit Section */}
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-xl relative overflow-hidden">
                <div className="relative z-10">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-4">
                        <div className="flex items-center gap-3">
                            <div className="p-2 bg-indigo-50 rounded-lg">
                                <Banknote className="h-5 w-5 text-indigo-600" />
                            </div>
                            <div>
                                <h2 className="text-lg font-bold text-foreground">Withdrawal Limit</h2>
                                <p className="text-muted text-xs">
                                    Max withdrawal potential based on investments.
                                </p>
                            </div>
                        </div>
                        <div className="text-right">
                            <p className="text-xs text-muted font-medium">Remaining Limit</p>
                            <p className="text-2xl font-bold text-indigo-600">{Math.max(0, (summary?.maxIncomeLimit || 0) - ((summary?.totalWithdrawn || 0) + (summary?.totalPending || 0))).toFixed(6)} SFT</p>
                        </div>
                    </div>

                    {/* Progress Bar */}
                    <div className="mb-4">
                        <div className="flex justify-between text-xs mb-1.5 font-medium">
                            <span className="text-muted">
                                Used: <span className="text-foreground">{((summary?.totalWithdrawn || 0) + (summary?.totalPending || 0)).toFixed(6)} SFT</span>
                            </span>
                            <span className="text-muted">
                                Max: <span className="text-foreground">{(summary?.maxIncomeLimit || 0).toFixed(6)} SFT</span>
                            </span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2.5 overflow-hidden">
                            <div
                                className="h-full rounded-full transition-all duration-1000 ease-out bg-gradient-to-r from-indigo-500 to-indigo-600 shadow-sm"
                                style={{
                                    width: `${Math.min(100, Math.max(0, (((summary?.totalWithdrawn || 0) + (summary?.totalPending || 0)) / (summary?.maxIncomeLimit || 1)) * 100))}%`
                                }}
                            ></div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Totals Section */}
            <div>
                <h2 className="text-xl font-semibold mb-4 text-foreground">Account Totals</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                    <SummaryCard
                        title="Total Earned"
                        value={`${(summary?.totalEarned || 0).toFixed(6)} SFT`}
                        icon={<Banknote className="h-6 w-6 text-green-400" />}
                        color="green"
                    />
                    <SummaryCard
                        title="Total Withdrawn"
                        value={`${(summary?.totalWithdrawn || 0).toFixed(6)} SFT`}
                        icon={<Download className="h-6 w-6 text-red-400" />}
                        color="red"
                    />
                    <SummaryCard
                        title="Available Balance"
                        value={`${(summary?.availableBalance || 0).toFixed(6)} SFT`}
                        icon={<ArrowRightLeft className="h-6 w-6 text-primary" />}
                        color="gold"
                    />
                    <SummaryCard
                        title="Pending Withdrawals"
                        value={`${(summary?.totalPending || 0).toFixed(6)} SFT`}
                        icon={<Clock className="h-6 w-6 text-orange-400" />}
                        color="orange"
                    />
                </div>
            </div>

            {/* Income Sources Section */}
            <div>
                <h2 className="text-xl font-semibold mb-4 text-foreground">Income Sources (Lifetime)</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                    <SummaryCard
                        title="Total ROI Earnings"
                        value={`${(summary?.totalROI || 0).toFixed(6)} SFT`}
                        icon={<Banknote className="h-6 w-6 text-pink-400" />}
                        color="pink"
                        subValue={`Available to Transfer: ${(summary?.availableToTransferROI || 0).toFixed(6)} SFT`}
                    />
                    <SummaryCard
                        title="Total Referral Earnings"
                        value={`${(summary?.totalReferralEarnings || 0).toFixed(6)} SFT`}
                        icon={<Users className="h-6 w-6 text-blue-400" />}
                        color="blue"
                        subValue={`Available to Transfer: ${(summary?.availableToTransferReferral || 0).toFixed(6)} SFT`}
                    />
                    <SummaryCard
                        title="Total Level Income"
                        value={`${(summary?.totalLevelIncome || 0).toFixed(6)} SFT`}
                        icon={<Users className="h-6 w-6 text-indigo-400" />}
                        color="indigo"
                        subValue={`Available to Transfer: ${(summary?.availableToTransferLevel || 0).toFixed(6)} SFT`}
                    />
                    <SummaryCard
                        title="Total Matching Income"
                        value={`${(summary?.totalMatchingIncome || 0).toFixed(6)} SFT`}
                        icon={<Users className="h-6 w-6 text-purple-400" />}
                        color="purple"
                        subValue={`Available to Transfer: ${(summary?.availableToTransferMatching || 0).toFixed(6)} SFT`}
                    />
                </div>
            </div>

            {/* Transaction History Table */}
            <div className="bg-white backdrop-blur-xl border border-gray-200 rounded-2xl shadow-xl overflow-hidden">
                <div className="p-4 md:p-6 border-b border-gray-100">
                    <h2 className="text-xl font-semibold text-foreground">Earnings History</h2>
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-secondary text-muted text-sm">
                            <tr>
                                <th className="px-6 py-4 font-medium whitespace-nowrap">Date</th>
                                <th className="px-6 py-4 font-medium whitespace-nowrap">Type</th>
                                <th className="px-6 py-4 font-medium whitespace-nowrap">Amount</th>
                                <th className="px-6 py-4 font-medium whitespace-nowrap">Status</th>
                                <th className="px-6 py-4 font-medium whitespace-nowrap">Tx Hash</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {history.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-muted">
                                        No transactions found.
                                    </td>
                                </tr>
                            ) : (
                                history.map((tx: any) => {
                                    return (
                                        <tr key={tx._id} className="hover:bg-secondary/50 transition-colors">
                                            <td className="px-6 py-4 text-sm whitespace-nowrap text-foreground">
                                                {new Date(tx.createdAt).toLocaleDateString('en-GB')}
                                            </td>
                                            <td className="px-6 py-4 text-sm font-medium text-foreground whitespace-nowrap">
                                                {tx.type}
                                            </td>
                                            <td className={`px-6 py-4 text-sm font-bold whitespace-nowrap ${['WITHDRAWAL', 'PURCHASE'].includes(tx.type) ? 'text-red-500' : 'text-green-500'
                                                }`}>
                                                {['WITHDRAWAL', 'PURCHASE'].includes(tx.type) ? '-' : '+'}{tx.amountSFT} SFT
                                            </td>
                                            <td className="px-6 py-4 text-sm whitespace-nowrap">
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium
                                                    ${tx.status === 'COMPLETED' ? 'bg-green-500/10 text-green-600' :
                                                        tx.status === 'PENDING' ? 'bg-yellow-500/10 text-yellow-600' :
                                                            'bg-red-500/10 text-red-600'}`}>
                                                    {tx.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm font-mono whitespace-nowrap text-muted">
                                                {tx.txHash ? tx.txHash.substring(0, 10) + '...' : '-'}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
                {/* Pagination */}
                {totalPages > 1 && (
                    <div className="flex justify-center items-center gap-2 mt-8 pb-8">
                        <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-2 bg-gray-100 rounded disabled:opacity-50">Prev</button>
                        <span className="text-sm">Page {page} of {totalPages}</span>
                        <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-2 bg-gray-100 rounded disabled:opacity-50">Next</button>
                    </div>
                )}
            </div>
        </div>
    );
}

const SummaryCard = ({ title, value, icon, color, subValue, onAction, actionLabel }: any) => {
    const colorClasses: any = {
        gold: { border: 'hover:border-primary/50', bg: 'bg-primary/10' },
        green: { border: 'hover:border-green-500/50', bg: 'bg-green-500/10' },
        blue: { border: 'hover:border-blue-500/50', bg: 'bg-blue-500/10' },
        red: { border: 'hover:border-red-500/50', bg: 'bg-red-500/10' },
        orange: { border: 'hover:border-orange-500/50', bg: 'bg-orange-500/10' },
        pink: { border: 'hover:border-pink-500/50', bg: 'bg-pink-500/10' },
        indigo: { border: 'hover:border-indigo-500/50', bg: 'bg-indigo-500/10' },
        purple: { border: 'hover:border-purple-500/50', bg: 'bg-purple-500/10' },
    };
    const colors = colorClasses[color] || colorClasses.gold;

    return (
        <div className={`bg-white border p-6 rounded-2xl relative overflow-hidden group hover:shadow-lg transition-all ${colors.border}`}>
            <div className={`absolute -right-4 -top-4 w-24 h-24 ${colors.bg} rounded-full blur-2xl opacity-50`}></div>
            <div className="relative z-10">
                <div className="flex justify-between items-start mb-4">
                    <p className="text-muted text-sm font-medium">{title}</p>
                    <span className="p-2 bg-gray-50 rounded-lg">{icon}</span>
                </div>
                <h3 className="text-2xl font-bold text-foreground mb-1">{value}</h3>
                {subValue && <p className="text-xs text-muted font-mono">{subValue}</p>}
            </div>
        </div>
    );
};
