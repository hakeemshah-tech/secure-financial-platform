'use client';

import React, { useEffect, useState, use } from 'react';
import axios from 'axios';
import { useUserStore } from '@/lib/store';
import { useRouter } from 'next/navigation';
import { Spinner } from '@/components/Spinner';
import { ChevronLeft, ChevronRight } from 'lucide-react';

export default function AdminUserRequestsPage({ params }: { params: Promise<{ id: string }> }) {
    const { id: userId } = use(params);
    const { token, user, _hasHydrated } = useUserStore();
    const router = useRouter();
    const [investments, setInvestments] = useState<any[]>([]);
    const [withdrawals, setWithdrawals] = useState<any[]>([]);
    const [swaps, setSwaps] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'investments' | 'swaps' | 'withdrawals'>('investments');

    // Pagination State
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    useEffect(() => {
        if (!_hasHydrated) return;
        if (!token || user?.role !== 'admin') {
            router.push('/login');
            return;
        }

        fetchData();
    }, [token, _hasHydrated, activeTab, page, userId]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
            const config = { headers: { Authorization: `Bearer ${token}` } };
            const limit = 10;

            if (activeTab === 'investments') {
                const res = await axios.get(`${apiBase}/investments/admin/user/${userId}?page=${page}&limit=${limit}`, config);
                setInvestments(res.data.investments || []);
                setTotalPages(res.data.pagination?.pages || 1);
            } else if (activeTab === 'swaps') {
                const res = await axios.get(`${apiBase}/swaps/admin/user/${userId}?page=${page}&limit=${limit}`, config);
                setSwaps(res.data.requests || []);
                setTotalPages(res.data.pagination?.pages || 1);
            } else if (activeTab === 'withdrawals') {
                // Fetching transactions for withdrawals tab
                const res = await axios.get(`${apiBase}/investments/admin/user/${userId}/transactions?page=${page}&limit=${limit}&type=WITHDRAWAL`, config);
                setWithdrawals(res.data.transactions || []);
                setTotalPages(res.data.pagination?.pages || 1);
            }

        } catch (error: any) {
            console.error("❌ Failed to fetch requests:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const getRemainingDays = (maturityDate: string) => {
        const now = new Date();
        const maturity = new Date(maturityDate);
        const diffTime = maturity.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays > 0 ? diffDays : 0;
    };

    if (isLoading && page === 1) {
        return <div className="flex justify-center p-10"><Spinner size="lg" /></div>;
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-700 min-h-screen p-4">
            <div className="flex items-center gap-4">
                <button
                    onClick={() => router.back()}
                    className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors"
                >
                    ← Back
                </button>
                <div className="flex flex-col">
                    <h1 className="text-2xl font-bold bg-gradient-to-r from-yellow-400 to-red-500 bg-clip-text text-transparent">
                        User Request History
                    </h1>
                </div>
            </div>

            <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
                <div className="flex bg-gray-100 p-1 rounded-lg">
                    <button
                        onClick={() => { setActiveTab('investments'); setPage(1); }}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'investments' ? 'bg-white text-primary shadow-sm' : 'text-muted hover:text-foreground'}`}
                    >
                        Investments
                    </button>
                    <button
                        onClick={() => { setActiveTab('swaps'); setPage(1); }}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'swaps' ? 'bg-white text-primary shadow-sm' : 'text-muted hover:text-foreground'}`}
                    >
                        Swaps
                    </button>
                    <button
                        onClick={() => { setActiveTab('withdrawals'); setPage(1); }}
                        className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'withdrawals' ? 'bg-white text-primary shadow-sm' : 'text-muted hover:text-foreground'}`}
                    >
                        Profit Withdrawals
                    </button>
                </div>
                <button onClick={fetchData} className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-all shadow-sm">
                    Refresh
                </button>
            </div>

            {/* Swaps Tab */}
            {activeTab === 'swaps' && (
                <div className="bg-white border boundary-gray-200 rounded-xl overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Date</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">From</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">To</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Amount</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Tx Hash</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {swaps.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="px-6 py-8 text-center text-muted">No swap requests found.</td>
                                    </tr>
                                ) : (
                                    swaps.map((swap) => (
                                        <tr key={swap._id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                                                {new Date(swap.createdAt).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-foreground">{swap.fromToken}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-foreground">{swap.toToken}</td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">{swap.amount}</td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium 
                                            ${swap.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                                                        swap.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' :
                                                            swap.status === 'REJECTED' ? 'bg-red-100 text-red-700' :
                                                                'bg-gray-100 text-gray-700'}`}>
                                                    {swap.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-muted">
                                                {swap.userTxHash ? (
                                                    <a href={`https://bscscan.com/tx/${swap.userTxHash}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                                                        View
                                                    </a>
                                                ) : '-'}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Withdrawals/Transactions Tab */}
            {activeTab === 'withdrawals' && (
                <div className="bg-white border boundary-gray-200 rounded-xl overflow-hidden shadow-sm">
                    <div className="overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200">
                            <thead className="bg-gray-50">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Date</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Type</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Amount</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Status</th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Tx Hash</th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {withdrawals.length === 0 ? (
                                    <tr>
                                        <td colSpan={5} className="px-6 py-8 text-center text-muted">No transactions found.</td>
                                    </tr>
                                ) : (
                                    withdrawals.map((tx) => (
                                        <tr key={tx._id} className="hover:bg-gray-50 transition-colors">
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                                                {new Date(tx.createdAt).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">
                                                {tx.type}
                                            </td>
                                            <td className={`px-6 py-4 whitespace-nowrap text-sm font-bold ${['WITHDRAWAL', 'PURCHASE'].includes(tx.type) ? 'text-red-500' : 'text-green-500'
                                                }`}>
                                                {['WITHDRAWAL', 'PURCHASE'].includes(tx.type) ? '-' : '+'}{tx.amountSFT} SFT
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap">
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium 
                                            ${tx.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                                                        tx.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' :
                                                            tx.status === 'REJECTED' ? 'bg-red-100 text-red-700' :
                                                                'bg-gray-100 text-gray-700'}`}>
                                                    {tx.status}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-muted">
                                                {tx.txHash ? (
                                                    <a href={`https://bscscan.com/tx/${tx.txHash}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:underline">
                                                        View
                                                    </a>
                                                ) : '-'}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}

            {/* Investments Tab */}
            {activeTab === 'investments' && (
                <div className="bg-white backdrop-blur-xl border border-gray-200 rounded-2xl p-4 md:p-6 overflow-x-auto shadow-xl">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="text-muted border-b border-gray-100">
                                <th className="p-3 whitespace-nowrap">Type</th>
                                <th className="p-3 whitespace-nowrap">Plan</th>
                                <th className="p-3 whitespace-nowrap">Amount</th>
                                <th className="p-3 whitespace-nowrap">Expectation</th>
                                <th className="p-3 whitespace-nowrap">Lock Duration</th>
                                <th className="p-3 whitespace-nowrap">Status</th>
                                <th className="p-3 whitespace-nowrap">TxHash</th>
                            </tr>
                        </thead>
                        <tbody>
                            {investments.map(inv => {
                                const remainingDays = getRemainingDays(inv.maturityDate);
                                const displayHash = inv.txHash || inv.sftTxHash;
                                return (
                                    <tr key={inv._id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors text-foreground">
                                        <td className="p-3 whitespace-nowrap">
                                            <span className={`px-2 py-1 rounded text-xs font-bold ${inv.requestType === 'WITHDRAWAL' ? 'bg-secondary text-secondary-foreground border border-gray-200' : 'bg-primary/10 text-primary'}`}>
                                                {inv.requestType === 'WITHDRAWAL' ? 'WITHDRAWAL' : 'INVESTMENT'}
                                            </span>
                                        </td>
                                        <td className="p-3 text-foreground whitespace-nowrap">{inv.plan?.name || 'Unknown'}</td>
                                        <td className="p-3 font-mono text-foreground whitespace-nowrap">{inv.amountSFT} SFT</td>
                                        <td className="p-3 font-mono text-foreground whitespace-nowrap">{inv.sftAllocated} SFT</td>
                                        <td className="p-3 font-mono text-yellow-500 whitespace-nowrap">{remainingDays} Days Left</td>
                                        <td className="p-3 whitespace-nowrap">
                                            <span className={`px-2 py-1 rounded-full text-xs font-bold ${inv.status.includes('PENDING') ? 'bg-yellow-500/10 text-yellow-600' : 'bg-green-500/10 text-green-600'}`}>
                                                {inv.status.replace('_', ' ')}
                                            </span>
                                        </td>
                                        <td className="p-3 whitespace-nowrap">
                                            {displayHash ? (
                                                <a
                                                    href={`https://bscscan.com/tx/${displayHash}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-primary hover:text-accent text-xs font-mono underline"
                                                >
                                                    View
                                                </a>
                                            ) : '-'}
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                    {investments.length === 0 && <p className="text-center text-muted py-8">No requests found.</p>}
                </div>
            )}

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex justify-center items-center gap-2 mt-8 pb-8">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="p-2 bg-gray-100 rounded disabled:opacity-50">Prev</button>
                    <span className="text-sm">Page {page} of {totalPages}</span>
                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="p-2 bg-gray-100 rounded disabled:opacity-50">Next</button>
                </div>
            )}
        </div >
    );
}
