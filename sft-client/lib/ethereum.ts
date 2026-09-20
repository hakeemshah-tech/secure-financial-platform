export interface WalletError {
    code?: number;
    message: string;
}

/**
 * Inert placeholder used whenever a deployment-specific contract address is absent.
 * Transfers to the zero address fail closed, so a missing configuration surfaces as a
 * rejected transaction rather than a silent misroute of funds.
 */
export const PLACEHOLDER_TOKEN_ADDRESS = "0x0000000000000000000000000000000000000000";

/**
 * Address of the platform's SFT Token contract.
 *
 * Deliberately not committed: the deployed contract address is environment-specific and
 * is injected at build time via NEXT_PUBLIC_SFT_CONTRACT_ADDRESS. See `.env.example`.
 */
export const PLATFORM_TOKEN_ADDRESS =
    process.env.NEXT_PUBLIC_SFT_CONTRACT_ADDRESS || PLACEHOLDER_TOKEN_ADDRESS;

export const BNB_MAINNET_PARAMS = {
    chainId: '0x38',
    chainName: 'BNB Smart Chain',
    nativeCurrency: { name: 'BNB', symbol: 'BNB', decimals: 18 },
    rpcUrls: ['https://bsc-dataseed.binance.org/'],
    blockExplorerUrls: ['https://bscscan.com/'],
    tokens: {
        USDT: "0x55d398326f99059fF775485246999027B3197955",
        SFT: PLATFORM_TOKEN_ADDRESS
    }
};

export const BNB_TESTNET_PARAMS = {
    chainId: '0x61',
    chainName: 'BNB Smart Chain Testnet',
    nativeCurrency: { name: 'tBNB', symbol: 'tBNB', decimals: 18 },
    rpcUrls: ['https://data-seed-prebsc-1-s1.binance.org:8545/'],
    blockExplorerUrls: ['https://testnet.bscscan.com/'],
    tokens: {
        USDT: "0x337610d27c682E347C9cD60BD4b3b107C9d34dDd",
        SFT: PLATFORM_TOKEN_ADDRESS
    }
};

export const ETH_MAINNET_PARAMS = {
    chainId: '0x1',
    chainName: 'Ethereum Mainnet',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://mainnet.infura.io/v3/'],
    blockExplorerUrls: ['https://etherscan.io/'],
    tokens: {
        USDT: "0xdAC17F958D2ee523a2206206994597C13D831ec7",
        SFT: PLATFORM_TOKEN_ADDRESS // Fallback
    }
};

export const POLYGON_PARAMS = {
    chainId: '0x89',
    chainName: 'Polygon Mainnet',
    nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 },
    rpcUrls: ['https://polygon-rpc.com/'],
    blockExplorerUrls: ['https://polygonscan.com/'],
    tokens: {
        USDT: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F",
        SFT: PLATFORM_TOKEN_ADDRESS
    }
};

export const ARBITRUM_PARAMS = {
    chainId: '0xa4b1',
    chainName: 'Arbitrum One',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://arb1.arbitrum.io/rpc'],
    blockExplorerUrls: ['https://arbiscan.io/'],
    tokens: {
        USDT: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9",
        SFT: PLATFORM_TOKEN_ADDRESS
    }
};

export const OPTIMISM_PARAMS = {
    chainId: '0xa',
    chainName: 'OP Mainnet',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://mainnet.optimism.io'],
    blockExplorerUrls: ['https://optimistic.etherscan.io/'],
    tokens: {
        USDT: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58",
        SFT: PLATFORM_TOKEN_ADDRESS
    }
};

export const AVALANCHE_PARAMS = {
    chainId: '0xa86a',
    chainName: 'Avalanche C-Chain',
    nativeCurrency: { name: 'AVAX', symbol: 'AVAX', decimals: 18 },
    rpcUrls: ['https://api.avax.network/ext/bc/C/rpc'],
    blockExplorerUrls: ['https://snowtrace.io/'],
    tokens: {
        USDT: "0x9702230A8Ea53601f5cD2dc00fDBc13d4df4A8c7",
        SFT: PLATFORM_TOKEN_ADDRESS
    }
};

