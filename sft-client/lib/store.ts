import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface UserState {
    user: any | null;
    token: string | null;
    walletAddress: string | null;
    isConnected: boolean;
    activeNetwork: any | null;
    _hasHydrated: boolean;
    setUser: (user: any) => void;
    setToken: (token: string) => void;
    setWalletAddress: (address: string) => void;
    setActiveNetwork: (network: any) => void;
    setHasHydrated: (state: boolean) => void;
    connectWallet: (address: string) => void;
    disconnectWallet: () => void;
    logout: () => void;
}

export const useUserStore = create<UserState>()(
    persist(
        (set, get) => ({
            user: null,
            token: null,
            walletAddress: null,
            isConnected: false,
            activeNetwork: null,
            _hasHydrated: false,
            setUser: (user: any) => set({ user }),
            setToken: (token: string) => set({ token }),
            setWalletAddress: (address: string) => set({ walletAddress: address }),
            setActiveNetwork: (network: any) => set({ activeNetwork: network }),
            setHasHydrated: (state: boolean) => set({ _hasHydrated: state }),
            connectWallet: (address: string) => set({ walletAddress: address, isConnected: true }),
            disconnectWallet: () => set({ walletAddress: null, isConnected: false }),
            logout: async () => {
                const { token } = get();
                if (token) {
                    try {
                        const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
                        // Dynamically import axios to avoid SSR issues if any, or just standard import usage
                        const axios = (await import('axios')).default;
                        await axios.post(`${apiBase}/auth/logout`, {}, {
                            headers: { Authorization: `Bearer ${token}` }
                        });
                    } catch (err) {
                        console.error("Logout API call failed", err);
                    }
                }
                set({ user: null, token: null, walletAddress: null, isConnected: false, activeNetwork: null });
            },
        }),
        {
            name: 'user-storage',
            partialize: (state) => ({
                user: state.user,
                token: state.token,
                walletAddress: state.walletAddress,
                isConnected: state.isConnected,
                activeNetwork: state.activeNetwork
            }),
            onRehydrateStorage: () => (state) => {
                state?.setHasHydrated(true);
            },
        }
    )
);
