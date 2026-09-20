'use client';

import React, { useEffect, useState, useRef } from 'react';
import { useUserStore } from '@/lib/store';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Spinner } from '@/components/Spinner';
import { TransactionHistory } from '@/components/TransactionHistory';
import { AdminTransactionHistory } from '@/components/AdminTransactionHistory';
import { NetworkSelectionModal } from '@/components/NetworkSelectionModal';
import { Modal } from '@/components/Modal';
import dynamic from 'next/dynamic';

// Admin Components
import { AdminStatsGrid } from '@/components/admin/AdminStatsGrid';
import { AdminCharts } from '@/components/admin/AdminCharts';

// Lazy load ReferralTree
const ReferralTree = dynamic(() => import('@/components/ReferralTree').then(m => m.ReferralTree), { ssr: false });

export default function Dashboard() {
    const { user, walletAddress, token, _hasHydrated } = useUserStore();
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);
    const [investments, setInvestments] = useState<any[]>([]);

    // Admin Stats State
    const [adminStats, setAdminStats] = useState<{
        stats: any;
        charts: any;
    } | null>(null);
    const [statsError, setStatsError] = useState<string | null>(null);

    useEffect(() => {
        if (!_hasHydrated) return;
        if (!token) {
            router.push('/login');
            return;
        }

        if (user?.role === 'admin') {
            fetchAdminStats();
        } else {
            fetchInvestments();
        }
    }, [token, router, _hasHydrated, user?.role]);

    const fetchAdminStats = async () => {
        setStatsError(null);
        try {
            const axios = await import('axios').then(m => m.default);
            const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
            console.log("Fetching admin stats from:", `${apiBase}/admin/stats`); // Debug log
            const { data } = await axios.get(`${apiBase}/admin/stats`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            console.log("Admin Stats Data:", data); // Debug log
            setAdminStats(data);
        } catch (error: any) {
            console.error("Failed to fetch admin stats", error);
            setStatsError(error.message || "Failed to load dashboard statistics");
            if (error.response) {
                console.error("Error response:", error.response.status, error.response.data);
                setStatsError(`Error ${error.response.status}: ${JSON.stringify(error.response.data)}`);
            }
        } finally {
            setIsLoading(false);
        }
    }

    const fetchInvestments = async () => {
        try {
            const axios = await import('axios').then(m => m.default);
            const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
            const { data } = await axios.get(`${apiBase}/investments/my`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setInvestments(data.investments || []);
        } catch (error: any) {
            if (error.response?.status === 403 && error.response?.data?.message?.includes('blocked')) {
                useUserStore.getState().logout();
                router.push('/login');
                return;
            }
            console.error("Failed to fetch investments", error);
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading || !_hasHydrated) {
        return <div className="flex min-h-[50vh] items-center justify-center"><Spinner size="lg" /></div>;
    }

    // Admin Dashboard View
    if (user?.role === 'admin') {
        return (
            <div className="space-y-8 pb-64 md:pb-24 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                            Admin Dashboard
                        </h1>
                        <div className="text-muted mt-1 flex items-center gap-2">
                            <span>Overview</span>
                        </div>
                    </div>
                </div>

                {statsError && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-4 rounded-xl">
                        <p className="font-bold">Failed to load statistics</p>
                        <p className="text-sm">{statsError}</p>
                        <button onClick={fetchAdminStats} className="mt-2 text-xs underline">Retry</button>
                    </div>
                )}

                {!adminStats && !statsError && (
                    <div className="flex justify-center p-8">
                        <Spinner /> <span className="ml-2 text-muted">Loading analytics...</span>
                    </div>
                )}

                {adminStats && (
                    <>
                        <AdminStatsGrid stats={adminStats.stats} />
                        <AdminCharts investmentData={adminStats.charts.investments} userData={adminStats.charts.users} />
                    </>
                )}

                {/* Transaction History for Admin */}
                <div className="mt-8">
                    <AdminTransactionHistory />
                </div>
            </div>
        );
    }

    // User Dashboard View
    return (
        <UserDashboardView
            user={user}
            investments={investments}
            router={router}
            token={token}
        />
    );
}

// User Dashboard Sub-Component to manage state cleaner
const UserDashboardView = ({ user, investments, router, token }: any) => {
    const [stats, setStats] = useState({
        totalIncome: 0,
        totalPending: 0,
        totalWithdrawn: 0
    });
    const [treeData, setTreeData] = useState<any>(null);
    const [treeLoading, setTreeLoading] = useState(true);
    const [referralEarnings, setReferralEarnings] = useState<number>(0);

    // Tree Zoom/Pan State
    const [transform, setTransform] = useState({ x: 0, y: 0, scale: 0.6 }); // Start zoomed out a bit
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
    const containerRef = useRef<HTMLDivElement>(null);

    // Modal state
    const [showNetworkModal, setShowNetworkModal] = useState(false);
    const [modalConfig, setModalConfig] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
    }>({
        isOpen: false,
        title: '',
        message: ''
    });

    const showModal = (title: string, message: string) => {
        setModalConfig({ isOpen: true, title, message });
    };

    const closeModal = () => {
        setModalConfig(prev => ({ ...prev, isOpen: false }));
    };

    const handleNetworkSelect = async (networkParams: any) => {
        setShowNetworkModal(false);
        try {
            console.log("Initiating wallet connection with:", networkParams.chainName);
            const { connectBNBWallet } = await import('@/lib/ethereum');
            const axios = await import('axios').then(m => m.default);

            console.log("Calling connectBNBWallet...");
            const address = await connectBNBWallet(networkParams);
            console.log("Wallet connected:", address);

            if (address) {
                useUserStore.getState().connectWallet(address);
                // Link to backend
                if (token) {
                    try {
                        const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
                        await axios.post(`${apiBase}/auth/link-wallet`, {
                            walletAddress: address
                        }, {
                            headers: { Authorization: `Bearer ${token}` }
                        });
                        showModal("Success", `Wallet linked successfully to ${networkParams.chainName}!`);
                    } catch (e: any) {
                        console.error("Link wallet API failed", e);
                        showModal("Error", `Failed to save wallet to backend: ${e.response?.data?.message || e.message}`);
                    }
                }
            }
        } catch (err: any) {
            console.error("Wallet connection critical error:", err);
            showModal("Error", `Failed to connect wallet: ${err.message || JSON.stringify(err)}`);
        }
    };

    const fetchReferralEarnings = async () => {
        try {
            const axios = await import('axios').then(m => m.default);
            const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
            const { data } = await axios.get(`${apiBase}/referrals/earnings`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setReferralEarnings(data.totalReferralEarnings || 0);
        } catch (error: any) {
            if (error.response?.status === 403 && error.response?.data?.message?.includes('blocked')) {
                useUserStore.getState().logout();
                router.push('/login');
                return;
            }
            console.error("Failed to fetch referral earnings", error);
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
            const adminRes = await axios.get(`${apiBase}/auth/admin-wallet`);
            const adminWallet = adminRes.data.walletAddress;

            if (!adminWallet || adminWallet.includes('PLACEHOLDER')) {
                showModal("Error", "Admin wallet not configured. Cannot proceed.");
                return;
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
            // fetchInvestments(); // This would need to be passed down or refactored
        } catch (error: any) {
            console.error("Payment failed", error);

            // Check for user rejection
            if (error.code === 'ACTION_REJECTED' || error.code === 4001 || error?.info?.error?.code === 4001) {
                showModal("Transaction Cancelled", "You rejected the transaction in MetaMask.");
            } else {
                showModal("Payment Failed", error.reason || error.message || "An unexpected error occurred.");
            }
        }
    };

    useEffect(() => {
        if (!token) return;

        const fetchStats = async () => {
            try {
                const axios = await import('axios').then(m => m.default);
                const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
                const { data } = await axios.get(`${apiBase}/earnings/summary`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setStats({
                    totalIncome: data.totalIncome || 0,
                    totalPending: data.totalPending || 0,
                    totalWithdrawn: data.totalWithdrawn || 0
                });
            } catch (error) {
                console.error("Failed to fetch earnings summary", error);
            }
        };

        const fetchTree = async () => {
            try {
                const axios = await import('axios').then(m => m.default);
                const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
                const { data } = await axios.get(`${apiBase}/referrals/tree`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setTreeData(data);
            } catch (error) {
                console.error("Failed to fetch tree", error);
            } finally {
                setTreeLoading(false);
            }
        };

        fetchStats();
        fetchTree();
    }, [token]);

    const totalInvestedSFT = investments
        .filter((inv: any) => ['PAID', 'COMPLETED'].includes(inv.status))
        .reduce((sum: number, inv: any) => sum + (inv.amountSFT || 0), 0);

    const copyReferralLink = () => {
        const link = `${window.location.origin}/signup?referral=${user?.referralCode}`;
        navigator.clipboard.writeText(link);
        showModal("Success", "Referral link copied!");
    };

    // Tree Interaction Handlers
    const handleWheel = (e: React.WheelEvent) => {
        e.preventDefault();
        const scaleAmount = -e.deltaY * 0.001;
        setTransform(prev => ({
            ...prev,
            scale: Math.min(2, Math.max(0.1, prev.scale + scaleAmount))
        }));
    };

    const handleMouseDown = (e: React.MouseEvent) => {
        setIsDragging(true);
        setDragStart({ x: e.clientX - transform.x, y: e.clientY - transform.y });
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (!isDragging) return;
        e.preventDefault();
        setTransform(prev => ({
            ...prev,
            x: e.clientX - dragStart.x,
            y: e.clientY - dragStart.y
        }));
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    // Auto-center tree on load (optional, but good UX)
    useEffect(() => {
        if (!treeLoading && containerRef.current) {
            const { clientWidth, clientHeight } = containerRef.current;
            setTransform(prev => ({
                ...prev,
                x: clientWidth / 2,
                y: 50 // Start near top
            }));
        }
    }, [treeLoading]);

    return (
        <div className="space-y-8 pb-64 md:pb-24 animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Header Section */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-4xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                        Dashboard
                    </h1>
                    <div className="text-muted mt-1 flex items-center gap-2">
                        <span>Welcome back,</span>
                        <span className="font-semibold text-foreground ml-2">
                            {user?.username || (user?.email ? user.email.split('@')[0] : 'User')}
                        </span>
                        <span className={`text-xs px-2 py-0.5 rounded-full font-bold ml-2 border ${user?.isActive
                            ? 'bg-green-100 text-green-700 border-green-200'
                            : 'bg-red-100 text-red-700 border-red-200'
                            }`}>
                            {user?.isActive ? 'Active Account' : 'Inactive Account'}
                        </span>
                    </div>
                </div>
                <div>
                    <Link href="/invest">
                        <button className="bg-gradient-to-r from-primary to-accent hover:from-primary/80 hover:to-accent/80 text-white font-bold py-3 px-6 rounded-xl shadow-lg shadow-primary/20 transition-all transform hover:scale-105">
                            + New Investment
                        </button>
                    </Link>
                </div>
            </div>

            {/* Stats Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <StatsCard title="Total SFT Locked" value={`${totalInvestedSFT.toFixed(2)} SFT`} icon="🔒" color="gold" />
                <StatsCard title="Total Withdrawal Pending" value={`${stats.totalPending.toFixed(2)} SFT`} icon="⏳" color="blue" />
                <StatsCard
                    title="Total Earnings"
                    value={`${stats.totalIncome.toFixed(2)} SFT`}
                    icon={<img src="/logo/sft_logo.png" alt="SFT" className="w-14 h-14 rounded-full shadow-sm" />}
                    color="green"
                    pattern="sft"
                />
            </div>

            {/* Content Area */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

                {/* Active Investments */}
                <div className="bg-white backdrop-blur-xl border border-gray-200 rounded-2xl p-6 shadow-xl">
                    <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                        <span className="p-2 bg-primary/10 rounded-lg text-primary">📈</span> Active Investments
                    </h2>
                    <div className="space-y-4 max-h-[400px] overflow-y-auto">
                        {investments.filter((inv: any) => ['PAID', 'COMPLETED'].includes(inv.status)).length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-32 text-gray-400 border-2 border-dashed border-white/10 rounded-xl">
                                <p>No active investments</p>
                                <Link href="/invest" className="text-primary hover:text-accent text-sm mt-2">Start Investing &rarr;</Link>
                            </div>
                        ) : (
                            investments.filter((inv: any) => ['PAID', 'COMPLETED'].includes(inv.status)).map((inv: any) => (
                                <div key={inv._id} className="bg-secondary p-4 rounded-xl border border-gray-200 hover:border-primary/20 transition-all">
                                    <div className="flex justify-between items-start">
                                        <div>
                                            <h3 className="font-bold text-lg text-foreground">{inv.plan?.name || 'Unknown Plan'}</h3>
                                            <p className="text-sm text-muted">{inv.amountSFT} SFT</p>
                                        </div>
                                        <div className="text-right">
                                            <span className={`text-xs font-bold px-2 py-1 rounded-full ${inv.status === 'PAID' ? 'bg-purple-500/20 text-purple-500' :
                                                'bg-primary/20 text-primary'
                                                }`}>
                                                {inv.status}
                                            </span>
                                        </div>
                                    </div>
                                    <div className="mt-2 text-xs text-gray-500 flex justify-between">
                                        <span>SFT: {inv.sftAllocated}</span>
                                        <span>{new Date(inv.createdAt).toLocaleDateString()}</span>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* Referral Tree Preview */}
                <div className="bg-white backdrop-blur-xl border border-gray-200 rounded-2xl p-6 shadow-xl flex flex-col">
                    <div
                        onClick={() => router.push('/referrals/team')}
                        className="cursor-pointer hover:opacity-80 transition-opacity"
                    >
                        <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                            <span className="p-2 bg-green-500/20 rounded-lg text-green-400">🌳</span> Referral Network
                            <span className="text-xs text-muted ml-auto font-normal flex items-center gap-1">Click to expand
                                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
                            </span>
                        </h2>
                    </div>

                    <div
                        className="bg-secondary rounded-xl h-64 overflow-hidden relative border border-gray-200 cursor-move"
                        ref={containerRef}
                        onWheel={handleWheel}
                        onMouseDown={handleMouseDown}
                        onMouseMove={handleMouseMove}
                        onMouseUp={handleMouseUp}
                        onMouseLeave={handleMouseUp}
                    >
                        {treeLoading ? (
                            <div className="absolute inset-0 flex items-center justify-center text-muted">Loading Tree...</div>
                        ) : (
                            <div
                                style={{
                                    transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
                                    transformOrigin: '0 0',
                                    transition: isDragging ? 'none' : 'transform 0.1s ease-out'
                                }}
                                className="absolute top-0 left-0 w-full"
                            >
                                <ReferralTree node={treeData} />
                            </div>
                        )}

                        <div className="absolute bottom-2 right-2 flex flex-col gap-1 bg-white/80 p-1 rounded-md text-xs text-muted backdrop-blur-sm pointer-events-none">
                            <span>Scroll to Zoom</span>
                            <span>Drag to Pan</span>
                        </div>
                    </div>

                    <div className="mt-4 flex justify-between items-center text-sm">
                        <span className="text-muted">Referral Code: <span className="text-foreground font-mono select-all font-bold">{user?.referralCode || 'N/A'}</span></span>
                        <button
                            onClick={copyReferralLink}
                            className="bg-primary/10 hover:bg-primary/20 text-primary font-semibold py-1.5 px-3 rounded-lg transition-colors flex items-center gap-1"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                            Copy Link
                        </button>
                    </div>
                </div>
            </div>

            {/* Transaction History - User only */}
            <div className="mt-8">
                <TransactionHistory />
            </div>

            <NetworkSelectionModal
                isOpen={showNetworkModal}
                onClose={() => setShowNetworkModal(false)}
                onSelectNetwork={handleNetworkSelect}
            />

            <Modal
                isOpen={modalConfig.isOpen}
                onClose={closeModal}
                title={modalConfig.title}
                footer={
                    <button
                        onClick={closeModal}
                        className="bg-gray-100 hover:bg-gray-200 text-gray-900 px-4 py-2 rounded-lg transition-colors text-sm font-medium"
                    >
                        Close
                    </button>
                }
            >
                <div>
                    <p className="text-gray-600">{modalConfig.message}</p>
                </div>
            </Modal>
        </div>
    );
}



const StatsCard = ({ title, value, icon, color, pattern }: { title: string, value: string, icon: React.ReactNode, color: string, pattern?: 'sft' }) => {
    // Helper to get color classes
    const colorClasses = {
        gold: {
            border: 'hover:border-primary/50',
            bg: 'bg-primary/10',
            hoverBg: 'group-hover:bg-primary/20',
            text: 'text-amber-600'
        },
        green: {
            border: 'hover:border-green-500/50',
            bg: 'bg-green-500/10',
            hoverBg: 'group-hover:bg-green-500/20',
            text: 'text-emerald-600'
        },
        purple: {
            border: 'hover:border-secondary/50',
            bg: 'bg-secondary/10',
            hoverBg: 'group-hover:bg-secondary/20',
            text: 'text-purple-600'
        },
        blue: {
            border: 'hover:border-blue-500/50',
            bg: 'bg-blue-500/10',
            hoverBg: 'group-hover:bg-blue-500/20',
            text: 'text-blue-600'
        }
    };

    const colors = colorClasses[color as keyof typeof colorClasses] || colorClasses.gold;

    return (
        <div className={`bg-white backdrop-blur-xl border border-gray-200 p-6 rounded-2xl relative overflow-hidden group ${colors.border} transition-colors shadow-sm`}>
            {/* Ambient Background Glow */}
            <div className={`absolute -right-4 -top-4 w-24 h-24 ${colors.bg} rounded-full blur-2xl ${colors.hoverBg} transition-all`}></div>

            {/* Pattern Background (SFT Icons) */}
            {pattern === 'sft' && (
                <div className="absolute inset-0 z-0 overflow-hidden opacity-[0.09] pointer-events-none">
                    {/* Corners & Edges */}
                    <img src="/logo/sft_logo.png" alt="" className="absolute -right-8 -bottom-8 w-32 h-32 rotate-[-15deg]" />
                    <img src="/logo/sft_logo.png" alt="" className="absolute -top-6 -left-6 w-24 h-24 rotate-[-12deg]" />
                    <img src="/logo/sft_logo.png" alt="" className="absolute top-1/2 -right-4 w-16 h-16 rotate-[15deg]" />
                    <img src="/logo/sft_logo.png" alt="" className="absolute -bottom-4 left-1/4 w-14 h-14 rotate-[5deg]" />

                    {/* Scattered Field */}
                    <img src="/logo/sft_logo.png" alt="" className="absolute top-2 right-12 w-16 h-16 rotate-[25deg]" />
                    <img src="/logo/sft_logo.png" alt="" className="absolute bottom-12 left-8 w-14 h-14 rotate-[45deg]" />
                    <img src="/logo/sft_logo.png" alt="" className="absolute top-1/2 left-1/3 w-10 h-10 rotate-[180deg]" />
                    <img src="/logo/sft_logo.png" alt="" className="absolute bottom-4 right-1/3 w-12 h-12 rotate-[-30deg]" />
                    <img src="/logo/sft_logo.png" alt="" className="absolute top-4 left-1/2 w-8 h-8 rotate-[15deg]" />

                    {/* Extra Fillers */}
                    <img src="/logo/sft_logo.png" alt="" className="absolute top-10 left-20 w-8 h-8 rotate-[60deg]" />
                    <img src="/logo/sft_logo.png" alt="" className="absolute bottom-20 right-10 w-9 h-9 rotate-[-10deg]" />
                    <img src="/logo/sft_logo.png" alt="" className="absolute top-1/3 left-2/3 w-11 h-11 rotate-[90deg]" />
                    <img src="/logo/sft_logo.png" alt="" className="absolute top-2 right-1/2 w-6 h-6 rotate-[20deg]" />
                    <img src="/logo/sft_logo.png" alt="" className="absolute bottom-1/3 left-4 w-7 h-7 rotate-[-45deg]" />
                </div>
            )}

            <div className="relative z-10">
                <div className="flex justify-between items-start mb-4">
                    <p className="text-gray-500 text-sm font-semibold tracking-wide uppercase">{title}</p>
                    <span className="text-2xl">{icon}</span>
                </div>
                <h3 className={`text-3xl font-extrabold ${colors.text} tracking-tight`}>
                    {value}
                </h3>
            </div>
        </div>
    )
}
