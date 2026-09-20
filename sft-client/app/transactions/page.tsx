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
    plan?: {
        name: string;
    };
}

export default function UserTransactionsPage() {
    const { token, _hasHydrated } = useUserStore();
    const router = useRouter();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!_hasHydrated) return;
        if (!token) {
            router.push('/login');
            return;
        }

        fetchTransactions();
    }, [token, _hasHydrated, router]);

    const fetchTransactions = async () => {
        try {
            const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
            const axios = await import('axios').then(m => m.default);
            const { data } = await axios.get(`${apiBase}/investments/transactions`, {
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
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 animate-in fade-in duration-700">
            <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent mb-8">
                Transaction History
            </h1>

            <div className="bg-white/5 backdrop-blur-xl border border-white/10 rounded-2xl p-6 shadow-xl overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="text-gray-400 border-b border-white/10">
                            <th className="p-4">Type</th>
                            <th className="p-4">Description</th>
                            <th className="p-4">Amount</th>
                            <th className="p-4">Status</th>
                            <th className="p-4">Date</th>
                            <th className="p-4">Explorer</th>
                        </tr>
                    </thead>
                    <tbody>
                        {transactions.map(tx => {
                            const isIncoming = tx.type === 'SFT_TRANSFER';
                            return (
                                <tr key={tx._id} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                    <td className="p-4">
                                        <span className={`flex items-center gap-2 font-bold ${isIncoming ? 'text-green-400' : 'text-red-400'}`}>
                                            {isIncoming ? '⬇ Received' : '⬆ Sent'}
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        {tx.type === 'PURCHASE' && 'USDT Payment for Investment'}
                                        {tx.type === 'SFT_TRANSFER' && 'SFT Allocation Transfer'}
                                        {tx.plan && <span className="text-xs text-gray-500 block">{tx.plan.name}</span>}
                                    </td>
                                    <td className="p-4 font-mono text-lg">
                                        {isIncoming ? (
                                            <span className="text-green-400">+{tx.amountSFTAllocated || 0} SFT</span>
                                        ) : (
                                            <span className="text-red-400">-{tx.amountSFT} USDT</span>
                                        )}
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
                                                className="text-blue-400 hover:text-blue-300 text-xs font-mono underline decoration-dotted"
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
