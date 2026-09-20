'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-hot-toast';
import { useUserStore } from '@/lib/store';
import {
    ArrowRightLeft,
    Banknote,
    Clock,
    Download,
    Users,
    Wallet, // Added Icon
    ChevronLeft,
    ChevronRight,
} from 'lucide-react';
import { connectBNBWallet, ACTIVE_CONFIG } from '@/lib/ethereum';
import { NetworkSelectionModal } from '@/components/NetworkSelectionModal';
import { useRouter } from 'next/navigation';
import { EmailVerificationModal } from '@/components/EmailVerificationModal';

const EarningsPage = () => {
    const router = useRouter();
    const [summary, setSummary] = useState<any>(null);
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [withdrawAmount, setWithdrawAmount] = useState('');
    const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
    const [isWarningModalOpen, setIsWarningModalOpen] = useState(false);
    const [isMinWithdrawWarningOpen, setIsMinWithdrawWarningOpen] = useState(false);
    const [isLimitReachedModalOpen, setIsLimitReachedModalOpen] = useState(false);
    const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false);

    // Pagination State
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    // Transfer State
    const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
    const [transferAmount, setTransferAmount] = useState('');
    const [transferSource, setTransferSource] = useState('');
    const [transferMaxAmount, setTransferMaxAmount] = useState(0);

    const [settings, setSettings] = useState({ minWithdrawal: 0, withdrawalFee: 0, maxIncomeMultiplier: 2 });

    const { token, user, setUser, activeNetwork } = useUserStore();
    const [isWalletModalOpen, setIsWalletModalOpen] = useState(false);
    const [walletModalMode, setWalletModalMode] = useState<'select' | 'input'>('select');
    const [walletAddressInput, setWalletAddressInput] = useState('');
    const [linkError, setLinkError] = useState<string | null>(null);
    const [showNetworkModal, setShowNetworkModal] = useState(false);
    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

    const axiosConfig = {
        headers: {
            Authorization: `Bearer ${token}`
        }
    };

    useEffect(() => {
        if (token) {
            fetchData();
        }
    }, [token, page]);

    const fetchData = async () => {
        try {
            const limit = 10;
            const [summaryRes, historyRes, settingsRes] = await Promise.all([
                axios.get(`${apiBase}/earnings/summary`, axiosConfig),
                axios.get(`${apiBase}/earnings/history?page=${page}&limit=${limit}`, axiosConfig),
                axios.get(`${apiBase}/settings/income`, axiosConfig)
            ]);
            setSummary(summaryRes.data);
            setHistory(historyRes.data.transactions || []);
            setTotalPages(historyRes.data.pagination?.pages || 1);
            setSettings({
                minWithdrawal: settingsRes.data.minWithdrawal || 0,
                withdrawalFee: settingsRes.data.withdrawalFee || 0,
                maxIncomeMultiplier: settingsRes.data.maxIncomeMultiplier || 2
            });
        } catch (error) {
            console.error("Error fetching earnings data:", error);
            // toast.error("Failed to load earnings data");
        } finally {
            setLoading(false);
        }
    };

    const handleWithdrawClick = () => {
        const available = summary?.availableBalance || 0;
        const minWithdraw = settings.minWithdrawal || 0;

        if (!user?.walletAddress || user.walletAddress.startsWith('PENDING_')) {
            setWalletModalMode('select'); // Reset to selection
            setLinkError(null); // Clear previous errors
            setIsWalletModalOpen(true);
            return;
        }

        if (!user?.isEmailVerified) {
            setIsVerificationModalOpen(true);
            return;
        }

        if (available <= 0) {
            setIsWarningModalOpen(true);
        } else if (available < minWithdraw) {
            setIsMinWithdrawWarningOpen(true);
        } else {
            setWithdrawAmount(available.toString());
            setIsWithdrawModalOpen(true);
        }
    };

    const handleLinkWallet = async (e: React.FormEvent) => {
        e.preventDefault();
        setLinkError(null);
        try {
            await axios.post(`${apiBase}/auth/link-wallet`, { walletAddress: walletAddressInput }, axiosConfig);
            toast.success("Wallet linked successfully!");

            // Update local user state
            setUser({ ...user, walletAddress: walletAddressInput });

            setIsWalletModalOpen(false);
            // Optionally auto-open withdraw modal? No, let them click again as per plan.
        } catch (error: any) {
            console.error("Link wallet error:", error);
            const msg = error.response?.data?.message || "Failed to link wallet";
            setLinkError(msg);
            toast.error(msg);
        }
    };

    const handleAutoConnect = () => {
        setLinkError(null);
        setShowNetworkModal(true);
    };

    const handleNetworkSelect = async (networkParams: any) => {
        setShowNetworkModal(false);
        setLinkError(null);
        try {
            const address = await connectBNBWallet(networkParams);

            // Allow calling the API with this address
            await axios.post(`${apiBase}/auth/link-wallet`, { walletAddress: address }, axiosConfig);
            toast.success("Wallet linked successfully!");
            setUser({ ...user, walletAddress: address });
            setIsWalletModalOpen(false);
        } catch (error: any) {
            console.error("Auto connect error:", error.response?.data || error); // Log server response

            let msg = error.response?.data?.message || error.message || "Failed to connect wallet";
            if (msg.includes("already linked")) {
                msg = "This wallet is already linked to another account. Please switch accounts in your wallet app.";
            }

            setLinkError(msg);
            toast.error(msg);
        }
    };

    const handleWithdraw = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await axios.post(`${apiBase}/earnings/withdraw`, { amount: Number(withdrawAmount) }, axiosConfig);
            toast.success("Withdrawal request submitted successfully!");
            setIsWithdrawModalOpen(false);
            setWithdrawAmount('');
            fetchData(); // Refresh data
            router.push('/requests'); // Redirect to Requests page
        } catch (error: any) {
            const msg = error.response?.data?.message || "Withdrawal failed";

            // Check case-insensitive for better matching
            if (msg.toLowerCase().includes("withdrawal limit") || msg.toLowerCase().includes("limit reached") || msg.includes("limit")) {
                setIsLimitReachedModalOpen(true);
                setIsWithdrawModalOpen(false); // Close the withdraw input modal
                // Error is handled, suppressing console.error to keep console clean
            } else {
                console.error("Withdrawal error:", error);
                toast.error(msg);
            }
        }
    };

    const openTransferModal = (source: string, maxAmount: number) => {
        setTransferSource(source);
        setTransferMaxAmount(maxAmount);
        setTransferAmount(maxAmount.toString()); // Default to max
        setIsTransferModalOpen(true);
    };

    const handleTransfer = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            await axios.post(`${apiBase}/earnings/transfer`, {
                amount: Number(transferAmount),
                sourceType: transferSource
            }, axiosConfig);
            toast.success("Funds transferred to Available Wallet!");
            setIsTransferModalOpen(false);
            setTransferAmount('');
            fetchData();
        } catch (error: any) {
            console.error("Transfer error:", error);
            toast.error(error.response?.data?.message || "Transfer failed");
        }
    };

    // Render Pagination Controls
    const renderPagination = () => {
        if (totalPages <= 1) return null;

        const renderPageNumbers = () => {
            const range = [];
            if (totalPages <= 7) {
                for (let i = 1; i <= totalPages; i++) range.push(i);
            } else {
                if (page <= 4) {
                    range.push(1, 2, 3, 4, 5, '...', totalPages);
                } else if (page >= totalPages - 3) {
                    range.push(1, '...', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages);
                } else {
                    range.push(1, '...', page - 1, page, page + 1, '...', totalPages);
                }
            }

            return range.map((p, i) => (
                p === '...' ? (
                    <span key={`dots-${i}`} className="w-8 text-center text-gray-400 font-medium tracking-widest">...</span>
                ) : (
                    <button
                        key={p}
                        onClick={() => setPage(Number(p))}
                        className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold transition-all ${page === p
                            ? 'bg-gray-900 text-white shadow-lg shadow-gray-200 transform scale-105'
                            : 'text-gray-600 hover:bg-gray-100'
                            }`}
                    >
                        {p}
                    </button>
                )
            ));
        };

        return (
            <div className="flex justify-center items-center gap-2 pt-6 pb-2">
                <button
                    onClick={() => setPage(p => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-gray-500 transition-colors"
                >
                    <ChevronLeft size={20} />
                </button>

                <div className="flex items-center gap-1">
                    {renderPageNumbers()}
                </div>

                <button
                    onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-gray-500 transition-colors"
                >
                    <ChevronRight size={20} />
                </button>
            </div>
        );
    };

    if (loading) {
        return (
            <div className="flex justify-center items-center min-h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
            </div>
        );
    }

    return (
        <div className="space-y-8 min-h-screen animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 md:gap-0">
                <div>
                    <h1 className="text-3xl md:text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">My Earnings</h1>
                    <div className="flex flex-wrap gap-3 mt-3">
                        <div className="px-3 py-1.5 bg-amber-500/10 border border-amber-500/20 rounded-full flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse"></span>
                            <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
                                Min Withdrawal: {settings.minWithdrawal} SFT
                            </span>
                        </div>
                        <div className="px-3 py-1.5 bg-blue-500/10 border border-blue-500/20 rounded-full flex items-center gap-2">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-500"></span>
                            <span className="text-xs font-medium text-blue-700 dark:text-blue-400">
                                Fee: {settings.withdrawalFee}%
                            </span>
                        </div>
                    </div>
                </div>
                <button
                    onClick={handleWithdrawClick}
                    className="w-full md:w-auto bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-white px-6 py-3 md:py-2 rounded-lg flex items-center justify-center gap-2 transition-all transform hover:scale-105 shadow-lg shadow-primary/20"
                >
                    <Download className="h-5 w-5" />
                    Withdraw Funds
                </button>
            </div>

            {/* Withdrawal Limit Section */}
            {/* Withdrawal Limit Section */}
            <div className="bg-white rounded-2xl p-5 border border-gray-100 shadow-2xl shadow-indigo-200/60 relative overflow-hidden">
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

                    {/* Calculation Breakdown */}
                    <div className="mb-3">
                        <div className="text-[11px] text-muted font-mono bg-gray-50/80 p-2.5 rounded-lg border border-gray-100 flex items-center justify-between">
                            <span className="font-semibold text-gray-700">Limit Formula:</span>
                            <div className="flex items-center gap-1.5">
                                <span>{((summary?.maxIncomeLimit || 0) / (settings.maxIncomeMultiplier || 1)).toFixed(2)} (Inv)</span>
                                <span>×</span>
                                <span>{settings.maxIncomeMultiplier}x</span>
                                <span>=</span>
                                <span className="text-indigo-600 font-bold">{(summary?.maxIncomeLimit || 0).toFixed(2)} Max</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 text-xs text-muted">
                        <Wallet className="h-3.5 w-3.5 text-indigo-500" />
                        <span>
                            To increase limit, <span className="font-bold text-indigo-600 cursor-pointer hover:underline hover:text-indigo-700 transition-colors" onClick={() => router.push('/invest')}>Invest More</span>.
                        </span>
                    </div>
                </div>
            </div>

            {/* Totals Section */}
            <div>
                <h2 className="text-xl font-semibold mb-4 text-foreground">Account Totals</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                    <SummaryCard
                        title="Current Balance"
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
                        title="Available to Withdraw"
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
                <h2 className="text-xl font-semibold mb-4 text-foreground">Income Sources</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                    <SummaryCard
                        title="Total Daily ROI Earnings"
                        value={`${(summary?.availableToTransferROI || 0).toFixed(6)} SFT`}
                        icon={<Banknote className="h-6 w-6 text-pink-400" />}
                        color="pink"
                        subValue={`Lifetime Earned: ${(summary?.totalROI || 0).toFixed(6)} SFT`}
                        onAction={() => openTransferModal('ROI', summary?.availableToTransferROI || 0)}
                        actionLabel="Transfer to Wallet"
                    />
                    <SummaryCard
                        title="Total Referral Earnings"
                        value={`${(summary?.availableToTransferReferral || 0).toFixed(6)} SFT`}
                        icon={<Users className="h-6 w-6 text-blue-400" />}
                        color="blue"
                        subValue={`Lifetime Earned: ${(summary?.totalReferralEarnings || 0).toFixed(6)} SFT`}
                        onAction={() => openTransferModal('REFERRAL', summary?.availableToTransferReferral || 0)}
                        actionLabel="Transfer to Wallet"
                    />
                    <SummaryCard
                        title="Total Level Income"
                        value={`${(summary?.availableToTransferLevel || 0).toFixed(6)} SFT`}
                        icon={<Users className="h-6 w-6 text-indigo-400" />}
                        color="indigo"
                        subValue={`Lifetime Earned: ${(summary?.totalLevelIncome || 0).toFixed(6)} SFT`}
                        onAction={() => openTransferModal('LEVEL', summary?.availableToTransferLevel || 0)}
                        actionLabel="Transfer to Wallet"
                    />
                    <SummaryCard
                        title="Total Matching Income"
                        value={`${(summary?.availableToTransferMatching || 0).toFixed(6)} SFT`}
                        icon={<Users className="h-6 w-6 text-purple-400" />}
                        color="purple"
                        subValue={`Lifetime Earned: ${(summary?.totalMatchingIncome || 0).toFixed(6)} SFT`}
                        onAction={() => openTransferModal('MATCHING', summary?.availableToTransferMatching || 0)}
                        actionLabel="Transfer to Wallet"
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
                                    const isSkipped = tx.status === 'SKIPPED';
                                    return (
                                        <tr key={tx._id} className={`transition-colors ${isSkipped
                                            ? 'bg-red-50 border-red-100 hover:bg-red-100'
                                            : 'hover:bg-secondary/50'
                                            }`}>
                                            <td className={`px-6 py-4 text-sm whitespace-nowrap ${isSkipped ? 'text-red-600' : 'text-foreground'}`}>
                                                <div className="flex flex-col">
                                                    <span className="font-medium">{new Date(tx.createdAt).toLocaleDateString('en-GB')}</span>
                                                    <span className="text-xs text-muted/80">
                                                        {new Date(tx.createdAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true })}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="px-6 py-4 text-sm font-medium text-foreground whitespace-nowrap">
                                                {tx.type === 'REFERRAL_REWARD' && <span className={`px-2 py-1 rounded-md text-xs ${isSkipped ? 'text-red-700 bg-red-100' : 'bg-green-500/10 text-green-600'}`}>Referral Reward</span>}
                                                {tx.type === 'ROI' && <span className={`px-2 py-1 rounded-md text-xs ${isSkipped ? 'text-red-700 bg-red-100' : 'bg-primary/10 text-primary'}`}>ROI</span>}
                                                {tx.type === 'WITHDRAWAL' && <span className="px-2 py-1 bg-red-500/10 text-red-600 rounded-md text-xs">Withdrawal</span>}
                                                {!['REFERRAL_REWARD', 'ROI', 'WITHDRAWAL'].includes(tx.type) && (
                                                    <span className={`px-2 py-1 rounded-md text-xs ${isSkipped ? 'text-red-700 bg-red-100' : 'bg-gray-500/10 text-muted'}`}>{tx.type}</span>
                                                )}
                                                {isSkipped && (
                                                    <div className="text-[10px] text-red-500 mt-1 italic leading-tight">
                                                        Income missed because<br />account is inactive
                                                    </div>
                                                )}
                                            </td>
                                            <td className={`px-6 py-4 text-sm font-bold whitespace-nowrap ${isSkipped ? 'text-red-600' :
                                                tx.type === 'WITHDRAWAL' ? 'text-red-500' : 'text-green-500'
                                                }`}>
                                                {tx.type === 'WITHDRAWAL' ? '-' : '+'}{tx.amountSFT} SFT
                                            </td>
                                            <td className="px-6 py-4 text-sm whitespace-nowrap">
                                                <span className={`px-2 py-1 rounded-full text-xs font-medium
                                                    ${isSkipped ? 'bg-red-200 text-red-800 border border-red-300' :
                                                        tx.status === 'COMPLETED' ? 'bg-green-500/10 text-green-600' :
                                                            tx.status === 'PENDING' ? 'bg-yellow-500/10 text-yellow-600' :
                                                                'bg-red-500/10 text-red-600'}`}>
                                                    {isSkipped ? 'Missed: Inactive' : tx.status}
                                                </span>
                                            </td>
                                            <td className={`px-6 py-4 text-sm font-mono whitespace-nowrap ${isSkipped ? 'text-red-400' : 'text-muted'}`}>
                                                {tx.txHash ? tx.txHash.substring(0, 10) + '...' : '-'}
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
                {/* Pagination Controls */}
                {renderPagination()}
            </div>

            {/* Withdrawal Modal */}
            {isWithdrawModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-md p-6 md:p-8 shadow-2xl transform transition-all scale-100">
                        <h2 className="text-2xl font-bold text-foreground mb-6">Withdraw Earnings</h2>
                        <form onSubmit={handleWithdraw} className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-muted mb-2">Amount to Withdraw (SFT)</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={withdrawAmount}
                                        readOnly
                                        className="w-full px-4 py-3 bg-gray-100 border border-gray-200 rounded-lg focus:ring-0 cursor-not-allowed transition-all text-lg text-foreground font-bold"
                                        placeholder="0.00"
                                    />
                                    <span className="absolute right-4 top-3.5 text-muted font-medium">SFT</span>
                                </div>
                                <div className="mt-2 text-sm space-y-1">
                                    <p className="text-muted">Available Balance: <span className="font-bold text-primary">{summary?.availableBalance || 0} SFT</span></p>
                                    <p className="text-xs text-blue-500 mt-1">* You must withdraw the full available amount.</p>
                                    {Number(withdrawAmount) > 0 && (
                                        <>
                                            <p className="text-muted flex justify-between mt-2 pt-2 border-t border-gray-100">
                                                <span>Withdrawal Fee ({settings.withdrawalFee}%):</span>
                                                <span className="text-red-500">
                                                    -{(Number(withdrawAmount) * settings.withdrawalFee / 100).toFixed(4)} SFT
                                                </span>
                                            </p>
                                            <p className="text-foreground font-medium flex justify-between pt-1">
                                                <span>You Receive:</span>
                                                <span className="text-green-600">
                                                    {(Number(withdrawAmount) - (Number(withdrawAmount) * settings.withdrawalFee / 100)).toFixed(4)} SFT
                                                </span>
                                            </p>
                                        </>
                                    )}
                                </div>
                            </div>
                            <div className="flex gap-4 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsWithdrawModalOpen(false)}
                                    className="flex-1 px-4 py-3 text-muted bg-secondary hover:bg-secondary/80 rounded-lg font-medium transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="flex-1 px-4 py-3 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-white rounded-lg font-medium shadow-lg shadow-primary/20 transition-all transform hover:scale-105"
                                >
                                    Confirm Withdrawal
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Transfer Modal */}
            {isTransferModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-md p-6 md:p-8 shadow-2xl transform transition-all scale-100">
                        <h2 className="text-2xl font-bold text-foreground mb-6">Transfer to Available Wallet</h2>
                        <form onSubmit={handleTransfer} className="space-y-6">
                            <div>
                                <label className="block text-sm font-medium text-muted mb-2">Amount to Transfer (SFT)</label>
                                <div className="relative">
                                    <input
                                        type="number"
                                        value={transferAmount}
                                        onChange={(e) => {
                                            const val = e.target.value;
                                            setTransferAmount(val);
                                        }}
                                        className={`w-full px-4 py-3 bg-secondary border ${Number(transferAmount) > transferMaxAmount ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-gray-200 focus:border-primary focus:ring-primary'} rounded-lg focus:ring-2 transition-all text-lg text-foreground`}
                                        placeholder="0.00"
                                        min="0.000001"
                                        max={transferMaxAmount}
                                        step="any"
                                        required
                                    />
                                    <span className="absolute right-4 top-3.5 text-muted font-medium">SFT</span>
                                </div>
                                <div className="flex justify-between items-center mt-2">
                                    <p className="text-sm text-muted">Available: <span className="font-bold text-primary">{transferMaxAmount.toFixed(6)} SFT</span></p>
                                    {Number(transferAmount) > transferMaxAmount && (
                                        <p className="text-sm text-red-500 font-medium">Exceeds available balance</p>
                                    )}
                                </div>
                            </div>
                            <div className="flex gap-4 pt-2">
                                <button
                                    type="button"
                                    onClick={() => setIsTransferModalOpen(false)}
                                    className="flex-1 px-4 py-3 text-muted bg-secondary hover:bg-secondary/80 rounded-lg font-medium transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={Number(transferAmount) > transferMaxAmount || Number(transferAmount) <= 0}
                                    className="flex-1 px-4 py-3 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-white rounded-lg font-medium shadow-lg shadow-primary/20 transition-all transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none"
                                >
                                    Transfer
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Warning Modal: 0 Balance */}
            {isWarningModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-md p-6 md:p-8 shadow-2xl transform transition-all scale-100">
                        <div className="flex flex-col items-center text-center">
                            <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mb-6">
                                <ArrowRightLeft className="h-8 w-8 text-yellow-600" />
                            </div>
                            <h2 className="text-2xl font-bold text-foreground mb-4">Transfer Required</h2>
                            <p className="text-muted mb-6">
                                Your <span className="font-semibold text-foreground">Available to Withdraw</span> balance is <span className="text-primary font-bold">0 SFT</span>.
                                <br /><br />
                                Please transfer funds from your income sources (ROI, Referral, Level, Matching) to your Available Wallet before withdrawing.
                            </p>
                            <button
                                onClick={() => setIsWarningModalOpen(false)}
                                className="w-full px-4 py-3 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-white rounded-lg font-medium shadow-lg shadow-primary/20 transition-all transform hover:scale-105"
                            >
                                Got it
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Warning Modal: Minimum Withdrawal */}
            {isMinWithdrawWarningOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-md p-6 md:p-8 shadow-2xl transform transition-all scale-100">
                        <div className="flex flex-col items-center text-center">
                            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-6">
                                <Banknote className="h-8 w-8 text-blue-600" />
                            </div>
                            <h2 className="text-2xl font-bold text-foreground mb-4">Minimum Withdrawal</h2>
                            <p className="text-muted mb-6">
                                The minimum withdrawal amount is <span className="font-bold text-primary">{settings.minWithdrawal} SFT</span>.
                                <br /><br />
                                Your current Available Balance is <span className="font-bold text-foreground">{summary?.availableBalance || 0} SFT</span>.
                                <br />
                                Please accumulate more funds to withdraw.
                            </p>
                            <button
                                onClick={() => setIsMinWithdrawWarningOpen(false)}
                                className="w-full px-4 py-3 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-white rounded-lg font-medium shadow-lg shadow-primary/20 transition-all transform hover:scale-105"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                </div>
            )}
            {/* Wallet Link Modal */}
            {isWalletModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-md p-6 md:p-8 shadow-2xl transform transition-all scale-100">
                        <div className="flex flex-col items-center text-center">
                            <div className="w-16 h-16 bg-blue-100 rounded-full flex items-center justify-center mb-6">
                                <Banknote className="h-8 w-8 text-blue-600" />
                            </div>
                            <h2 className="text-2xl font-bold text-foreground mb-4">Link Wallet Address</h2>
                            <p className="text-muted mb-6">
                                You must link your wallet address before withdrawing funds.
                                The admin will use this address to transfer your earnings.
                            </p>

                            {linkError && (
                                <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600 flex items-center justify-center gap-2 animate-in fade-in slide-in-from-top-2">
                                    <span className="font-bold">Error:</span> {linkError}
                                </div>
                            )}

                            {walletModalMode === 'select' ? (
                                <div className="space-y-3 w-full">
                                    <button
                                        onClick={handleAutoConnect}
                                        className="w-full flex items-center justify-between p-4 bg-gradient-to-r from-orange-400 to-orange-600 text-white rounded-xl hover:shadow-lg hover:scale-[1.02] transition-all group"
                                    >
                                        <div className="flex flex-col items-start">
                                            <span className="font-bold text-lg">Connect Wallet</span>
                                            <span className="text-xs text-white/90">Auto-detect MetaMask / TrustWallet</span>
                                        </div>
                                        <span className="text-2xl">🦊</span>
                                    </button>

                                    <button
                                        onClick={() => setWalletModalMode('input')}
                                        className="w-full flex items-center justify-between p-4 bg-white border-2 border-gray-100 text-gray-800 rounded-xl hover:border-primary/30 hover:bg-gray-50 transition-all group"
                                    >
                                        <div className="flex flex-col items-start">
                                            <span className="font-bold text-lg">Enter Manually</span>
                                            <span className="text-xs text-muted">Type or paste your address</span>
                                        </div>
                                        <span className="text-xl group-hover:translate-x-1 transition-transform">✍️</span>
                                    </button>
                                    <button
                                        onClick={() => setIsWalletModalOpen(false)}
                                        className="w-full py-2 text-muted hover:text-foreground transition-colors text-sm"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            ) : (
                                <form onSubmit={handleLinkWallet} className="w-full space-y-4 animate-in slide-in-from-right-4 duration-300">
                                    <div>
                                        <label className="block text-sm font-medium text-muted mb-2 text-left">Wallet Address (BEP-20)</label>
                                        <input
                                            type="text"
                                            value={walletAddressInput}
                                            onChange={(e) => setWalletAddressInput(e.target.value)}
                                            className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-all text-foreground font-mono text-sm"
                                            placeholder="0x..."
                                            required
                                        />
                                    </div>
                                    <div className="flex gap-3">
                                        <button
                                            type="button"
                                            onClick={() => setWalletModalMode('select')}
                                            className="flex-1 px-4 py-3 text-muted bg-secondary hover:bg-secondary/80 rounded-lg font-medium transition-colors"
                                        >
                                            Back
                                        </button>
                                        <button
                                            type="submit"
                                            className="flex-1 px-4 py-3 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-white rounded-lg font-medium shadow-lg shadow-primary/20 transition-all transform hover:scale-105"
                                        >
                                            Link Wallet
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                    </div>
                </div>
            )}
            {/* Limit Reached Modal */}
            {isLimitReachedModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
                    <div className="bg-white border border-gray-200 rounded-2xl w-full max-w-md p-6 md:p-8 shadow-2xl transform transition-all scale-100">
                        <div className="flex flex-col items-center text-center">
                            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-6">
                                <Banknote className="h-8 w-8 text-red-600" />
                            </div>
                            <h2 className="text-2xl font-bold text-foreground mb-4">Maximum Withdrawal Reached</h2>
                            <p className="text-muted mb-6">
                                You have reached your maximum withdrawal limit based on your current investment.
                                <br /><br />
                                To continue withdrawing your earnings, you need to increase your limit by investing more.
                            </p>
                            <div className="flex gap-4 w-full">
                                <button
                                    onClick={() => setIsLimitReachedModalOpen(false)}
                                    className="flex-1 px-4 py-3 text-muted bg-secondary hover:bg-secondary/80 rounded-lg font-medium transition-colors"
                                >
                                    Close
                                </button>
                                <button
                                    onClick={() => router.push('/invest')}
                                    className="flex-1 px-4 py-3 bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 text-white rounded-lg font-medium shadow-lg shadow-primary/20 transition-all transform hover:scale-105"
                                >
                                    Invest More
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Network Selection Modal */}
            <NetworkSelectionModal
                isOpen={showNetworkModal}
                onClose={() => setShowNetworkModal(false)}
                onSelectNetwork={handleNetworkSelect}
            />

            <EmailVerificationModal
                isOpen={isVerificationModalOpen}
                onClose={() => setIsVerificationModalOpen(false)}
            />
        </div >
    );
};

const SummaryCard = ({ title, value, icon, color, onAction, actionLabel, subValue }: any) => {
    // Helper to get color classes
    const colorClasses = {
        gold: {
            border: 'hover:border-primary/50',
            bg: 'bg-primary/10',
            hoverBg: 'group-hover:bg-primary/20',
            btn: 'bg-primary text-white hover:bg-primary/90'
        },
        green: {
            border: 'hover:border-green-500/50',
            bg: 'bg-green-500/10',
            hoverBg: 'group-hover:bg-green-500/20',
            btn: 'bg-green-500 text-white hover:bg-green-600'
        },
        red: {
            border: 'hover:border-red-500/50',
            bg: 'bg-red-500/10',
            hoverBg: 'group-hover:bg-red-500/20',
            btn: 'bg-red-500 text-white hover:bg-red-600'
        },
        purple: {
            border: 'hover:border-secondary/50',
            bg: 'bg-secondary/10',
            hoverBg: 'group-hover:bg-secondary/20',
            btn: 'bg-purple-500 text-white hover:bg-purple-600'
        },
        blue: {
            border: 'hover:border-primary/50',
            bg: 'bg-primary/10',
            hoverBg: 'group-hover:bg-primary/20',
            btn: 'bg-blue-500 text-white hover:bg-blue-600'
        },
        indigo: {
            border: 'hover:border-indigo-500/50',
            bg: 'bg-indigo-500/10',
            hoverBg: 'group-hover:bg-indigo-500/20',
            btn: 'bg-indigo-500 text-white hover:bg-indigo-600'
        },
        pink: {
            border: 'hover:border-pink-500/50',
            bg: 'bg-pink-500/10',
            hoverBg: 'group-hover:bg-pink-500/20',
            btn: 'bg-pink-500 text-white hover:bg-pink-600'
        },
        orange: {
            border: 'hover:border-orange-500/50',
            bg: 'bg-orange-500/10',
            hoverBg: 'group-hover:bg-orange-500/20',
            btn: 'bg-orange-500 text-white hover:bg-orange-600'
        }
    };

    const colors: any = colorClasses[color as keyof typeof colorClasses] || colorClasses.gold;

    return (
        <div className={`bg-white backdrop-blur-xl border border-gray-200 p-4 md:p-6 rounded-2xl relative overflow-hidden group ${colors.border} transition-colors shadow-sm`}>
            <div className={`absolute -right-4 -top-4 w-24 h-24 ${colors.bg} rounded-full blur-2xl ${colors.hoverBg} transition-all`}></div>
            <div className="relative z-10 flex items-center gap-4">
                <div className={`p-3 rounded-full ${colors.bg}`}>
                    {icon}
                </div>
                <div className="flex-1">
                    <p className="text-sm font-medium text-muted">{title}</p>
                    <p className="text-xl md:text-2xl font-bold text-foreground break-all">{value}</p>
                    {subValue && (
                        <p className="text-xs text-muted mt-1">{subValue}</p>
                    )}
                </div>
            </div>
            {onAction && (
                <div className="relative z-10 mt-4">
                    <button
                        onClick={onAction}
                        className={`w-full py-2 px-4 rounded-lg text-sm font-medium transition-colors ${colors.btn}`}
                    >
                        {actionLabel || 'Action'}
                    </button>
                </div>
            )}
        </div>
    );
};

export default EarningsPage;
