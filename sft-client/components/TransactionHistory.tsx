// ... existing code ...
import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useUserStore } from '@/lib/store';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface Transaction {
    _id: string;
    type: string;
    amountSFTAllocated?: number;
    amountSFT?: number;
    status: string;
    txHash?: string;
    createdAt: string;
    plan?: {
        name: string;
    };
}

interface TransactionHistoryProps {
    apiEndpoint?: string;
}

export const TransactionHistory = ({ apiEndpoint }: TransactionHistoryProps) => {
    const { token, _hasHydrated } = useUserStore();
    const [transactions, setTransactions] = useState<Transaction[]>([]);
    const [loading, setLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [pages, setPages] = useState(1);
    const [total, setTotal] = useState(0);

    const fetchTransactions = async (pageNum: number) => {
        try {
            setLoading(true);
            const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
            const endpoint = apiEndpoint || `/investments/transactions?page=${pageNum}&limit=10`;
            // If custom endpoint provided, ensure it has query params appended if not already
            const url = apiEndpoint
                ? `${apiBase}${apiEndpoint}${apiEndpoint.includes('?') ? '&' : '?'}page=${pageNum}&limit=10`
                : `${apiBase}/investments/transactions?page=${pageNum}&limit=10`;

            const { data } = await axios.get(url, {
                headers: { Authorization: `Bearer ${token}` }
            });

            // Check if response is paginated (new format) or array (old format fallback)
            if (data.transactions && data.pagination) {
                setTransactions(data.transactions);
                setPages(data.pagination.pages);
                setTotal(data.pagination.total);
                setPage(data.pagination.page);
            } else if (Array.isArray(data)) {
                // Fallback for non-paginated API if strictly needed, though we just updated it.
                // But better to stick to new format
                setTransactions(data);
                setPages(1);
                setTotal(data.length);
            }
        } catch (err: any) {
            if (err.response?.status === 403 && err.response?.data?.message?.includes('blocked')) {
                useUserStore.getState().logout();
                window.location.href = '/login';
                return;
            }
            console.error("Failed to fetch transactions", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!_hasHydrated || !token) return;
        fetchTransactions(page);
    }, [token, _hasHydrated, page]);

    if (loading && transactions.length === 0) {
        return <div className="text-center text-gray-500 py-4">Loading history...</div>;
    }

    return (
        <div className="bg-white border border-gray-200 rounded-2xl p-6 shadow-xl">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2 justify-between">
                <div className="flex items-center gap-2">
                    <span className="p-2 bg-primary/10 rounded-lg text-primary">📜</span> Transaction History
                </div>
                {total > 0 && <span className="text-sm text-gray-500 font-normal">Total: {total}</span>}
            </h2>
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead>
                        <tr className="text-gray-400 border-b border-gray-200">
                            <th className="p-2">Date</th>
                            <th className="p-2">Plan</th>
                            <th className="p-2">Type</th>
                            <th className="p-2">Amount</th>
                            <th className="p-2">Status</th>
                            <th className="p-2">TxHash</th>
                        </tr>
                    </thead>
                    <tbody>
                        {transactions.map(tx => {
                            const getTxDetails = (tx: Transaction) => {
                                if (tx.status === 'SKIPPED') {
                                    return { label: 'Missed: Inactive', color: 'text-red-500', amountColor: 'text-red-500', prefix: '' };
                                }

                                switch (tx.type) {
                                    case 'PURCHASE':
                                        return { label: '⬆ Sent', color: 'text-red-400', amountColor: 'text-red-400', prefix: '-' };
                                    case 'SFT_TRANSFER':
                                        return { label: '⬇ Received', color: 'text-green-400', amountColor: 'text-green-400', prefix: '+' };
                                    case 'MATURITY_PAYOUT':
                                        return { label: '⬇ Received', color: 'text-green-400', amountColor: 'text-green-400', prefix: '+' };
                                    case 'REFERRAL_REWARD':
                                    case 'LEVEL_INCOME':
                                    case 'MATCHING_INCOME':
                                    case 'ROI':
                                        return { label: '⬇ Received', color: 'text-green-400', amountColor: 'text-green-400', prefix: '+' };
                                    default:
                                        return { label: tx.type, color: 'text-gray-400', amountColor: 'text-gray-400', prefix: '' };
                                }
                            };

                            const details = getTxDetails(tx);
                            const isSkipped = tx.status === 'SKIPPED';

                            return (
                                <tr key={tx._id} className={`border-b last:border-0 transition-colors group ${isSkipped
                                    ? 'bg-red-50 border-red-100 hover:bg-red-100'
                                    : 'border-gray-100 hover:bg-primary/5'
                                    }`}>
                                    <td className={`p-2 ${isSkipped ? 'text-red-600' : 'text-gray-500'}`}>
                                        <div className="flex flex-col">
                                            <span className="font-medium text-foreground">{new Date(tx.createdAt).toLocaleDateString('en-GB')}</span>
                                            <span className="text-xs text-muted/80">
                                                {new Date(tx.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                                            </span>
                                        </div>
                                    </td>
                                    <td className={`p-2 ${isSkipped ? 'text-red-600' : ''}`}>{tx.plan?.name || '-'}</td>
                                    <td className="p-2">
                                        <span className={`block font-medium ${isSkipped ? 'text-red-700' : details.color}`}>
                                            {details.label}
                                        </span>
                                        <span className={`text-xs ${isSkipped ? 'text-red-500' : 'text-gray-500'}`}>{tx.type}</span>
                                        {isSkipped && (
                                            <div className="text-[10px] text-red-500 mt-1 italic leading-tight">
                                                Income missed because<br />account is inactive
                                            </div>
                                        )}
                                    </td>
                                    <td className="p-2">
                                        <span className={`${isSkipped ? 'text-red-600 font-bold' : details.amountColor} font-mono`}>
                                            {details.prefix}
                                            {tx.type === 'SFT_TRANSFER' || tx.type === 'SFT_ALLOCATED'
                                                ? tx.amountSFTAllocated?.toFixed(2) + ' SFT'
                                                : tx.amountSFT?.toFixed(2) + ' SFT'}
                                        </span>
                                    </td>
                                    <td className="p-2">
                                        <span className={`px-2 py-0.5 rounded text-xs ${isSkipped ? 'bg-red-200 text-red-800 border border-red-300' :
                                            tx.status === 'COMPLETED' ? 'bg-green-500/20 text-green-400' :
                                                tx.status === 'PENDING' ? 'bg-yellow-500/20 text-yellow-500' :
                                                    'bg-red-500/20 text-red-500'
                                            }`}>
                                            {tx.status}
                                        </span>
                                    </td>
                                    <td className={`p-2 font-mono text-xs ${isSkipped ? 'text-red-400' : 'text-gray-500'}`}>
                                        {tx.txHash ? (
                                            <a
                                                href={`https://bscscan.com/tx/${tx.txHash}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="text-primary hover:text-accent underline decoration-dotted"
                                                title={tx.txHash}
                                            >
                                                {tx.txHash.substring(0, 10)}...
                                            </a>
                                        ) : (
                                            <span className={isSkipped ? 'text-red-300' : 'text-gray-500'}>-</span>
                                        )}
                                    </td>
                                </tr>
                            )
                        })}
                        {transactions.length === 0 && (
                            <tr>
                                <td colSpan={6} className="text-center p-4 text-gray-500">
                                    No transactions found
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Pagination Controls */}
            {pages > 1 && (
                <div className="flex justify-center items-center gap-2 mt-6 animate-in fade-in slide-in-from-bottom-2">
                    <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1 || loading}
                        className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-gray-500 transition-colors"
                    >
                        <ChevronLeft size={20} />
                    </button>

                    <div className="flex items-center gap-1">
                        {(() => {
                            const range = [];
                            if (pages <= 7) {
                                for (let i = 1; i <= pages; i++) range.push(i);
                            } else {
                                if (page <= 4) {
                                    range.push(1, 2, 3, 4, 5, '...', pages);
                                } else if (page >= pages - 3) {
                                    range.push(1, '...', pages - 4, pages - 3, pages - 2, pages - 1, pages);
                                } else {
                                    range.push(1, '...', page - 1, page, page + 1, '...', pages);
                                }
                            }
                            return range.map((p, i) => (
                                p === '...' ? (
                                    <span key={`dots-${i}`} className="w-8 text-center text-gray-400 font-medium tracking-widest">...</span>
                                ) : (
                                    <button
                                        key={p}
                                        onClick={() => setPage(Number(p))}
                                        disabled={loading}
                                        className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold transition-all ${page === p
                                            ? 'bg-gray-900 text-white shadow-lg shadow-gray-200 transform scale-105'
                                            : 'text-gray-600 hover:bg-gray-100'
                                            }`}
                                    >
                                        {p}
                                    </button>
                                )
                            ));
                        })()}
                    </div>

                    <button
                        onClick={() => setPage(p => Math.min(pages, p + 1))}
                        disabled={page === pages || loading}
                        className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-gray-500 transition-colors"
                    >
                        <ChevronRight size={20} />
                    </button>
                </div>
            )}
        </div>
    );
};
