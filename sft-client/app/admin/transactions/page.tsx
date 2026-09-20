'use client';

import React, { useEffect, useState } from 'react';
import { useUserStore } from '@/lib/store';
import { useRouter } from 'next/navigation';
import { Spinner } from '@/components/Spinner';

interface Transaction {
    _id: string;
    type: string;
    amountSFT: number;
    amountSFTAllocated: number;
    status: string;
    txHash?: string;
    createdAt: string;
    user: {
        name: string;
        email: string;
        walletAddress: string;
    };
    plan?: {
        name: string;
    };
}

export default function AdminTransactionsPage() {
    const { token, user, _hasHydrated } = useUserStore();
    const router = useRouter();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!_hasHydrated) return;

        // Case-insensitive check
        const isAdmin = user?.role?.toLowerCase() === 'admin';

        if (!token || !isAdmin) {
            router.push('/login');
            return;
        }

        fetchTransactions();
    }, [token, user, _hasHydrated, router]);

    const fetchTransactions = async () => {
        try {
            const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
            const axios = await import('axios').then(m => m.default);
            const { data } = await axios.get(`${apiBase}/investments/admin/transactions`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setTransactions(data);
        } catch (error) {
            console.error("Failed to fetch transactions", error);
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading || !_hasHydrated) {
        return <div className="flex justify-center p-10"><Spinner size="lg" /></div>;
    }

    return (
        <div className="p-8 animate-in fade-in duration-700">
            <div className="flex justify-between items-center mb-8">
                <h1 className="text-3xl font-bold bg-gradient-to-r from-yellow-400 to-red-500 bg-clip-text text-transparent">
                    All User Transactions
                </h1>
                <button
                    onClick={fetchTransactions}
                    className="bg-primary hover:bg-accent text-primary-foreground px-4 py-2 rounded-lg transition-colors"
                >
                    🔄 Refresh
                </button>
            </div>

            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="text-gray-400 border-b border-white/10">
                            <th className="p-4">User</th>
                            <th className="p-4">Type</th>
                            <th className="p-4">Amount</th>
                            <th className="p-4">Status</th>
                            <th className="p-4">Date</th>
                            <th className="p-4">Explorer</th>
                        </tr>
                    </thead>
                    <tbody>
                        {transactions.map(tx => {
                            const getTxDetails = (type: string) => {
                                switch (type) {
                                    case 'PURCHASE':
                                        // Admin Receives SFT (Label changed from USDT)
                                        return { label: '⬇ Received', color: 'text-green-400', amountColor: 'text-green-400', prefix: '+' };
                                    case 'SFT_TRANSFER':
                                        // Admin Sends SFT
                                        return { label: '⬆ Sent', color: 'text-red-400', amountColor: 'text-yellow-400', prefix: '-' };
                                    case 'MATURITY_PAYOUT':
                                        // Admin Sends USDT
                                        return { label: '⬆ Sent', color: 'text-red-400', amountColor: 'text-red-400', prefix: '-' };
                                    default:
                                        return { label: type, color: 'text-gray-400', amountColor: 'text-gray-400', prefix: '' };
                                }
                            };

                            const details = getTxDetails(tx.type);

                            return (
                                <tr key={tx._id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                    <td className="p-4">
                                        <div className="font-bold">{tx.user?.name || 'Unknown'}</div>
                                        <div className="text-xs text-gray-500">{tx.user?.email}</div>
                                        <div className="text-[10px] text-gray-600 font-mono truncate max-w-[100px]">{tx.user?.walletAddress}</div>
                                    </td>
                                    <td className="p-4">
                                        <span className={`block font-bold ${details.color}`}>
                                            {details.label}
                                        </span>
                                        <span className="text-xs text-gray-500">
                                            {tx.type}
                                        </span>
                                    </td>
                                    <td className="p-4 font-mono text-lg">
                                        <span className={details.amountColor}>
                                            {details.prefix}
                                            {tx.type === 'SFT_TRANSFER'
                                                ? (tx.amountSFTAllocated || 0) + ' SFT'
                                                : (tx.amountSFT || 0) + ' SFT'}
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${tx.status === 'COMPLETED' ? 'bg-green-500/20 text-green-500' :
                                            tx.status === 'PENDING' ? 'bg-yellow-500/20 text-yellow-500' :
                                                'bg-red-500/20 text-red-500'
                                            }`}>
                                            {tx.status}
                                        </span>
                                    </td>
                                    <td className="p-4 text-gray-400 text-sm">
                                        {new Date(tx.createdAt).toLocaleString()}
                                    </td>
                                    <td className="p-4">
                                        {tx.txHash ? (
                                            <a
                                                href={`https://bscscan.com/tx/${tx.txHash}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-primary hover:text-accent text-xs font-mono underline decoration-dotted"
                                            >
                                                View Tx ↗
                                            </a>
                                        ) : (
                                            <span className="text-gray-600">-</span>
                                        )}
                                    </td>
                                </tr>
                            );
                        })}
                        {transactions.length === 0 && (
                            <tr>
                                <td colSpan={6} className="text-center py-8 text-gray-500">
                                    No transactions found.
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
