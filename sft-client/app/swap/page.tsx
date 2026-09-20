'use client';

import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { useUserStore } from '@/lib/store';
import { useRouter } from 'next/navigation';
import { Spinner } from '@/components/Spinner';
import { Modal } from '@/components/Modal';
import { ArrowUpDown, Wallet, Settings, Info } from 'lucide-react';

export default function SwapPage() {
    const { token, user, _hasHydrated, activeNetwork } = useUserStore();
    const router = useRouter();

    const [amount, setAmount] = useState<string>('');
    const [fromToken, setFromToken] = useState<'SFT' | 'USDT'>('SFT');
    const [toToken, setToToken] = useState<'USDT' | 'SFT'>('USDT');
    const [isLoading, setIsLoading] = useState(false);

    // Modal State
    const [modal, setModal] = useState<{
        isOpen: boolean;
        title: string;
        message: string;
    }>({ isOpen: false, title: '', message: '' });

    useEffect(() => {
        if (_hasHydrated && !token) {
            router.push('/login');
        }
    }, [token, _hasHydrated, router]);

    const handleSwapDirection = () => {
        setFromToken(prev => prev === 'SFT' ? 'USDT' : 'SFT');
        setToToken(prev => prev === 'USDT' ? 'SFT' : 'USDT');
    };

    const showModal = (title: string, message: string) => {
        setModal({ isOpen: true, title, message });
    };

    const closeModal = () => {
        setModal({ ...modal, isOpen: false });
        if (modal.title === "Request Submitted") {
            router.push('/requests');
        }
    };

    const handleSwap = async () => {
        if (!amount || parseFloat(amount) <= 0) {
            showModal("Invalid Amount", "Please enter a valid amount.");
            return;
        }
        if (!user?.walletAddress) {
            showModal("Wallet Required", "Please update your profile with a valid wallet address first.");
            return;
        }

        setIsLoading(true);

        try {
            const { connectBNBWallet, ACTIVE_CONFIG, PLATFORM_TOKEN_ADDRESS } = await import('@/lib/ethereum');
            const { ethers } = await import('ethers');

            // Use dynamic network from store or fallback
            const targetConfig = activeNetwork || ACTIVE_CONFIG;
            const walletAddress = await connectBNBWallet(targetConfig);
            const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

            // Fetch/Set Admin Wallet
            let adminWallet = '';
            try {
                // 1. Try Global Settings (Fastest)
                const settingsRes = await axios.get(`${apiBase}/settings`);
                if (settingsRes.data.active_network?.adminWallet) {
                    adminWallet = settingsRes.data.active_network.adminWallet;
                }

                // 2. If not found, try fetching from Admin User Profile (Robust)
                if (!adminWallet) {
                    const adminRes = await axios.get(`${apiBase}/auth/admin-wallet`);
                    if (adminRes.data?.walletAddress && !adminRes.data.walletAddress.startsWith('PENDING_') && !adminRes.data.walletAddress.startsWith('ADMIN_')) {
                        adminWallet = adminRes.data.walletAddress;
                    }
                }
            } catch (e) {
                console.error("Failed to fetch settings/admin-wallet", e);
            }

            if (!adminWallet) {
                showModal("System Error", "Swap system is currently unavailable (Admin Wallet not configured). Please contact support.");
                setIsLoading(false);
                return;
            }

            // Normalize address to avoid checksum errors
            try {
                adminWallet = ethers.getAddress(adminWallet);
            } catch {
                adminWallet = ethers.getAddress(adminWallet.toLowerCase());
            }

            let userTxHash = '';
            const provider = new ethers.BrowserProvider((window as any).ethereum);
            const signer = await provider.getSigner();

            // Check BNB Balance for Gas
            const bnbBalance = await provider.getBalance(walletAddress);
            if (bnbBalance === BigInt(0)) {
                throw new Error("Insufficient BNB for gas fees. Please add some BNB to your wallet.");
            }

            if (fromToken === 'USDT') {
                const USDT_ADDRESS = (activeNetwork as any)?.tokens?.USDT || (ACTIVE_CONFIG as any).tokens?.USDT || "0x55d398326f99059fF775485246999027B3197955";
                const USDT_ABI = [
                    "function transfer(address to, uint256 amount) returns (bool)",
                    "function decimals() view returns (uint8)",
                    "function balanceOf(address account) view returns (uint256)"
                ];
                const usdtContract = new ethers.Contract(USDT_ADDRESS, USDT_ABI, signer);
                const decimals = await usdtContract.decimals();
                const amountWei = ethers.parseUnits(amount, decimals);

                const balance = await usdtContract.balanceOf(walletAddress);
                if (balance < amountWei) {
                    throw new Error(`Insufficient USDT balance. You have ${ethers.formatUnits(balance, decimals)} USDT.`);
                }

                const tx = await usdtContract.transfer(adminWallet, amountWei);
                await tx.wait();
                userTxHash = tx.hash;
            } else {
                const SFT_ADDRESS = (activeNetwork as any)?.tokens?.SFT || (ACTIVE_CONFIG as any).tokens?.SFT || PLATFORM_TOKEN_ADDRESS;
                const SFT_ABI = [
                    "function transfer(address to, uint256 amount) returns (bool)",
                    "function decimals() view returns (uint8)",
                    "function balanceOf(address account) view returns (uint256)"
                ];
                const sftContract = new ethers.Contract(SFT_ADDRESS, SFT_ABI, signer);
                const decimals = await sftContract.decimals();
                const amountWei = ethers.parseUnits(amount, decimals);

                const balance = await sftContract.balanceOf(walletAddress);
                if (balance < amountWei) {
                    throw new Error(`Insufficient SFT balance. You have ${ethers.formatUnits(balance, decimals)} SFT.`);
                }

                const tx = await sftContract.transfer(adminWallet, amountWei);
                await tx.wait();
                userTxHash = tx.hash;
            }

            await axios.post(`${apiBase}/swaps`, {
                amount: parseFloat(amount),
                fromToken,
                toToken,
                walletAddress,
                userTxHash
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            showModal("Request Submitted", "Your swap request has been submitted successfully!");
            setAmount('');
        } catch (error: any) {
            console.error("Swap failed", error);
            if (error.code === 'ACTION_REJECTED' || error.code === 4001) {
                showModal("Cancelled", "Transaction rejected in wallet.");
            } else {
                showModal("Error", "Swap failed: " + (error.reason || error.message));
            }
        } finally {
            setIsLoading(false);
        }
    };

    if (!_hasHydrated) return null;

    return (
        <div className="min-h-[calc(100vh-80px)] flex flex-col items-center justify-center p-4">
            {/* Ambient Background Glow */}
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-primary/20 rounded-full blur-[120px] -z-10 pointer-events-none opacity-50"></div>

            <div className="w-full max-w-[480px]">
                {/* Header */}
                <div className="flex justify-between items-center mb-6 px-2">
                    <h1 className="text-2xl font-bold text-gray-900">Swap</h1>
                    <div className="flex gap-2 text-gray-500">
                        <button className="p-2 hover:bg-secondary rounded-full transition-colors">
                            <Settings className="w-5 h-5" />
                        </button>
                    </div>
                </div>

                {/* Main Card */}
                <div className="bg-white/80 backdrop-blur-xl border border-gray-200 rounded-3xl p-4 shadow-2xl relative overflow-hidden">

                    {/* From Section */}
                    <div className="bg-gray-100 rounded-2xl p-4 border border-transparent hover:border-gray-200 transition-colors group">
                        <div className="flex justify-between items-center mb-3">
                            <span className="text-sm text-gray-500 font-medium">From</span>

                        </div>
                        <div className="flex justify-between items-center gap-4">
                            <input
                                type="number"
                                value={amount}
                                onChange={(e) => setAmount(e.target.value)}
                                placeholder="0"
                                className="w-full bg-transparent text-4xl text-gray-900 font-medium outline-none placeholder-gray-400"
                            />
                            <div className="flex items-center gap-2 bg-white p-1.5 pr-4 rounded-full border border-gray-200 shadow-sm shrink-0">
                                <div className="w-8 h-8 rounded-full flex items-center justify-center overflow-hidden">
                                    {fromToken === 'USDT' ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src="https://cryptologos.cc/logos/tether-usdt-logo.png?v=025" alt="USDT" className="w-full h-full object-cover" />
                                    ) : (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src="/logo/sft_logo.png" alt="SFT" className="w-full h-full object-cover" />
                                    )}
                                </div>
                                <span className="font-bold text-gray-900">{fromToken}</span>
                            </div>
                        </div>
                        <div className="mt-2 text-xs text-gray-400">
                            {amount ? `≈ $${amount} USD` : '$0.00 USD'}
                        </div>
                    </div>

                    {/* Bridge Icon - Centered overlapping */}
                    <div className="relative -my-4 z-10 flex justify-center">
                        <button
                            onClick={handleSwapDirection}
                            className="bg-white border-[3px] border-white rounded-xl p-2 shadow-lg hover:scale-110 active:scale-95 transition-all group"
                        >
                            <ArrowUpDown className="w-5 h-5 text-gray-600 group-hover:text-primary transition-colors" />
                        </button>
                    </div>

                    {/* To Section */}
                    <div className="bg-gray-100 rounded-2xl p-4 pt-6 border border-transparent hover:border-gray-200 transition-colors">
                        <div className="flex justify-between items-center mb-3">
                            <span className="text-sm text-gray-500 font-medium">To</span>
                        </div>
                        <div className="flex justify-between items-center gap-4">
                            <span className="text-4xl text-gray-900 font-medium truncate">
                                {amount || '0'}
                            </span>
                            <div className="flex items-center gap-2 bg-white p-1.5 pr-4 rounded-full border border-gray-200 shadow-sm shrink-0">
                                <div className="w-8 h-8 rounded-full flex items-center justify-center overflow-hidden">
                                    {toToken === 'USDT' ? (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src="https://cryptologos.cc/logos/tether-usdt-logo.png?v=025" alt="USDT" className="w-full h-full object-cover" />
                                    ) : (
                                        // eslint-disable-next-line @next/next/no-img-element
                                        <img src="/logo/sft_logo.png" alt="SFT" className="w-full h-full object-cover" />
                                    )}
                                </div>
                                <span className="font-bold text-gray-900">{toToken}</span>
                            </div>
                        </div>
                        <div className="mt-2 flex justify-between items-center text-xs text-gray-400">
                            <span>≈ ${amount || '0.00'} USD</span>
                            <span className="flex items-center gap-1">1 {fromToken} = 1 {toToken} <Info className="w-3 h-3" /></span>
                        </div>
                    </div>

                    {/* Action Button */}
                    <button
                        onClick={handleSwap}
                        disabled={isLoading}
                        className="w-full mt-4 bg-primary hover:bg-primary/90 text-white font-bold text-lg py-4 rounded-2xl shadow-lg shadow-primary/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed transform active:scale-[0.99]"
                    >
                        {isLoading ? (
                            <div className="flex items-center justify-center gap-2">
                                <Spinner size="sm" color="white" />
                                <span>Swapping...</span>
                            </div>
                        ) : (
                            'Review Swap'
                        )}
                    </button>
                </div>

                {/* Info Text */}
                <div className="mt-6 text-center">
                    <p className="text-xs text-muted-foreground">
                        Secure Financial Platform Routing · Slippage 0.5% · Network Fee ~$0.30
                    </p>
                </div>
            </div>

            <Modal
                isOpen={modal.isOpen}
                onClose={closeModal}
                title={modal.title}
                footer={
                    <button onClick={closeModal} className="bg-secondary hover:bg-secondary/80 text-gray-900 px-4 py-2 rounded-lg transition-colors">
                        Close
                    </button>
                }
            >
                <div>
                    <p className="text-gray-900">{modal.message}</p>
                </div>
            </Modal>
        </div>
    );
}
