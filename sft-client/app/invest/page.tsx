'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useUserStore } from '@/lib/store';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Spinner } from '@/components/Spinner';
import { Modal } from '@/components/Modal';
import { Check, Copy } from 'lucide-react';
import { BNB_MAINNET_PARAMS } from '@/lib/ethereum';
import { NetworkSelectionModal } from '@/components/NetworkSelectionModal';

interface Plan {
    _id: string;
    name: string;
    description?: string;
    lockInPeriodDays: number;
    sftPrice: number;
    minInvestmentSFT: number;
    roiPercent: number;
    walletAddress: string;
}

export default function InvestPage() {
    const [plans, setPlans] = useState<Plan[]>([]);
    const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
    const [amount, setAmount] = useState<number>(0);
    const { isConnected, token, _hasHydrated, walletAddress, user, connectWallet, setUser, disconnectWallet } = useUserStore();
    const router = useRouter();
    const [isLoading, setIsLoading] = useState(true);

    // New Modal State Logic
    const [flowStep, setFlowStep] = useState<'NONE' | 'QUESTION' | 'MANUAL_INPUT' | 'WALLET_LINK_OPTIONS' | 'MANUAL_WALLET_LINK'>('NONE');
    const [manualTxHash, setManualTxHash] = useState('');
    const [manualWalletAddress, setManualWalletAddress] = useState('');
    const [copiedId, setCopiedId] = useState<string | null>(null);

    // Network Selection for Linking
    const [showNetworkModal, setShowNetworkModal] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);

    // Manual Link Input
    const [manualLinkInput, setManualLinkInput] = useState('');

    const handleCopy = (address: string, id: string) => {
        navigator.clipboard.writeText(address);
        setCopiedId(id);
        setTimeout(() => setCopiedId(null), 2000);
    };

    // General Message Modal
    const [modalConfig, setModalConfig] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
        shouldRedirect?: boolean;
    }>({
        isOpen: false,
        title: '',
        message: '',
        shouldRedirect: false
    });

    const showModal = (title: string, message: string, shouldRedirect: boolean = false) => {
        setModalConfig({ isOpen: true, title, message, shouldRedirect });
    };

    const closeModal = () => {
        setModalConfig(prev => ({ ...prev, isOpen: false }));
        if (modalConfig.shouldRedirect) {
            router.push('/requests');
        }
    };

    // 1. Auth Check & Redirect
    useEffect(() => {
        if (_hasHydrated && !token) {
            router.push('/login');
        }
    }, [_hasHydrated, token, router]);

    // 2. Fetch Plans (Runs once on mount/token change)
    useEffect(() => {
        if (!token) return;

        const fetchPlans = async () => {
            try {
                const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
                const { data } = await axios.get(`${apiBase}/plans`);
                setPlans(data);

                // Only set default if we have plans and nothing selected yet
                // Note: Since this runs on mount, selectedPlan is likely null.
                if (data.length > 0) {
                    // We use a functional update or just direct set, but to be safe against race conditions,
                    // we can check if the user has already selected something (unlikely on mount)
                    // But to be 100% safe, we can just set it. 
                    // Since this effect ONLY runs on [token], it won't run when User object changes.
                    setSelectedPlan(prev => prev || data[0]);
                    setAmount(prev => prev || data[0].minInvestmentSFT);
                }
            } catch (err) {
                console.error("Failed to fetch plans", err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchPlans();
    }, [token]);

    // 3. User Wallet Sync (Runs when user/walletAddress updates)
    useEffect(() => {
        if (walletAddress) {
            setManualWalletAddress(walletAddress);
        } else if (user?.walletAddress) {
            setManualWalletAddress(user.walletAddress);
        }
    }, [walletAddress, user]);

    if (isLoading || !_hasHydrated) {
        return <div className="flex min-h-[50vh] items-center justify-center"><Spinner size="lg" /></div>;
    }

    const calculateReturn = () => {
        if (!selectedPlan) return 0;
        return amount + (amount * selectedPlan.roiPercent / 100);
    };

    const handleInvestClick = () => {
        // Robust check for wallet linkage
        const dbWallet = user?.walletAddress;

        // Helper to check if address is valid string
        const isValidAddress = (addr: any) => {
            if (!addr || typeof addr !== 'string') return false;
            const clean = addr.trim();
            if (clean.length <= 5) return false;
            if (clean === 'null' || clean === 'undefined') return false;
            // Treat placeholder PENDING_ addresses as unlinked
            if (clean.startsWith('PENDING_')) return false;
            return true;
        };

        // We ONLY check dbWallet (and ignoring ephemeral connectedWallet) to satisfy strict linking requirement
        const isLinked = isValidAddress(dbWallet);

        console.log("Invest Click Debug (Strict + PENDING):", { dbWallet, isLinked, user });

        if (!isLinked) {
            setFlowStep('WALLET_LINK_OPTIONS');
            return;
        }

        startInvestmentFlow();
    };


    const startInvestmentFlow = () => {
        setFlowStep('QUESTION');
        setManualTxHash('');
        // Ensure manual address is populated cleanly when starting fresh
        if (walletAddress) setManualWalletAddress(walletAddress);
        else if (user?.walletAddress) setManualWalletAddress(user.walletAddress);
        else setManualWalletAddress('');
    };

    const handleNetworkSelect = async (networkParams: any) => {
        setShowNetworkModal(false);
        setIsConnecting(true);
        try {
            const connectBNBWallet = await import('@/lib/ethereum').then(m => m.connectBNBWallet);
            const address = await connectBNBWallet(networkParams);

            if (address) {
                // 1. Update local store (Connection)
                connectWallet(address);

                // 2. Link in backend (Persistence)
                if (token) {
                    const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
                    try {
                        await axios.post(`${apiBase}/auth/link-wallet`, {
                            walletAddress: address
                        }, {
                            headers: { Authorization: `Bearer ${token}` }
                        });

                        // 3. Update user object in store (Profile)
                        if (user) {
                            const updatedUser = { ...user, walletAddress: address };
                            setUser(updatedUser);
                        }

                        setFlowStep('NONE');

                        // 4. Force state update propagation before continuing
                        setTimeout(() => {
                            startInvestmentFlow();
                        }, 500);

                    } catch (e: any) {
                        console.error("Link wallet failed", e);
                        disconnectWallet();
                        showModal(
                            "Wallet Connection Failed",
                            e.response?.data?.message || "Failed to link wallet. It may be already used by another account."
                        );
                        return;
                    }
                }
            }
        } catch (error: any) {
            console.error("Connection error:", error);
            showModal("Connection Error", error.message || "Failed to connect wallet");
            disconnectWallet();
        } finally {
            setIsConnecting(false);
        }
    };

    const handleManualLinkSubmit = async () => {
        if (!manualLinkInput || manualLinkInput.trim().length < 10) {
            alert("Please enter a valid wallet address");
            return;
        }

        setIsConnecting(true);
        try {
            const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
            await axios.post(`${apiBase}/auth/link-wallet`, {
                walletAddress: manualLinkInput.trim()
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            // Update store - mimic connection for consistency, although it's just a manual set
            connectWallet(manualLinkInput.trim());

            // Crucially update the USER object which is used for the persistence check
            if (user) {
                const updatedUser = { ...user, walletAddress: manualLinkInput.trim() };
                setUser(updatedUser);
            }

            setFlowStep('NONE');
            setTimeout(() => startInvestmentFlow(), 500);

        } catch (error: any) {
            console.error("Link failed:", error);
            showModal(
                "Link Failed",
                error.response?.data?.message || "Failed to link wallet address. Please try again."
            );
        } finally {
            setIsConnecting(false);
        }
    };

    const handleInitialChoice = (alreadyPaid: boolean) => {
        if (alreadyPaid) {
            setFlowStep('MANUAL_INPUT');
        } else {
            // Not paid -> Proceed to Direct Payment
            if (!isConnected) {
                // Let's prompt them: If they manually entered, they might not have MM. 

                setFlowStep('NONE');
                showModal("Wallet Required", "Please connect a blockchain wallet (e.g. MetaMask) to perform direct payment, or transfer manually and select 'Already Transferred'.");
                return;
            }
            if (!walletAddress) {
                setFlowStep('NONE');
                showModal("Error", "Wallet address not found. Please reconnect.");
                return;
            }
            handleDirectPayment();
        }
    };

    const handleDirectPayment = async () => {
        if (!selectedPlan || !walletAddress) return;
        setFlowStep('NONE');
        setIsLoading(true);

        try {
            // Dynamically import ethers and ethereum utils
            const { connectBNBWallet, PLATFORM_TOKEN_ADDRESS } = await import('@/lib/ethereum');
            const { ethers } = await import('ethers');

            // 1. Setup Provider & Signer
            // We use the browser provider (MetaMask)
            const provider = new ethers.BrowserProvider((window as any).ethereum);
            const signer = await provider.getSigner();

            // 2. Define SFT Contract
            const SFT_ADDRESS = PLATFORM_TOKEN_ADDRESS;
            const SFT_ABI = [
                "function transfer(address to, uint256 amount) returns (bool)",
                "function decimals() view returns (uint8)",
                "function symbol() view returns (string)",
                "function balanceOf(address account) view returns (uint256)"
            ];

            const sftContract = new ethers.Contract(SFT_ADDRESS, SFT_ABI, signer);

            // 3. Get Decimals
            const decimals = await sftContract.decimals();
            const symbol = await sftContract.symbol();

            // 4. Prepare Amount
            // amount state is the user input in SFT
            const amountWei = ethers.parseUnits(amount.toString(), decimals);

            // 5. Check Balance
            const balance = await sftContract.balanceOf(walletAddress);
            if (balance < amountWei) {
                const formattedBalance = ethers.formatUnits(balance, decimals);
                setIsLoading(false);
                showModal("Insufficient Balance", `You have ${formattedBalance} ${symbol}, but need ${amount} ${symbol}.`);
                return;
            }

            // 6. Execute Transfer
            // Destination: Selected Plan's Wallet Address
            const destination = selectedPlan.walletAddress;
            if (!destination) {
                setIsLoading(false);
                showModal("Configuration Error", "This plan does not have a destination wallet address configured.");
                return;
            }

            console.log(`initiating transfer of ${amount} ${symbol} to ${destination}`);

            const tx = await sftContract.transfer(destination, amountWei);
            console.log("Transaction sent:", tx.hash);

            // 7. Wait for confirmation (optional, but good for UX before showing success)
            await tx.wait();
            console.log("Transaction confirmed");

            // 8. Submit Investment with Hash
            await submitInvestment(true, tx.hash, true); // Added flag for direct payment success message

        } catch (error: any) {
            console.error("Payment Error:", error);
            setIsLoading(false);
            if (error.code === 'ACTION_REJECTED' || error.code === 4001) {
                // User rejected
            } else {
                showModal("Payment Failed", error.reason || error.message || "Transaction failed");
            }
        }
    };

    const handleManualSubmit = () => {
        if (!manualTxHash) {
            alert("Please enter transaction hash");
            return;
        }
        submitInvestment(true, manualTxHash);
    };

    const submitInvestment = async (isManual: boolean, hash?: string, isDirectPayment: boolean = false) => {
        setFlowStep('NONE');
        setIsLoading(true);

        const plan = selectedPlan;
        const investAmount = amount;
        if (!plan) return;

        try {
            const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
            const apiUrl = `${apiBase}/investments`;

            const payload: any = {
                planId: plan._id,
                amount: investAmount,
                walletAddress: walletAddress // Can be null, backend will handle lookup
            };

            if (isManual && hash) {
                payload.txHash = hash;
            }

            console.log("🚀 Sending Investment Payload:", payload); // Debug log

            const response = await axios.post(apiUrl, payload, {
                headers: { Authorization: `Bearer ${token}` }
            });

            console.log('✅ Purchase request created successfully:', response.data);

            if (isManual) {
                if (hash && (arguments[2] === true)) {
                    // Direct Payment Success Case
                    showModal("Success", "SFT transfered successfull you will get the aproval with in 24 hr", true);
                } else {
                    // Manual Hash Entry Case
                    showModal("Success", "Request Sent for Approval (Hash Verified)", true);
                }
            } else {
                showModal("Success", "Request Sent for Approval", true);
            }

        } catch (err: any) {
            console.error("❌ Purchase request failed:", err);
            let msg = err.response?.data?.message || err.message;
            if (msg.includes("Cannot edit this plan")) { // Generic fallback if message varies
                msg = "Plan unavailable or locked.";
            }
            showModal("Error", `Purchase request failed: ${msg}`);
        } finally {
            setIsLoading(false);
        }
    };

    if (plans.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] animate-in fade-in duration-700">
                <div className="text-center space-y-4 p-8 bg-white backdrop-blur-xl border border-gray-200 rounded-2xl max-w-md mx-4 shadow-xl">
                    <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-4">
                        <span className="text-2xl">📉</span>
                    </div>
                    <h2 className="text-2xl font-bold text-foreground">No Investment Plans Available</h2>
                    <p className="text-muted">
                        There are currently no active investment plans. Please check back later or contact support.
                    </p>
                    <Link
                        href="/dashboard"
                        className="inline-block bg-secondary hover:bg-secondary/80 text-foreground px-6 py-2 rounded-lg transition-all"
                    >
                        Return to Dashboard
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="space-y-6 md:space-y-8 pb-24 animate-in fade-in slide-in-from-bottom-4 duration-700">
            <h1 className="text-4xl font-bold text-center bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                Choose Your Investment Plan
            </h1>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 md:gap-8 ">
                {/* Left: Input & Calculator */}
                <div className="lg:col-span-1 space-y-6">
                    <div className="bg-white backdrop-blur-xl border border-gray-200 rounded-2xl p-4 md:p-6 shadow-xl">
                        <h2 className="text-xl font-semibold mb-4 text-foreground">Investment Calculator</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm text-muted mb-1">Select Plan</label>
                                <select
                                    className="w-full bg-secondary border border-gray-200 rounded-lg p-3 focus:outline-none focus:border-primary text-foreground"
                                    onChange={(e) => {
                                        const plan = plans.find(p => p._id === e.target.value) || null;
                                        setSelectedPlan(plan);
                                        if (plan) setAmount(plan.minInvestmentSFT);
                                    }}
                                    value={selectedPlan?._id}
                                >
                                    {plans.map(p => <option key={p._id} value={p._id}>{p.name}</option>)}
                                </select>
                            </div>
                            <div>
                                <label className="block text-sm text-muted mb-1">Investment SFT</label>
                                <input
                                    type="number"
                                    className="w-full bg-secondary border border-gray-200 rounded-lg p-3 focus:outline-none text-right opacity-60 cursor-not-allowed text-foreground"
                                    value={amount}
                                    readOnly
                                />
                            </div>

                            <div className="pt-4 border-t border-gray-100 space-y-2">
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted">Lock-in Period</span>
                                    <span className="font-mono text-foreground">{selectedPlan?.lockInPeriodDays} Days</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                    <span className="text-muted">Receiving SFT</span>
                                    <span className="font-mono text-foreground">{amount} SFT</span>
                                </div>

                                <div className="flex justify-between text-lg font-bold pt-2 text-primary">
                                    <span>Total Return (SFT)</span>
                                    <span>{calculateReturn()} SFT</span>
                                </div>
                            </div>

                            <button
                                onClick={handleInvestClick}
                                className="w-full bg-primary hover:bg-accent text-white font-bold py-3 px-6 rounded-xl shadow-lg transition-all mt-4"
                            >
                                Invest Now
                            </button>
                        </div>
                    </div>
                </div>

                {/* Right: Plans List */}
                <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-2 gap-6">
                    {plans.map(plan => (
                        <div
                            key={plan._id}
                            onClick={() => {
                                setSelectedPlan(plan);
                                setAmount(plan.minInvestmentSFT);
                            }}
                            className={`cursor-pointer bg-white backdrop-blur-xl border rounded-2xl p-6 transition-all hover:scale-105 ${selectedPlan?._id === plan._id ? 'border-primary shadow-primary/20 shadow-lg' : 'border-gray-200 hover:border-primary/50'}`}
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <h3 className="text-2xl font-bold text-foreground">{plan.name}</h3>
                                    {plan.description && <p className="text-sm text-muted">{plan.description}</p>}
                                </div>
                                <span className="bg-primary/20 text-primary text-xs px-2 py-1 rounded-full">{plan.roiPercent}% ROI</span>
                            </div>
                            <div className="space-y-2 text-sm text-muted">
                                <p>Investment SFT: <span className="text-foreground font-mono">{plan.minInvestmentSFT} SFT</span></p>
                                <p>Lock Duration: <span className="text-foreground font-mono">{plan.lockInPeriodDays} Days</span></p>
                                <p>Receiving SFT: <span className="text-foreground font-mono">{plan.minInvestmentSFT + (plan.minInvestmentSFT * plan.roiPercent / 100)}</span></p>
                                <div className="flex items-center gap-2">
                                    <p className="flex-1">Wallet Address: <span className="text-foreground font-mono text-xs break-all">{plan.walletAddress}</span></p>
                                    <button
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleCopy(plan.walletAddress, plan._id);
                                        }}
                                        className="p-1 hover:bg-secondary rounded-md transition-colors text-muted hover:text-foreground"
                                        title="Copy Address"
                                    >
                                        {copiedId === plan._id ? <Check size={14} className="text-primary" /> : <Copy size={14} />}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Wallet Link Options Modal */}
            <Modal
                isOpen={flowStep === 'WALLET_LINK_OPTIONS'}
                onClose={() => setFlowStep('NONE')}
                title="Link Your Wallet"
                footer={null}
            >
                <div className="space-y-6 text-center">
                    <p className="text-muted">You need to link a wallet address before you can invest.</p>
                    <div className="flex flex-col gap-3">
                        <button
                            onClick={() => {
                                setFlowStep('NONE');
                                setShowNetworkModal(true);
                            }}
                            className="bg-primary hover:bg-accent text-white font-semibold py-3 px-4 rounded-xl transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
                        >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                                <path d="M12.0002 8.74996L9.61352 11.1366L12.0002 13.5233L14.3869 11.1366L12.0002 8.74996ZM16.3735 6.66663L18.7602 9.05329L21.1469 6.66663L18.7602 4.27996L16.3735 6.66663ZM7.62685 6.66663L5.24019 4.27996L2.85352 6.66663L5.24019 9.05329L7.62685 6.66663ZM12.0002 18.3133L9.61352 15.9266L12.0002 13.54L14.3869 15.9266L12.0002 18.3133ZM16.3735 13.54L18.7602 11.1533L21.1469 13.54L18.7602 15.9266L16.3735 13.54ZM7.62685 13.54L5.24019 15.9266L2.85352 13.54L5.24019 11.1533L7.62685 13.54ZM12.0002 4.02663L9.61352 6.41329L12.0002 8.79996L14.3869 6.41329L12.0002 4.02663ZM16.3735 20.3933L18.7602 18.0066L16.3735 15.62L13.9869 18.0066L16.3735 20.3933ZM7.62685 20.3933L10.0135 18.0066L7.62685 15.62L5.24019 18.0066L7.62685 20.3933Z" fill="currentColor" />
                            </svg>
                            Link via MetaMask
                        </button>
                        <button
                            onClick={() => setFlowStep('MANUAL_WALLET_LINK')}
                            className="bg-secondary hover:bg-secondary/80 text-foreground font-medium py-3 px-4 rounded-xl transition-all"
                        >
                            Add Wallet Address Manually
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Manual Wallet Link Input Modal */}
            <Modal
                isOpen={flowStep === 'MANUAL_WALLET_LINK'}
                onClose={() => setFlowStep('WALLET_LINK_OPTIONS')}
                title="Link Wallet Manually"
                footer={
                    <div className="flex justify-end gap-2 w-full">
                        <button
                            onClick={() => setFlowStep('WALLET_LINK_OPTIONS')}
                            className="bg-secondary hover:bg-secondary/80 text-foreground px-4 py-2 rounded-lg transition-colors text-sm"
                        >
                            Back
                        </button>
                        <button
                            onClick={handleManualLinkSubmit}
                            disabled={isConnecting}
                            className="bg-primary hover:bg-accent text-white px-4 py-2 rounded-lg transition-colors text-sm font-semibold"
                        >
                            {isConnecting ? 'Linking...' : 'Link Address'}
                        </button>
                    </div>
                }
            >
                <div className="space-y-4">
                    <p className="text-sm text-muted">Please enter your wallet address. This will be used to track your investments.</p>
                    <div>
                        <label className="block text-sm text-foreground mb-1">Wallet Address</label>
                        <input
                            type="text"
                            className="w-full bg-secondary border border-gray-200 rounded-lg p-3 focus:outline-none focus:border-primary text-sm font-mono text-foreground"
                            placeholder="0x..."
                            value={manualLinkInput}
                            onChange={(e) => setManualLinkInput(e.target.value)}
                        />
                    </div>
                </div>
            </Modal>


            {/* Step 1: Question Modal (Remaining Existing Flows) */}
            <Modal
                isOpen={flowStep === 'QUESTION'}
                onClose={() => setFlowStep('NONE')}
                title="Investment SFT"
                footer={null}
            >
                <div className="space-y-6 text-center">
                    <p className="text-lg text-muted">Have you already transfered the SFT?</p>
                    <div className="flex flex-col gap-3">
                        <button
                            onClick={() => handleInitialChoice(true)}
                            className="bg-primary hover:bg-accent text-white font-semibold py-3 px-4 rounded-xl transition-all shadow-lg shadow-primary/20"
                        >
                            Yes, Already Transferred
                        </button>
                        <button
                            onClick={() => handleInitialChoice(false)}
                            className="bg-secondary hover:bg-secondary/80 text-foreground font-medium py-3 px-4 rounded-xl transition-all"
                        >
                            No, Continue to Pay (Transfer SFT)
                        </button>
                    </div>
                </div>
            </Modal>

            {/* Step 2: Manual Input Modal (For Proof of Payment) */}
            <Modal
                isOpen={flowStep === 'MANUAL_INPUT'}
                onClose={() => setFlowStep('NONE')}
                title="Enter Transfer Details"
                footer={
                    <div className="flex justify-end gap-2 w-full">
                        <button
                            onClick={() => setFlowStep('QUESTION')}
                            className="bg-secondary hover:bg-secondary/80 text-foreground px-4 py-2 rounded-lg transition-colors text-sm"
                        >
                            Back
                        </button>
                        <button
                            onClick={handleManualSubmit}
                            className="bg-primary hover:bg-accent text-white px-4 py-2 rounded-lg transition-colors text-sm font-semibold"
                        >
                            Confirm & Submit (v2)
                        </button>
                    </div>
                }
            >
                <div className="space-y-4">
                    <p className="text-sm text-muted">Please enter the transaction hash of your manual transfer.</p>

                    <div>
                        <label className="block text-sm text-foreground mb-1">Transaction Hash</label>
                        <input
                            type="text"
                            className="w-full bg-secondary border border-gray-200 rounded-lg p-3 focus:outline-none focus:border-primary text-sm font-mono text-foreground"
                            placeholder="0x..."
                            value={manualTxHash}
                            onChange={(e) => setManualTxHash(e.target.value)}
                        />
                    </div>
                </div>
            </Modal>


            <Modal
                isOpen={modalConfig.isOpen}
                onClose={closeModal}
                title={modalConfig.title}
                footer={
                    <button
                        onClick={closeModal}
                        className="bg-secondary hover:bg-secondary/80 text-foreground px-4 py-2 rounded-lg transition-colors text-sm"
                    >
                        Close
                    </button>
                }
            >
                <div>
                    <p className="text-muted">{modalConfig.message}</p>
                </div>
            </Modal>

            {/* Network Selection Modal for Linking */}
            <NetworkSelectionModal
                isOpen={showNetworkModal}
                onClose={() => setShowNetworkModal(false)}
                onSelectNetwork={handleNetworkSelect}
            />
        </div>
    );
}
