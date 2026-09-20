'use client';

import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useUserStore } from '@/lib/store';
import { useRouter } from 'next/navigation';
import { Spinner } from '@/components/Spinner';
import { Modal } from '@/components/Modal';
import { NetworkSelectionModal } from '@/components/NetworkSelectionModal';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { EmailVerificationModal } from '@/components/EmailVerificationModal';

interface Investment {
    _id: string;
    plan: {
        name: string;
    };
    walletAddress: string;
    amountSFT: number;
    sftAllocated: number;
    status: string;
    sftTxHash?: string;
    maturityDate: string;
    createdAt: string;
    requestType?: 'INVESTMENT' | 'WITHDRAWAL';
    txHash?: string;
    accumulatedROI?: number;
}

interface SwapRequest {
    _id: string;
    walletAddress: string;
    amount: number;
    fromToken: 'SFT' | 'USDT';
    toToken: 'USDT' | 'SFT';
    status: string;
    userTxHash?: string;
    adminTxHash?: string;
    createdAt: string;
}

interface WithdrawalRequest {
    _id: string;
    amountSFT: number;
    amountSFTAllocated: number; // Net amount
    status: string;
    fee: number;
    createdAt: string;
    txHash?: string;
}

export default function RequestsPage() {
    const { token, user, _hasHydrated } = useUserStore();
    const router = useRouter();
    const [investments, setInvestments] = useState<Investment[]>([]);
    const [swaps, setSwaps] = useState<SwapRequest[]>([]);
    const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'investments' | 'swaps' | 'withdrawals'>('investments');
    const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false);

    // Pagination State
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);

    // Modal State
    const [modal, setModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        type: 'info' | 'confirm';
        onConfirm?: () => void;
    }>({
        isOpen: false,
        title: '',
        message: '',
        type: 'info'
    });

    useEffect(() => {
        if (!_hasHydrated) return;

        if (!token) {
            router.push('/login');
            return;
        }

        fetchData();
    }, [token, _hasHydrated, router, activeTab, page]);

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
            const config = { headers: { Authorization: `Bearer ${token}` } };
            const limit = 10;

            if (activeTab === 'investments') {
                const res = await axios.get(`${apiBase}/investments/my?page=${page}&limit=${limit}`, config);
                setInvestments(res.data.investments || []);
                setTotalPages(res.data.pagination?.pages || 1);
            } else if (activeTab === 'swaps') {
                const res = await axios.get(`${apiBase}/swaps/my?page=${page}&limit=${limit}`, config);
                setSwaps(res.data.requests || []);
                setTotalPages(res.data.pagination?.pages || 1);
            } else if (activeTab === 'withdrawals') {
                const res = await axios.get(`${apiBase}/earnings/history?type=WITHDRAWAL&page=${page}&limit=${limit}`, config);
                setWithdrawals(res.data.transactions || []);
                setTotalPages(res.data.pagination?.pages || 1);
            }

        } catch (error: any) {
            console.error("❌ Failed to fetch requests:", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleTabChange = (tab: 'investments' | 'swaps' | 'withdrawals') => {
        if (activeTab !== tab) {
            setActiveTab(tab);
            setPage(1); // Reset page on tab change
            // fetchData will be triggered by useEffect
        }
    };

    const showModal = (title: string, message: string, type: 'info' | 'confirm' = 'info', onConfirm?: () => void) => {
        setModal({ isOpen: true, title, message, type, onConfirm });
    };

    const closeModal = () => {
        setModal(prev => ({ ...prev, isOpen: false }));
    };

    const handleCancel = (id: string) => {
        showModal(
            'Confirm Cancel',
            'Are you sure you want to cancel this request?',
            'confirm',
            () => executeCancel(id)
        );
    };

    const executeCancel = async (id: string) => {
        closeModal();
        try {
            const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
            await axios.put(`${apiBase}/investments/${id}/cancel-my`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            showModal("Success", "Request cancelled successfully!");
            fetchData();
        } catch (error: any) {
            console.error("Cancel failed", error);
            showModal("Error", `Failed to cancel: ${error.response?.data?.message || error.message}`);
        }
    };

    const handlePayment = async (investment: any) => {
        try {
            const { connectBNBWallet, BNB_MAINNET_PARAMS, PLATFORM_TOKEN_ADDRESS } = await import('@/lib/ethereum');
            const { ethers } = await import('ethers');
            const axios = await import('axios').then(m => m.default);

            // Connect wallet - Enforce BNB Mainnet for SFT
            const walletAddress = await connectBNBWallet(BNB_MAINNET_PARAMS);
            const provider = new ethers.BrowserProvider((window as any).ethereum);
            const signer = await provider.getSigner();

            // SFT Contract on BSC Mainnet
            const SFT_ADDRESS = PLATFORM_TOKEN_ADDRESS;
            const SFT_ABI = [
                "function transfer(address to, uint256 amount) returns (bool)",
                "function decimals() view returns (uint8)",
                "function balanceOf(address account) view returns (uint256)",
                "function symbol() view returns (string)"
            ];

            // Get admin wallet
            const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
            let adminWallet = '';

            try {
                // 1. Try Settings First (Active Network)
                const s = await axios.get(`${apiBase}/settings`);
                adminWallet = s.data.active_network?.adminWallet;

                // 2. Fallback to Admin User Profile
                if (!adminWallet) {
                    const adminRes = await axios.get(`${apiBase}/auth/admin-wallet`);
                    if (adminRes.data?.walletAddress && !adminRes.data.walletAddress.startsWith('PENDING_') && !adminRes.data.walletAddress.startsWith('ADMIN_')) {
                        adminWallet = adminRes.data.walletAddress;
                    }
                }
            } catch (e) {
                console.error("Failed to fetch admin wallet", e);
            }

            if (!adminWallet) {
                showModal("System Error", "Admin wallet not configured. Cannot process payment.");
                return;
            }

            // Normalize
            try {
                adminWallet = ethers.getAddress(adminWallet);
            } catch {
                adminWallet = ethers.getAddress(adminWallet.toLowerCase());
            }

            const sftContract = new ethers.Contract(SFT_ADDRESS, SFT_ABI, signer);

            // Fetch decimals dynamically
            const decimals = await sftContract.decimals();
            const symbol = await sftContract.symbol();

            const amountVal = investment.amountSFT || investment.amountUSDT || 0;
            const amountWei = ethers.parseUnits(amountVal.toString(), decimals);

            // Check balance
            const balance = await sftContract.balanceOf(walletAddress);
            if (balance < amountWei) {
                const formattedBalance = ethers.formatUnits(balance, decimals);
                showModal("Insufficient Balance", `You have ${formattedBalance} ${symbol}, but need ${amountVal} ${symbol}.`);
                return;
            }

            // Transfer SFT
            const tx = await sftContract.transfer(adminWallet, amountWei);
            await tx.wait();

            // Confirm payment to backend
            await axios.put(`${apiBase}/investments/${investment._id}/payment`, {
                txHash: tx.hash
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            showModal("Success", `Payment of ${amountVal} ${symbol} successful! Waiting for admin confirmation.`);
            fetchData();
        } catch (error: any) {
            console.error("Payment failed", error);
            if (error.code === 'ACTION_REJECTED' || error.code === 4001) {
                showModal("Transaction Cancelled", "You rejected the transaction in MetaMask.");
            } else {
                showModal("Payment Failed", error.reason || error.message || "An unexpected error occurred.");
            }
        }
    };

    const handleWithdraw = async (id: string) => {
        // [NEW] Check Verification
        if (!user?.isEmailVerified) {
            setIsVerificationModalOpen(true);
            return;
        }

        try {
            const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
            await axios.put(`${apiBase}/investments/${id}/withdraw-request`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            showModal("Success", "Withdrawal requested successfully!");
            fetchData();
        } catch (error: any) {
            console.error("Withdraw request failed", error);
            showModal("Error", `Failed to request withdrawal: ${error.response?.data?.message || error.message}`);
        }
    };

    const getRemainingDays = (maturityDate: string) => {
        const now = new Date();
        const maturity = new Date(maturityDate);
        const diffTime = maturity.getTime() - now.getTime();
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        return diffDays > 0 ? diffDays : 0;
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
            <div className="flex justify-center items-center gap-2 mt-8 pb-8">
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


    if (isLoading && page === 1 && investments.length === 0 && swaps.length === 0 && withdrawals.length === 0) {
        return <div className="flex justify-center p-10"><Spinner size="lg" /></div>;
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-700">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mt-4">
                <h1 className="text-2xl md:text-3xl font-bold bg-gradient-to-r from-yellow-400 to-red-500 bg-clip-text text-transparent">
                    Request History
                </h1>
                <div className="flex gap-2 w-full md:w-auto overflow-x-auto pb-2 md:pb-0">
                    <div className="flex bg-gray-100 p-1 rounded-lg">
                        <button
                            onClick={() => handleTabChange('investments')}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'investments' ? 'bg-white text-primary shadow-sm' : 'text-muted hover:text-foreground'}`}
                        >
                            Investments
                        </button>
                        <button
                            onClick={() => handleTabChange('swaps')}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'swaps' ? 'bg-white text-primary shadow-sm' : 'text-muted hover:text-foreground'}`}
                        >
                            Swaps
                        </button>
                        <button
                            onClick={() => handleTabChange('withdrawals')}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'withdrawals' ? 'bg-white text-primary shadow-sm' : 'text-muted hover:text-foreground'}`}
                        >
                            Profit Withdrawals
                        </button>
                    </div>
                    <button onClick={fetchData} className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-all shadow-sm">
                        Refresh
                    </button>
                </div>
            </div>

            {/* Swaps Tab Content */}
            {activeTab === 'swaps' && (
                <div className="bg-white border boundary-gray-200 rounded-xl overflow-hidden shadow-sm">
                    {isLoading ? <div className="p-8 flex justify-center"><Spinner /></div> : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
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
                                                <td colSpan={5} className="px-6 py-8 text-center text-muted">No swap requests found.</td>
                                            </tr>
                                        ) : (
                                            swaps.map((swap) => (
                                                <tr key={swap._id} className="hover:bg-gray-50 transition-colors">
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
                            {renderPagination()}
                        </>
                    )}
                </div>
            )}

            {/* Withdrawals Tab Content */}
            {activeTab === 'withdrawals' && (
                <div className="bg-white border boundary-gray-200 rounded-xl overflow-hidden shadow-sm">
                    {isLoading ? <div className="p-8 flex justify-center"><Spinner /></div> : (
                        <>
                            <div className="overflow-x-auto">
                                <table className="min-w-full divide-y divide-gray-200">
                                    <thead className="bg-gray-50">
                                        <tr>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Date</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Amount (Net)</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Status</th>
                                            <th className="px-6 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">Tx Hash</th>
                                        </tr>
                                    </thead>
                                    <tbody className="bg-white divide-y divide-gray-200">
                                        {withdrawals.length === 0 ? (
                                            <tr>
                                                <td colSpan={4} className="px-6 py-8 text-center text-muted">No withdrawal requests found.</td>
                                            </tr>
                                        ) : (
                                            withdrawals.map((tx) => (
                                                <tr key={tx._id} className="hover:bg-gray-50 transition-colors">
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm text-foreground">
                                                        {new Date(tx.createdAt).toLocaleDateString()}
                                                    </td>
                                                    <td className="px-6 py-4 whitespace-nowrap text-sm font-bold text-foreground">
                                                        {tx.amountSFTAllocated.toFixed(2)} SFT
                                                        <span className="text-xs text-muted font-normal ml-1">
                                                            (Gross: {tx.amountSFT})
                                                        </span>
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
                            {renderPagination()}
                        </>
                    )}
                </div>
            )}

            {activeTab === 'investments' && (
                <div className="bg-white backdrop-blur-xl border border-gray-200 rounded-2xl p-4 md:p-6 overflow-x-auto shadow-xl">
                    <h2 className="text-lg md:text-xl font-semibold mb-4 text-foreground">Sent Investment Requests</h2>
                    {isLoading ? <div className="p-8 flex justify-center"><Spinner /></div> : (
                        <>
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="text-muted border-b border-gray-100">
                                        <th className="p-3 whitespace-nowrap">Type</th>
                                        <th className="p-3 whitespace-nowrap">Plan</th>
                                        <th className="p-3 whitespace-nowrap">Investment</th>
                                        <th className="p-3 whitespace-nowrap">Expectation</th>
                                        <th className="p-3 whitespace-nowrap">ROI Received</th>
                                        <th className="p-3 whitespace-nowrap">Lock Duration</th>
                                        <th className="p-3 whitespace-nowrap">Status</th>
                                        <th className="p-3 whitespace-nowrap">TxHash</th>
                                        <th className="p-3 whitespace-nowrap">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {investments.map(inv => {
                                        const remainingDays = getRemainingDays(inv.maturityDate);
                                        const displayHash = inv.txHash || inv.sftTxHash;
                                        // Cast to any to access dynamic ROI props if not in interface yet
                                        const item = inv as any;

                                        return (
                                            <tr key={inv._id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors text-foreground">
                                                <td className="p-3 whitespace-nowrap">
                                                    <span className={`px-2 py-1 rounded text-xs font-bold ${inv.requestType === 'WITHDRAWAL' ? 'bg-secondary text-secondary-foreground border border-gray-200' : 'bg-primary/10 text-primary'}`}>
                                                        {inv.requestType === 'WITHDRAWAL' ? 'WITHDRAWAL' : 'INVESTMENT'}
                                                    </span>
                                                </td>
                                                <td className="p-3 text-foreground whitespace-nowrap">{inv.plan?.name || 'Unknown/Deleted Plan'}</td>
                                                <td className="p-3 font-mono text-foreground whitespace-nowrap">{inv.amountSFT} SFT</td>

                                                {/* Expectation / Principal Return Column */}
                                                <td className="p-3 font-mono text-foreground whitespace-nowrap">
                                                    {inv.requestType === 'WITHDRAWAL' ? (
                                                        <div className="flex flex-col">
                                                            <span>{inv.amountSFT} SFT</span>
                                                            <span className="text-[10px] text-muted">(Principal Return)</span>
                                                        </div>
                                                    ) : (
                                                        <span>{inv.sftAllocated} SFT</span>
                                                    )}
                                                </td>

                                                {/* ROI Received Column */}
                                                <td className="p-3 font-mono text-green-600 whitespace-nowrap">
                                                    {inv.requestType === 'WITHDRAWAL' ? (
                                                        <span className="text-muted text-xs">Paid via ROI</span>
                                                    ) : (
                                                        <div className="flex flex-col">
                                                            <span className="font-bold">{(item.accumulatedROI || 0).toFixed(2)} SFT</span>
                                                        </div>
                                                    )}
                                                </td>

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
                                                <td className="p-3 flex items-center gap-2 whitespace-nowrap">
                                                    {inv.status === 'APPROVED' && !inv.txHash && (
                                                        <button onClick={() => handleCancel(inv._id)} className="text-red-500 text-xs hover:underline">Cancel</button>
                                                    )}
                                                    {inv.status === 'APPROVED' && (
                                                        <button onClick={() => handlePayment(inv)} className="bg-primary text-white text-xs px-2 py-1 rounded">Pay</button>
                                                    )}
                                                    {(inv.status === 'PAID' || inv.status === 'COMPLETED') && remainingDays <= 0 && inv.requestType !== 'WITHDRAWAL' && (
                                                        <button onClick={() => handleWithdraw(inv._id)} className="bg-green-600 text-white text-xs px-2 py-1 rounded">Withdraw</button>
                                                    )}
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                            {investments.length === 0 && <p className="text-center text-muted py-8">No requests found.</p>}
                            {renderPagination()}
                        </>
                    )}
                </div>
            )}

            <Modal
                isOpen={modal.isOpen}
                onClose={closeModal}
                title={modal.title}
                footer={
                    modal.type === 'confirm' ? (
                        <>
                            <button onClick={closeModal} className="bg-gray-200 px-4 py-2 rounded">Cancel</button>
                            <button onClick={modal.onConfirm} className="bg-primary text-white px-4 py-2 rounded">Confirm</button>
                        </>
                    ) : (
                        <button onClick={closeModal} className="bg-gray-200 px-4 py-2 rounded">Close</button>
                    )
                }
            >
                <div>{modal.message}</div>
            </Modal>

            <EmailVerificationModal
                isOpen={isVerificationModalOpen}
                onClose={() => setIsVerificationModalOpen(false)}
            />
        </div >
    );
}
