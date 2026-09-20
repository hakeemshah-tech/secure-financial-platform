'use client';

import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useUserStore } from '@/lib/store';
import { useRouter } from 'next/navigation';
import { Spinner } from '@/components/Spinner';
import { Modal } from '@/components/Modal';
import { ChevronLeft, ChevronRight, Search } from 'lucide-react';

// ... (Existing Imports)

interface Investment {
    _id: string;
    user: {
        _id: string;
        username: string;
        name: string;
        email: string;
        walletAddress: string;
    };
    plan: {
        name: string;
        lockInPeriodDays?: number;
    };
    walletAddress: string;
    amountSFT: number;
    sftAllocated: number;
    status: string;
    txHash?: string;
    sftTxHash?: string;
    maturityDate: string;
    createdAt: string;
    requestType?: 'INVESTMENT' | 'WITHDRAWAL';
}

interface SwapRequest {
    _id: string;
    user: {
        username: string;
        email: string;
        walletAddress: string;
    };
    walletAddress: string;
    amount: number;
    fromToken: 'SFT' | 'USDT';
    toToken: 'USDT' | 'SFT';
    status: string;
    userTxHash?: string;
    adminTxHash?: string;
    createdAt: string;
}

interface ProfitWithdrawal {
    _id: string;
    user: {
        username: string;
        email: string;
        walletAddress: string;
    };
    amountSFT: number;
    amountSFTAllocated: number;
    fee: number;
    status: string;
    txHash?: string;
    createdAt: string;
}

interface EmailChangeRequest {
    _id: string;
    user: {
        _id: string;
        username: string;
        email: string;
        walletAddress: string;
        isEmailVerified?: boolean;
    };
    oldEmail: string;
    newEmail: string;
    status: string;
    createdAt: string;
}