export const BASE_PARAMS = {
    chainId: '0x2105',
    chainName: 'Base',
    nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
    rpcUrls: ['https://mainnet.base.org'],
    blockExplorerUrls: ['https://basescan.org//'],
    tokens: {
        USDT: "0x50c5725949a6f0c72e6c4a641f24049a917db0c4",
        SFT: PLATFORM_TOKEN_ADDRESS
    }
};

export const FANTOM_PARAMS = {
    chainId: '0xfa',
    chainName: 'Fantom Opera',
    nativeCurrency: { name: 'Fantom', symbol: 'FTM', decimals: 18 },
    rpcUrls: ['https://rpc.ftm.tools'],
    blockExplorerUrls: ['https://ftmscan.com/'],
    tokens: {
        USDT: "0x04068DA6C83AFCFA0e13ba15A6696662335D5B75",
        SFT: PLATFORM_TOKEN_ADDRESS
    }
};

// Set to Mainnet for production.
export const TARGET_NETWORK = {
    ...BNB_MAINNET_PARAMS,
    tokens: {
        USDT: "0x55d398326f99059fF775485246999027B3197955", // BSC Mainnet USDT
        SFT: PLATFORM_TOKEN_ADDRESS, // SFT Address
    }
};

// Testnet Reference
export const TESTNET_CONFIG = {
    ...BNB_TESTNET_PARAMS,
    tokens: {
        USDT: "0x337610d27c682E347C9cD60BD4b3b107C9d34dDd",
        SFT: PLATFORM_TOKEN_ADDRESS
    }
};

// Export active config derived from TARGET_NETWORK
export const ACTIVE_CONFIG = TARGET_NETWORK;

// Helper to safely get the provider directly from window
const getProvider = () => {
    try {
        if (typeof window !== 'undefined' && 'ethereum' in window) {
            return (window as any).ethereum;
        }
    } catch (e) {
        console.error("Error accessing window.ethereum:", e);
    }
    return null;
};

export const checkMetaMaskInstalled = async (): Promise<boolean> => {
    const provider = getProvider();
    return !!provider;
};

export const switchNetwork = async (targetNetwork: any = TARGET_NETWORK): Promise<void> => {
    const ethereum = getProvider();
    if (!ethereum) throw new Error("MetaMask not installed");

    try {
        await ethereum.request({
            method: 'wallet_switchEthereumChain',
            params: [{ chainId: targetNetwork.chainId }],
        });
    } catch (switchError: any) {
        if (switchError.code === 4902) {
            try {
                // Remove tokens field for wallet_addEthereumChain
                const { tokens, ...addParams } = targetNetwork;
                await ethereum.request({
                    method: 'wallet_addEthereumChain',
                    params: [addParams],
                });
            } catch (addError) {
                console.error("Failed to add network:", addError);
                throw addError;
            }
        } else {
            console.error("Failed to switch network:", switchError);
            throw switchError;
        }
    }
};

export const connectBNBWallet = async (targetNetwork: any = TARGET_NETWORK): Promise<string> => {
    try {
        let ethereum = getProvider();

        // Retry logic for asynchronous injection (wait up to 1000ms)
        if (!ethereum) {
            for (let i = 0; i < 10; i++) {
                await new Promise(resolve => setTimeout(resolve, 100));
                ethereum = getProvider();
                if (ethereum) break;
            }
        }

        if (!ethereum) {
            // Check if on mobile, looking for other injections?
            throw new Error("MetaMask is not installed. Please install it to continue.");
        }

        console.log("Ethereum provider detected.");

        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error("Connection timed out. Please check your MetaMask extension is unlocked and not pending another request.")), 15000)
        );

        console.log("Requesting accounts...");

        const accounts = await Promise.race([
            ethereum.request({ method: 'eth_requestAccounts' }),
            timeoutPromise
        ]) as string[];

        console.log("Accounts received:", accounts ? accounts.length : 0);

        if (!accounts || accounts.length === 0) {
            throw new Error("No accounts found");
        }

        const account = accounts[0];

        const chainId = await ethereum.request({ method: 'eth_chainId' });
        console.log("Chain ID:", chainId);

        if (chainId !== targetNetwork.chainId) {
            await switchNetwork(targetNetwork);
        }

        return account;
    } catch (error: any) {
        console.error("Error connecting to wallet:", error?.message || error);
        throw new Error(error?.message || "Failed to connect wallet");
    }
};