export default function AdminPage() {
    const { token, user, _hasHydrated, activeNetwork } = useUserStore();
    const router = useRouter();
    const [investments, setInvestments] = useState<Investment[]>([]);
    const [swaps, setSwaps] = useState<SwapRequest[]>([]);
    const [profitWithdrawals, setProfitWithdrawals] = useState<ProfitWithdrawal[]>([]);
    const [emailRequests, setEmailRequests] = useState<EmailChangeRequest[]>([]); // [NEW]
    const [isLoading, setIsLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<'investments' | 'swaps' | 'withdrawals' | 'email-requests'>('investments');
    const [page, setPage] = useState(1);
    const [totalPages, setTotalPages] = useState(1);
    const [searchQuery, setSearchQuery] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');

    // Modal State
    const [modal, setModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        type: 'info' | 'confirm' | 'input' | 'withdraw_choice';
        inputType?: 'text';
        onConfirm?: (inputValue?: string) => void;
        onAuto?: () => void;
        onManual?: () => void;
        loading?: boolean;
    }>({
        isOpen: false,
        title: '',
        message: '',
        type: 'info'
    });

    const [adminTxHashDisplay, setAdminTxHashDisplay] = useState('');

    useEffect(() => {
        if (!_hasHydrated) return;

        if (!token || user?.role !== 'admin') {
            router.push('/login');
            return;
        }

        fetchData();
    }, [token, user, _hasHydrated, router, activeTab, page, debouncedSearch]);

    // Debounce Search Effect
    useEffect(() => {
        const handler = setTimeout(() => {
            setDebouncedSearch(searchQuery);
            setPage(1); // Reset to page 1 on new search
        }, 500);

        return () => {
            clearTimeout(handler);
        };
    }, [searchQuery]);

    const fetchData = async () => {
        try {
            setIsLoading(true);
            const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

            if (activeTab === 'investments') {
                const res = await axios.get(`${apiBase}/investments/admin?page=${page}&limit=10&search=${debouncedSearch}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setInvestments(res.data.investments);
                setTotalPages(res.data.pagination.pages);
            } else if (activeTab === 'swaps') {
                const res = await axios.get(`${apiBase}/swaps/admin?page=${page}&limit=10&search=${debouncedSearch}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setSwaps(res.data.requests);
                setTotalPages(res.data.pagination.pages);
            } else if (activeTab === 'withdrawals') {
                const res = await axios.get(`${apiBase}/earnings/admin/withdrawals?page=${page}&limit=10&search=${debouncedSearch}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setProfitWithdrawals(res.data.withdrawals);
                setTotalPages(res.data.pagination.pages);
            } else if (activeTab === 'email-requests') {
                const res = await axios.get(`${apiBase}/email-change/admin?page=${page}&limit=10&search=${debouncedSearch}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setEmailRequests(res.data.requests);
                setTotalPages(res.data.pagination.pages);
            }

        } catch (error: any) {
            console.error("Failed to fetch admin data", error);
        } finally {
            setIsLoading(false);
        }
    };

    const handleTabChange = (tab: 'investments' | 'swaps' | 'withdrawals' | 'email-requests') => {
        setActiveTab(tab);
        setPage(1);
    };

    const renderPagination = () => {
        if (totalPages <= 1) return null;

        const renderPageNumbers = () => {
            const pages = [];
            const maxVisible = 5;

            if (totalPages <= maxVisible) {
                for (let i = 1; i <= totalPages; i++) {
                    pages.push(i);
                }
            } else {
                if (page <= 3) {
                    for (let i = 1; i <= 4; i++) pages.push(i);
                    pages.push('...');
                    pages.push(totalPages);
                } else if (page >= totalPages - 2) {
                    pages.push(1);
                    pages.push('...');
                    for (let i = totalPages - 3; i <= totalPages; i++) pages.push(i);
                } else {
                    pages.push(1);
                    pages.push('...');
                    for (let i = page - 1; i <= page + 1; i++) pages.push(i);
                    pages.push('...');
                    pages.push(totalPages);
                }
            }

            return pages.map((p, index) => (
                <button
                    key={index}
                    onClick={() => typeof p === 'number' && setPage(p)}
                    disabled={p === '...'}
                    className={`h-8 w-8 flex items-center justify-center rounded-lg text-sm transition-all ${p === page
                        ? 'bg-primary text-white font-bold shadow-md'
                        : p === '...'
                            ? 'text-gray-400 cursor-default'
                            : 'text-gray-600 hover:bg-gray-100'
                        }`}
                >
                    {p}
                </button>
            ));
        };

        return (
            <div className="flex items-center justify-between mt-6 pt-4 border-t border-gray-100">
                <div className="text-sm text-muted">
                    Page <span className="font-medium text-foreground">{page}</span> of{' '}
                    <span className="font-medium text-foreground">{totalPages}</span>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setPage(p => Math.max(1, p - 1))}
                        disabled={page === 1}
                        className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        <ChevronLeft className="w-4 h-4" />
                    </button>
                    <div className="flex items-center gap-1">{renderPageNumbers()}</div>
                    <button
                        onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                        disabled={page === totalPages}
                        className="p-2 rounded-lg text-gray-500 hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                        <ChevronRight className="w-4 h-4" />
                    </button>
                </div>
            </div>
        );
    };

    const showModal = (title: string, message: string, type: 'info' | 'confirm' | 'input' = 'info', onConfirm?: (val?: string) => void) => {
        setModal({ isOpen: true, title, message, type, onConfirm, loading: false });
        if (type === 'input') setAdminTxHashDisplay('');
    };

    const updateModalLoading = (title: string, message: string) => {
        setModal(prev => ({ ...prev, title, message, loading: true }));
    };

    const closeModal = () => {
        setModal(prev => ({ ...prev, isOpen: false }));
    };

    // --- Investment Actions ---
    const executeInvestmentAction = async (id: string, action: string) => {
        closeModal();
        try {
            const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
            await axios.put(`${apiBase}/investments/${id}/${action}`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            showModal("Success", `Action ${action} completed.`);
            fetchData();
        } catch (error: any) {
            showModal("Error", "Failed: " + (error.response?.data?.message || error.message));
        }
    };

    const handleInvestmentAction = (id: string, action: string) => {
        const actionLabel = action === 'withdraw-approve' ? 'approve this withdrawal' : `${action} this investment`;
        showModal(
            `Confirm Action`,
            `Are you sure you want to ${actionLabel}?`,
            "confirm",
            () => executeInvestmentAction(id, action)
        );
    };

    // --- Swap Actions ---
    const handleSwapAction = async (swap: SwapRequest, action: 'approve' | 'reject' | 'complete') => {
        if (action === 'complete') {
            // Updated Flow: Trigger Web3 Transfer
            showModal(
                `Send ${swap.toToken}`,
                `You are about to send ${swap.amount} ${swap.toToken} to ${swap.walletAddress}. Connect your Admin Wallet to proceed.`,
                "confirm",
                () => executeSwapTransfer(swap)
            );
        } else {
            showModal(
                `Confirm ${action}`,
                `Are you sure you want to ${action} this swap?`,
                "confirm",
                () => executeSwapAction(swap._id, action)
            );
        }
    };

    const executeSwapTransfer = async (swap: SwapRequest) => {
        // Keeps modal open but updates content
        updateModalLoading("Processing Transfer", "Connecting to wallet...");

        try {
            const { connectBNBWallet, ACTIVE_CONFIG, PLATFORM_TOKEN_ADDRESS } = await import('@/lib/ethereum');
            const { ethers } = await import('ethers');

            // Use dynamic network from store or fallback
            const targetConfig = activeNetwork || ACTIVE_CONFIG;
            const walletAddress = await connectBNBWallet(targetConfig);
            const provider = new ethers.BrowserProvider((window as any).ethereum);
            const signer = await provider.getSigner();

            // Balance Check for BNB (Gas)
            const balanceBNB = await provider.getBalance(walletAddress);
            if (balanceBNB === BigInt(0)) {
                throw new Error("You have 0 BNB. Please add some BNB for gas fees.");
            }

            let txHash = '';

            if (swap.toToken === 'USDT') {
                const USDT_ADDRESS = (activeNetwork as any)?.tokens?.USDT || (ACTIVE_CONFIG as any).tokens?.USDT || "0x55d398326f99059fF775485246999027B3197955";
                const USDT_ABI = [
                    "function transfer(address to, uint256 amount) returns (bool)",
                    "function decimals() view returns (uint8)",
                    "function balanceOf(address account) view returns (uint256)"
                ];
                const contract = new ethers.Contract(USDT_ADDRESS, USDT_ABI, signer);
                const decimals = await contract.decimals();
                const amountWei = ethers.parseUnits(swap.amount.toString(), decimals);

                // Balance Check for USDT
                const usdtBalance = await contract.balanceOf(walletAddress);
                if (usdtBalance < amountWei) {
                    throw new Error(`Insufficient USDT balance. You have ${ethers.formatUnits(usdtBalance, decimals)} USDT, but need ${swap.amount}.`);
                }

                updateModalLoading("Confirm Transaction", `Please confirm transfer of ${swap.amount} USDT in MetaMask.`);

                // Gas Estimation with specific error catch
                try {
                    await contract.transfer.estimateGas(swap.walletAddress, amountWei);
                } catch (gasError: any) {
                    console.error("Gas estimation failed", gasError);
                    throw new Error("Gas estimation failed. This usually happens if the contract address is wrong for this network, or your wallet has insufficient funds/permissions.");
                }

                const tx = await contract.transfer(swap.walletAddress, amountWei);
                updateModalLoading("Sending...", "Transaction submitted. Waiting for confirmation...");
                await tx.wait();
                txHash = tx.hash;

            } else { // SFT
                const SFT_ADDRESS = (activeNetwork as any)?.tokens?.SFT || (ACTIVE_CONFIG as any).tokens?.SFT || PLATFORM_TOKEN_ADDRESS;
                const SFT_ABI = [
                    "function transfer(address to, uint256 amount) returns (bool)",
                    "function decimals() view returns (uint8)",
                    "function balanceOf(address account) view returns (uint256)"
                ];
                const contract = new ethers.Contract(SFT_ADDRESS, SFT_ABI, signer);
                const decimals = await contract.decimals();
                const amountWei = ethers.parseUnits(swap.amount.toString(), decimals);

                // Balance Check for SFT
                const sftBalance = await contract.balanceOf(walletAddress);
                if (sftBalance < amountWei) {
                    throw new Error(`Insufficient SFT balance. You have ${ethers.formatUnits(sftBalance, decimals)} SFT, but need ${swap.amount}.`);
                }

                updateModalLoading("Confirm Transaction", `Please confirm transfer of ${swap.amount} SFT in MetaMask.`);

                // Gas Estimation with specific error catch
                try {
                    await contract.transfer.estimateGas(swap.walletAddress, amountWei);
                } catch (gasError: any) {
                    console.error("Gas estimation failed", gasError);
                    throw new Error("Gas estimation failed for SFT. Please ensure you are on the correct network and have enough BNB for gas.");
                }

                const tx = await contract.transfer(swap.walletAddress, amountWei);
                updateModalLoading("Sending...", "Transaction submitted. Waiting for confirmation...");
                await tx.wait();
                txHash = tx.hash;
            }

            // After success, call backend to complete
            executeSwapAction(swap._id, 'complete', txHash);

        } catch (error: any) {
            console.error("Transfer failed", error);
            if (error.code === 'ACTION_REJECTED' || error.code === 4001) {
                showModal("Cancelled", "Transaction rejected in wallet.");
            } else {
                showModal("Error", "Transfer failed: " + (error.reason || error.message || "Unknown error"));
            }
        }
    };

    const executeSwapAction = async (id: string, action: string, adminTxHash?: string) => {
        closeModal();
        try {
            const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
            const payload = adminTxHash ? { adminTxHash } : {};
            await axios.put(`${apiBase}/swaps/${id}/${action}`, payload, {
                headers: { Authorization: `Bearer ${token}` }
            });
            showModal("Success", `Swap ${action} successful!`);
            fetchData();
        } catch (error: any) {
            console.error("Swap action failed", error);
            showModal("Error", "Failed: " + (error.response?.data?.message || error.message));
        }
    };

    // --- Withdrawal Execution ---
    const executeWithdrawTransfer = async (inv: Investment) => {
        showModal(
            "Confirm Withdrawal",
            `You are about to send ${inv.sftAllocated} SFT to ${inv.user?.walletAddress}. Do you want to proceed?`,
            "confirm",
            () => {
                setModal({
                    isOpen: true,
                    title: "Process Withdrawal",
                    message: `How would you like to proceed with sending ${inv.sftAllocated} SFT to ${inv.user?.walletAddress}?`,
                    type: 'withdraw_choice',
                    onAuto: () => startAutoWithdrawTransfer(inv),
                    onManual: () => showModal("Manual Transfer", "Enter the transaction hash for the transfer you already performed:", "input", (hash) => handleManualWithdrawComplete(inv._id, hash))
                });
            }
        );
    };

    const handleManualWithdrawComplete = async (id: string, txHash?: string) => {
        if (!txHash) {
            showModal("Error", "Transaction hash is required for manual completion.");
            return;
        }
        closeModal();
        try {
            const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
            await axios.put(`${apiBase}/investments/${id}/withdraw-complete`, { txHash }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            showModal("Success", "Withdrawal marked as completed!");
            fetchData();
        } catch (error: any) {
            showModal("Error", "Failed: " + (error.response?.data?.message || error.message));
        }
    };

    // --- Profit Withdrawal Actions ---
    const executeProfitAction = async (withdrawal: ProfitWithdrawal, action: 'approve' | 'reject') => {
        closeModal();
        try {
            const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
            await axios.put(`${apiBase}/earnings/withdrawals/${withdrawal._id}/${action}`, {}, {
                headers: { Authorization: `Bearer ${token}` }
            });
            showModal("Success", `Withdrawal ${action} successful!`);
            fetchData();
        } catch (error: any) {
            showModal("Error", "Failed: " + (error.response?.data?.message || error.message));
        }
    };

    const handleProfitAction = async (withdrawal: ProfitWithdrawal, action: 'approve' | 'reject' | 'complete') => {
        if (action === 'complete') {
            showModal(
                "Confirm Fund Transfer",
                `You are about to send ${withdrawal.amountSFTAllocated} SFT to ${withdrawal.user.walletAddress}.`,
                "confirm",
                () => executeProfitTransfer(withdrawal)
            );
        } else {
            showModal(
                `Confirm ${action}`,
                `Are you sure you want to ${action} this profit withdrawal request?`,
                "confirm",
                () => executeProfitAction(withdrawal, action)
            );
        }
    };

    const executeProfitTransfer = async (withdrawal: ProfitWithdrawal) => {
        setModal({
            isOpen: true,
            title: "Process Profit Withdrawal",
            message: `How proceed with sending ${withdrawal.amountSFTAllocated} SFT?`,
            type: 'withdraw_choice',
            onAuto: () => startAutoProfitTransfer(withdrawal),
            onManual: () => showModal("Manual Transfer", "Enter Tx Hash:", "input", (hash) => handleManualProfitComplete(withdrawal._id, hash))
        });
    };

    const handleManualProfitComplete = async (id: string, txHash?: string) => {
        if (!txHash) return showModal("Error", "Tx Hash required");
        closeModal();
        try {
            const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
            await axios.put(`${apiBase}/earnings/withdrawals/${id}/complete`, { txHash }, {
                headers: { Authorization: `Bearer ${token}` }
            });
            showModal("Success", "Withdrawal completed!");
            fetchData();
        } catch (error: any) {
            showModal("Error", "Failed: " + (error.response?.data?.message || error.message));
        }
    };

    const startAutoProfitTransfer = async (withdrawal: ProfitWithdrawal) => {
        updateModalLoading("Processing Transfer", "Initializing...");
        try {
            const { connectBNBWallet, ACTIVE_CONFIG, PLATFORM_TOKEN_ADDRESS } = await import('@/lib/ethereum');
            const { ethers } = await import('ethers');
            const targetConfig = activeNetwork || ACTIVE_CONFIG;
            const adminWallet = await connectBNBWallet(targetConfig);
            const provider = new ethers.BrowserProvider((window as any).ethereum);
            const signer = await provider.getSigner();

            const SFT_ADDRESS = (targetConfig as any).tokens?.SFT || PLATFORM_TOKEN_ADDRESS;
            const SFT_ABI = [
                "function transfer(address to, uint256 amount) returns (bool)",
                "function decimals() view returns (uint8)",
                "function balanceOf(address account) view returns (uint256)"
            ];

            const contract = new ethers.Contract(SFT_ADDRESS, SFT_ABI, signer);
            const decimals = await contract.decimals();
            const amountWei = ethers.parseUnits(withdrawal.amountSFTAllocated.toString(), decimals);

            const tx = await contract.transfer(withdrawal.user.walletAddress, amountWei);
            updateModalLoading("Sending...", "Tx Submitted. Waiting confirmation...");
            await tx.wait();

            const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
            await axios.put(`${apiBase}/earnings/withdrawals/${withdrawal._id}/complete`, { txHash: tx.hash }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            showModal("Success", "Profit Withdrawal Completed!");
            fetchData();
        } catch (error: any) {
            console.error("Transfer failed", error);
            showModal("Error", error.reason || error.message);
        }
    };

    const startAutoWithdrawTransfer = async (inv: Investment) => {
        updateModalLoading("Processing Transfer", "Initializing transction...");
        try {
            const { connectBNBWallet, ACTIVE_CONFIG, PLATFORM_TOKEN_ADDRESS } = await import('@/lib/ethereum');
            const { ethers } = await import('ethers');

            const targetConfig = activeNetwork || ACTIVE_CONFIG;
            const adminWallet = await connectBNBWallet(targetConfig);
            const provider = new ethers.BrowserProvider((window as any).ethereum);
            const signer = await provider.getSigner();

            // Gas Check
            const balanceBNB = await provider.getBalance(adminWallet);
            if (balanceBNB === BigInt(0)) throw new Error("0 BNB for gas.");

            const SFT_ADDRESS = (targetConfig as any).tokens?.SFT || PLATFORM_TOKEN_ADDRESS;
            const SFT_ABI = [
                "function transfer(address to, uint256 amount) returns (bool)",
                "function decimals() view returns (uint8)",
                "function balanceOf(address account) view returns (uint256)"
            ];

            const contract = new ethers.Contract(SFT_ADDRESS, SFT_ABI, signer);
            const decimals = await contract.decimals();
            const amountWei = ethers.parseUnits(inv.sftAllocated.toString(), decimals);

            // Admin Balance Check
            const adminBalance = await contract.balanceOf(adminWallet);
            if (adminBalance < amountWei) {
                throw new Error(`Insufficient SFT Balance. You have ${ethers.formatUnits(adminBalance, decimals)}, but need ${inv.sftAllocated}`);
            }

            updateModalLoading("Confirm Transaction", `Please confirm transfer of ${inv.sftAllocated} SFT in MetaMask.`);

            const tx = await contract.transfer(inv.user.walletAddress, amountWei);
            updateModalLoading("Sending...", "Transaction submitted. Waiting for confirmation...");
            await tx.wait();

            // Call Backend
            const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
            await axios.put(`${apiBase}/investments/${inv._id}/withdraw-complete`, { txHash: tx.hash }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            showModal("Success", "SFT withdrawal completed successfully!");
            fetchData();
        } catch (error: any) {
            console.error("Withdrawal failed", error);
            showModal("Transfer Failed", error.reason || error.message || "Unknown error");
        }
    };



    if (isLoading || !_hasHydrated) return <div className="flex justify-center p-10"><Spinner size="lg" /></div>;

    return (
        <div className="space-y-6 animate-in fade-in duration-700">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mt-4">
                <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                    Admin Dashboard
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
                        <button
                            onClick={() => handleTabChange('email-requests')}
                            className={`px-4 py-2 rounded-md text-sm font-medium transition-all ${activeTab === 'email-requests' ? 'bg-white text-primary shadow-sm' : 'text-muted hover:text-foreground'}`}
                        >
                            Email Change
                        </button>
                    </div>
                    <button onClick={fetchData} className="bg-primary text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary/90 transition-all shadow-sm">
                        Refresh
                    </button>
                </div>

            </div>

            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mt-6">
                {/* Search Bar */}
                <div className="relative max-w-md w-full">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <Search className="h-5 w-5 text-gray-400" />
                    </div>
                    <input
                        type="text"
                        placeholder="Search by username, email, phone, or wallet..."
                        className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-1 focus:ring-primary focus:border-primary sm:text-sm transition duration-150 ease-in-out shadow-sm"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>

            {activeTab === 'investments' && (
                <div className="bg-white backdrop-blur-xl border border-gray-200 rounded-2xl p-6 overflow-x-auto shadow-xl">
                    <h2 className="text-xl font-semibold mb-6 text-foreground">Incoming Requests</h2>
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="text-gray-500 text-sm font-medium border-b border-gray-100">
                                <th className="p-4 whitespace-nowrap">User</th>
                                <th className="p-4 whitespace-nowrap">Type</th>
                                <th className="p-4 whitespace-nowrap">Plan</th>
                                <th className="p-4 whitespace-nowrap">Investment</th>
                                <th className="p-4 whitespace-nowrap">Expectation</th>
                                <th className="p-4 whitespace-nowrap">ROI Paid</th>
                                <th className="p-4 whitespace-nowrap">Lock Duration</th>
                                <th className="p-4 whitespace-nowrap">Status</th>
                                <th className="p-4 whitespace-nowrap">TxHash</th>
                                <th className="p-4 whitespace-nowrap">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm">
                            {investments.map(inv => {
                                const getRemainingDays = (date: string) => {
                                    const now = new Date();
                                    const maturity = new Date(date);
                                    const diffTime = maturity.getTime() - now.getTime();
                                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                    return diffDays > 0 ? diffDays : 0;
                                };

                                const remainingDays = getRemainingDays(inv.maturityDate);
                                // Cast to any to access dynamic props
                                const item = inv as any;
                                const durationDisplay = `${remainingDays} Days Left`;

                                return (
                                    <tr key={inv._id} className="border-b-2 border-gray-200 hover:bg-gray-100 transition-colors duration-200">
                                        <td className="p-4 font-medium text-gray-900">
                                            <div className="flex flex-col">
                                                <span>{inv.user?.username || 'User'}</span>
                                                <span className="text-xs text-gray-400">{inv.user?.walletAddress?.slice(0, 6)}...{inv.user?.walletAddress?.slice(-4)}</span>
                                            </div>
                                        </td>
                                        <td className="p-4 text-gray-600">
                                            {inv.requestType || 'Investment'}
                                        </td>
                                        <td className="p-4 text-gray-600 font-medium">{inv.plan?.name}</td>
                                        <td className="p-4 text-gray-600">{inv.amountSFT}</td>

                                        {/* Expectation / Principal Return Column */}
                                        <td className="p-4 text-gray-600">
                                            {inv.requestType === 'WITHDRAWAL' ? (
                                                <div className="flex flex-col">
                                                    <span>{inv.amountSFT}</span>
                                                    <span className="text-[10px] text-gray-400">(Principal Return)</span>
                                                </div>
                                            ) : (
                                                <span>{inv.sftAllocated || '-'}</span>
                                            )}
                                        </td>

                                        {/* ROI Paid Column */}
                                        <td className="p-4 text-green-600 font-medium">
                                            {inv.requestType === 'WITHDRAWAL' ? (
                                                <span className="text-gray-400 text-xs">Paid via ROI</span>
                                            ) : (
                                                <span>{(item.accumulatedROI || 0).toFixed(2)} SFT</span>
                                            )}
                                        </td>

                                        <td className="p-4 text-gray-600">{durationDisplay}</td>
                                        <td className="p-4">
                                            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${inv.status === 'PENDING' ? 'bg-yellow-50 text-yellow-600' :
                                                inv.status === 'APPROVED' ? 'bg-green-50 text-green-600' :
                                                    inv.status === 'REJECTED' ? 'bg-red-50 text-red-600' :
                                                        'bg-gray-100 text-gray-600'
                                                }`}>
                                                {inv.status}
                                            </span>
                                        </td>
                                        <td className="p-4">
                                            {inv.txHash || inv.sftTxHash ? (
                                                <a
                                                    href={`https://bscscan.com/tx/${inv.txHash || inv.sftTxHash}`}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="text-primary hover:text-primary/80 transition-colors font-mono text-xs"
                                                >
                                                    View ↗
                                                </a>
                                            ) : <span className="text-gray-400">-</span>}
                                        </td>
                                        <td className="p-4">
                                            <div className="flex items-center gap-2">
                                                {inv.status === 'PENDING' && (
                                                    <>
                                                        <button
                                                            onClick={() => handleInvestmentAction(inv._id, 'approve')}
                                                            className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-xs font-medium hover:bg-green-600 transition-colors shadow-sm"
                                                        >
                                                            Approve
                                                        </button>
                                                        <button
                                                            onClick={() => handleInvestmentAction(inv._id, 'reject')}
                                                            className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-medium hover:bg-red-100 transition-colors"
                                                        >
                                                            Reject
                                                        </button>
                                                    </>
                                                )}
                                                {inv.status === 'WITHDRAW_REQUESTED' && (
                                                    <button
                                                        onClick={() => handleInvestmentAction(inv._id, 'withdraw-approve')}
                                                        className="px-4 py-1.5 bg-gradient-to-r from-violet-600 to-indigo-600 text-white rounded-full text-xs font-bold shadow-lg hover:shadow-xl hover:scale-105 active:scale-95 transition-all flex items-center gap-1.5 border border-white/20"
                                                    >
                                                        <span>Approve Withdrawal</span>
                                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" className="w-3 h-3">
                                                            <path fillRule="evenodd" d="M16.704 4.153a.75.75 0 01.143 1.052l-8 10.5a.75.75 0 01-1.127.075l-4.5-4.5a.75.75 0 011.06-1.06l3.894 3.893 7.48-9.817a.75.75 0 011.05-.143z" clipRule="evenodd" />
                                                        </svg>
                                                    </button>
                                                )}
                                                {inv.status === 'WITHDRAW_APPROVED' && (
                                                    <button onClick={() => executeWithdrawTransfer(inv)} className="bg-gradient-to-r from-orange-500 to-red-500 text-white px-3 py-1 rounded text-sm">Send SFT 🦊</button>
                                                )}
                                            </div>
                                        </td>
                                    </tr>
                                )
                            })}
                        </tbody>
                    </table>

                    {investments.length === 0 && (
                        <div className="text-center py-12 text-gray-500 text-sm">
                            No purchase requests found.
                        </div>
                    )}
                    {renderPagination()}
                </div>
            )}

            {activeTab === 'swaps' && (
                <div className="bg-white backdrop-blur-xl border border-gray-200 rounded-2xl p-6 overflow-x-auto shadow-xl">
                    <h2 className="text-xl font-semibold mb-6 text-foreground">Incoming Swap Requests</h2>
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="text-gray-500 text-sm font-medium border-b border-gray-100">
                                <th className="p-4 whitespace-nowrap">User</th>
                                <th className="p-4 whitespace-nowrap">Swap</th>
                                <th className="p-4 whitespace-nowrap">Amount</th>
                                <th className="p-4 whitespace-nowrap">Status</th>
                                <th className="p-4 whitespace-nowrap">User Hash</th>
                                <th className="p-4 whitespace-nowrap">Admin Hash</th>
                                <th className="p-4 whitespace-nowrap">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm">
                            {swaps.map(swap => (
                                <tr key={swap._id} className="border-b-2 border-gray-200 hover:bg-gray-100 transition-colors duration-200">
                                    <td className="p-3">
                                        <div>{swap.user?.username}</div>
                                        <div className="text-xs text-gray-400">{swap.walletAddress}</div>
                                    </td>
                                    <td className="p-3 font-bold">{swap.fromToken} ➔ {swap.toToken}</td>
                                    <td className="p-3">{swap.amount}</td>
                                    <td className="p-3">
                                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${swap.status === 'PENDING' ? 'bg-yellow-100 text-yellow-600' :
                                            swap.status === 'APPROVED' ? 'bg-blue-100 text-blue-600' :
                                                swap.status === 'COMPLETED' ? 'bg-green-100 text-green-600' :
                                                    'bg-red-100 text-red-600'
                                            }`}>{swap.status}</span>
                                    </td>
                                    <td className="p-3">
                                        {swap.userTxHash ? (
                                            <a href={`https://bscscan.com/tx/${swap.userTxHash}`} target="_blank" className="text-primary underline text-xs">Verify</a>
                                        ) : 'None'}
                                    </td>
                                    <td className="p-3">
                                        {swap.adminTxHash ? (
                                            <a href={`https://bscscan.com/tx/${swap.adminTxHash}`} target="_blank" className="text-primary underline text-xs">View</a>
                                        ) : '-'}
                                    </td>
                                    <td className="p-3 flex gap-2">
                                        {swap.status === 'PENDING' && (
                                            <>
                                                <button onClick={() => handleSwapAction(swap, 'approve')} className="bg-green-100 text-green-700 px-2 py-1 rounded text-xs hover:bg-green-200">Approve</button>
                                                <button onClick={() => handleSwapAction(swap, 'reject')} className="bg-red-100 text-red-700 px-2 py-1 rounded text-xs hover:bg-red-200">Reject</button>
                                            </>
                                        )}
                                        {swap.status === 'APPROVED' && (
                                            <button
                                                onClick={() => handleSwapAction(swap, 'complete')}
                                                className="bg-purple-600 text-white px-3 py-1.5 rounded text-xs shadow-md hover:bg-purple-700 flex items-center gap-1"
                                            >
                                                <span>Send {swap.toToken}</span>
                                                <span>🦊</span>
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {renderPagination()}
                </div>
            )}

            {activeTab === 'withdrawals' && (
                <div className="bg-white backdrop-blur-xl border border-gray-200 rounded-2xl p-6 overflow-x-auto shadow-xl">
                    <h2 className="text-xl font-semibold mb-6 text-foreground">Profit Withdrawal Requests</h2>
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="text-gray-500 text-sm font-medium border-b border-gray-100">
                                <th className="p-4 whitespace-nowrap">User</th>
                                <th className="p-4 whitespace-nowrap">Amount (Gross)</th>
                                <th className="p-4 whitespace-nowrap">Fee</th>
                                <th className="p-4 whitespace-nowrap">Net Payable</th>
                                <th className="p-4 whitespace-nowrap">Status</th>
                                <th className="p-4 whitespace-nowrap">TxHash</th>
                                <th className="p-4 whitespace-nowrap">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm">
                            {profitWithdrawals.map(wd => (
                                <tr key={wd._id} className="border-b-2 border-gray-200 hover:bg-gray-100 transition-colors duration-200">
                                    <td className="p-4">
                                        <div className="font-bold">{wd.user?.username}</div>
                                        <div className="text-xs text-gray-400">{wd.user?.walletAddress}</div>
                                    </td>
                                    <td className="p-4 font-mono">{wd.amountSFT} SFT</td>
                                    <td className="p-4 font-mono text-red-500">-{wd.fee?.toFixed(4)} SFT</td>
                                    <td className="p-4 font-mono font-bold text-green-600">{wd.amountSFTAllocated} SFT</td>
                                    <td className="p-4">
                                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${wd.status === 'PENDING' ? 'bg-yellow-50 text-yellow-600' :
                                            wd.status === 'APPROVED' ? 'bg-blue-50 text-blue-600' :
                                                wd.status === 'COMPLETED' ? 'bg-green-50 text-green-600' :
                                                    'bg-red-50 text-red-600'
                                            }`}>
                                            {wd.status}
                                        </span>
                                    </td>
                                    <td className="p-4">
                                        {wd.txHash ? (
                                            <a href={`https://bscscan.com/tx/${wd.txHash}`} target="_blank" className="text-primary underline text-xs">View</a>
                                        ) : '-'}
                                    </td>
                                    <td className="p-4 flex gap-2">
                                        {wd.status === 'PENDING' && (
                                            <>
                                                <button onClick={() => handleProfitAction(wd, 'approve')} className="bg-blue-100 text-blue-700 px-3 py-1 rounded text-xs hover:bg-blue-200">Approve</button>
                                                <button onClick={() => handleProfitAction(wd, 'reject')} className="bg-red-100 text-red-700 px-3 py-1 rounded text-xs hover:bg-red-200">Reject</button>
                                            </>
                                        )}
                                        {wd.status === 'APPROVED' && (
                                            <button onClick={() => handleProfitAction(wd, 'complete')} className="bg-gradient-to-r from-green-500 to-emerald-600 text-white px-3 py-1 rounded text-xs shadow hover:shadow-lg">Pay 🦊</button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {profitWithdrawals.filter(w => w.status === 'PENDING' || w.status === 'APPROVED').length === 0 && (
                        <div className="text-center py-12 text-gray-500 text-sm">No pending/approved profit withdrawals.</div>
                    )}
                    {renderPagination()}
                </div>
            )}

            {activeTab === 'email-requests' && (
                <div className="bg-white backdrop-blur-xl border border-gray-200 rounded-2xl p-6 overflow-x-auto shadow-xl">
                    <h2 className="text-xl font-semibold mb-6 text-foreground">Email Change Requests</h2>
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="text-gray-500 text-sm font-medium border-b border-gray-100">
                                <th className="p-4 whitespace-nowrap">User</th>
                                <th className="p-4 whitespace-nowrap">Current Email</th>
                                <th className="p-4 whitespace-nowrap">Requested Email</th>
                                <th className="p-4 whitespace-nowrap">Status</th>
                                <th className="p-4 whitespace-nowrap">Date</th>
                                <th className="p-4 whitespace-nowrap">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="text-sm">
                            {emailRequests.map(req => (
                                <tr key={req._id} className="border-b-2 border-gray-200 hover:bg-gray-100 transition-colors duration-200">
                                    <td className="p-4 font-medium text-gray-900">
                                        <div className="flex flex-col">
                                            <span>{req.user?.username || 'User'}</span>
                                            <span className="text-xs text-gray-400">{req.user?.walletAddress?.slice(0, 6)}...</span>
                                        </div>
                                    </td>
                                    <td className="p-4 text-gray-600">{req.oldEmail}</td>
                                    <td className="p-4 text-primary font-medium">{req.newEmail}</td>
                                    <td className="p-4">
                                        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${req.status === 'PENDING' ? 'bg-yellow-50 text-yellow-600' :
                                            req.status === 'APPROVED' ? 'bg-green-50 text-green-600' :
                                                'bg-red-50 text-red-600'
                                            }`}>
                                            {req.status}
                                        </span>
                                    </td>
                                    <td className="p-4 text-gray-600">{new Date(req.createdAt).toLocaleDateString()}</td>
                                    <td className="p-4">
                                        {req.status === 'PENDING' && (
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => {
                                                        showModal(
                                                            "Confirm Approval",
                                                            `Approve email change to ${req.newEmail}? This will ONLY update the status. You must send the verification email separately.`,
                                                            "confirm",
                                                            async () => {
                                                                closeModal();
                                                                try {
                                                                    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
                                                                    await axios.put(`${apiBase}/email-change/${req._id}/approve`, {}, {
                                                                        headers: { Authorization: `Bearer ${token}` }
                                                                    });
                                                                    showModal("Success", "Request approved. Please click 'Send Verification' to proceed.");
                                                                    fetchData();
                                                                } catch (error: any) {
                                                                    showModal("Error", error.response?.data?.message || error.message);
                                                                }
                                                            }
                                                        );
                                                    }}
                                                    className="px-3 py-1.5 bg-green-500 text-white rounded-lg text-xs font-medium hover:bg-green-600 transition-colors shadow-sm"
                                                >
                                                    Approve
                                                </button>
                                                <button
                                                    onClick={() => {
                                                        showModal(
                                                            "Confirm Rejection",
                                                            "Reject this email change request?",
                                                            "confirm",
                                                            async () => {
                                                                closeModal();
                                                                try {
                                                                    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
                                                                    await axios.put(`${apiBase}/email-change/${req._id}/reject`, {}, {
                                                                        headers: { Authorization: `Bearer ${token}` }
                                                                    });
                                                                    showModal("Success", "Request rejected.");
                                                                    fetchData();
                                                                } catch (error: any) {
                                                                    showModal("Error", error.response?.data?.message || error.message);
                                                                }
                                                            }
                                                        );
                                                    }}
                                                    className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg text-xs font-medium hover:bg-red-100 transition-colors"
                                                >
                                                    Reject
                                                </button>
                                            </div>
                                        )}
                                        {req.status === 'APPROVED' && (
                                            <button
                                                onClick={() => {
                                                    showModal(
                                                        "Send Verification",
                                                        `Send verification email to ${req.newEmail} ?`,
                                                        "confirm",
                                                        async () => {
                                                            closeModal();
                                                            try {
                                                                const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
                                                                await axios.put(`${apiBase}/email-change/${req._id}/resend-verification`, {}, {
                                                                    headers: { Authorization: `Bearer ${token}` }
                                                                });
                                                                showModal("Success", "Verification email sent successfully.");
                                                            } catch (error: any) {
                                                                showModal("Error", error.response?.data?.message || error.message);
                                                            }
                                                        }
                                                    );
                                                }}
                                                className="px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-medium hover:bg-blue-100 transition-colors border border-blue-200"
                                            >
                                                Send Verification
                                            </button>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {emailRequests.length === 0 && (
                        <div className="text-center py-12 text-gray-500 text-sm">
                            No email change requests found.
                        </div>
                    )}
                    {renderPagination()}
                </div>
            )}


            {/* Reused Modal for both pages */}
            <Modal isOpen={modal.isOpen} onClose={closeModal} title={modal.title}>
                <div className="space-y-4">
                    <p>{modal.message}</p>
                    {modal.loading && (
                        <div className="flex justify-center py-4">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                        </div>
                    )}
                    {modal.type === 'input' && !modal.loading && (
                        <input
                            type="text"
                            className="w-full border-2 border-gray-300 p-4 rounded-xl focus:border-primary focus:ring-4 focus:ring-primary/10 outline-none transition-all font-mono text-sm bg-gray-50 placeholder-gray-400"
                            placeholder="0x..."
                            value={adminTxHashDisplay}
                            onChange={(e) => setAdminTxHashDisplay(e.target.value)}
                        />
                    )}
                    <div className="space-y-3 mt-6">
                        {!modal.loading && modal.type === 'withdraw_choice' && (
                            <>
                                <button
                                    onClick={modal.onAuto}
                                    className="w-full flex items-center justify-between p-4 bg-primary text-white rounded-xl hover:bg-primary/90 transition-all shadow-md group border border-primary/20"
                                >
                                    <div className="flex flex-col items-start">
                                        <span className="font-bold">Continue Transfer SFT</span>
                                        <span className="text-xs text-white/80">Automated Web3 MetaMask flow</span>
                                    </div>
                                    <span className="text-2xl group-hover:scale-110 transition-transform">🦊</span>
                                </button>

                                <button
                                    onClick={modal.onManual}
                                    className="w-full flex items-center justify-between p-4 bg-white border-2 border-primary/20 text-gray-900 rounded-xl hover:bg-gray-50 transition-all group"
                                >
                                    <div className="flex flex-col items-start">
                                        <span className="font-bold text-primary">Already Transferred?</span>
                                        <span className="text-xs text-gray-500 text-left">Manually enter a Transaction Hash</span>
                                    </div>
                                    <span className="text-xl group-hover:translate-x-1 transition-all">➔</span>
                                </button>

                                <button
                                    onClick={closeModal}
                                    className="w-full p-3 text-gray-500 hover:text-gray-800 transition-colors text-sm font-medium"
                                >
                                    Cancel & Go Back
                                </button>
                            </>
                        )}

                        {!modal.loading && modal.type !== 'info' && modal.type !== 'withdraw_choice' && (
                            <div className="flex justify-end gap-2">
                                <button onClick={closeModal} className="px-4 py-2 bg-gray-100 text-gray-600 rounded-lg hover:bg-gray-200 transition-colors font-medium">Cancel</button>
                                <button
                                    onClick={() => modal.onConfirm && modal.onConfirm(modal.type === 'input' ? adminTxHashDisplay : undefined)}
                                    className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-all font-bold shadow-sm"
                                >
                                    Confirm
                                </button>
                            </div>
                        )}

                        {!modal.loading && modal.type === 'info' && (
                            <div className="flex justify-end">
                                <button onClick={closeModal} className="px-6 py-2 bg-gray-900 text-white rounded-lg hover:bg-black transition-all font-medium">Close</button>
                            </div>
                        )}
                    </div>
                </div>
            </Modal>
        </div >
    );
}
