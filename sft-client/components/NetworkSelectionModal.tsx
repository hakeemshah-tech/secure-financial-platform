import React from 'react';
import {
    BNB_MAINNET_PARAMS,
    BNB_TESTNET_PARAMS,
    ETH_MAINNET_PARAMS,
    POLYGON_PARAMS,
    ARBITRUM_PARAMS,
    OPTIMISM_PARAMS,
    AVALANCHE_PARAMS,
    BASE_PARAMS,
    FANTOM_PARAMS
} from '@/lib/ethereum';

interface NetworkSelectionModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectNetwork: (network: any) => void;
}

export const NetworkSelectionModal: React.FC<NetworkSelectionModalProps> = ({ isOpen, onClose, onSelectNetwork }) => {
    if (!isOpen) return null;

    const networks = [
        {
            name: 'Ethereum',
            params: ETH_MAINNET_PARAMS,
            icon: (
                <svg viewBox="0 0 256 417" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid" className="w-8 h-8">
                    <path fill="#fff" d="M127.961 0l-2.795 9.5v275.668l2.795 2.79 127.962-75.638z" />
                    <path fill="#fff" d="M127.962 0L0 212.32l127.962 75.639V154.158z" />
                    <path fill="#fff" d="M127.961 312.187l-1.575 1.92v98.199l1.575 4.6L256 236.587z" />
                    <path fill="#fff" d="M127.962 416.905v-104.72L0 236.585z" />
                    <path fill="#eee" d="M127.961 287.958l127.96-75.637-127.96-58.162z" />
                    <path fill="#eee" d="M0 212.32l127.96 75.638v-133.8z" />
                </svg>
            ),
            color: 'from-blue-500 to-indigo-600'
        },
        {
            name: 'BNB Chain',
            params: BNB_MAINNET_PARAMS,
            icon: (
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-8 h-8">
                    <path d="M12.0002 8.74996L9.61352 11.1366L12.0002 13.5233L14.3869 11.1366L12.0002 8.74996ZM16.3735 6.66663L18.7602 9.05329L21.1469 6.66663L18.7602 4.27996L16.3735 6.66663ZM7.62685 6.66663L5.24019 4.27996L2.85352 6.66663L5.24019 9.05329L7.62685 6.66663ZM12.0002 18.3133L9.61352 15.9266L12.0002 13.54L14.3869 15.9266L12.0002 18.3133ZM16.3735 13.54L18.7602 11.1533L21.1469 13.54L18.7602 15.9266L16.3735 13.54ZM7.62685 13.54L5.24019 15.9266L2.85352 13.54L5.24019 11.1533L7.62685 13.54ZM12.0002 4.02663L9.61352 6.41329L12.0002 8.79996L14.3869 6.41329L12.0002 4.02663ZM16.3735 20.3933L18.7602 18.0066L16.3735 15.62L13.9869 18.0066L16.3735 20.3933ZM7.62685 20.3933L10.0135 18.0066L7.62685 15.62L5.24019 18.0066L7.62685 20.3933Z" fill="#F0B90B" />
                </svg>
            ),
            color: 'from-yellow-400 to-yellow-600'
        },
        {
            name: 'BNB Testnet',
            params: BNB_TESTNET_PARAMS,
            icon: (
                <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-8 h-8 opacity-70">
                    <path d="M12.0002 8.74996L9.61352 11.1366L12.0002 13.5233L14.3869 11.1366L12.0002 8.74996ZM16.3735 6.66663L18.7602 9.05329L21.1469 6.66663L18.7602 4.27996L16.3735 6.66663ZM7.62685 6.66663L5.24019 4.27996L2.85352 6.66663L5.24019 9.05329L7.62685 6.66663ZM12.0002 18.3133L9.61352 15.9266L12.0002 13.54L14.3869 15.9266L12.0002 18.3133ZM16.3735 13.54L18.7602 11.1533L21.1469 13.54L18.7602 15.9266L16.3735 13.54ZM7.62685 13.54L5.24019 15.9266L2.85352 13.54L5.24019 11.1533L7.62685 13.54ZM12.0002 4.02663L9.61352 6.41329L12.0002 8.79996L14.3869 6.41329L12.0002 4.02663ZM16.3735 20.3933L18.7602 18.0066L16.3735 15.62L13.9869 18.0066L16.3735 20.3933ZM7.62685 20.3933L10.0135 18.0066L7.62685 15.62L5.24019 18.0066L7.62685 20.3933Z" fill="#888" />
                </svg>
            ),
            color: 'from-gray-500 to-gray-700'
        },
        {
            name: 'Polygon',
            params: POLYGON_PARAMS,
            icon: (
                <svg viewBox="0 0 38 33" fill="none" xmlns="http://www.w3.org/2000/svg" className="w-8 h-8">
                    <path d="M29.566 22.106l-8.91 5.253-8.895-5.267v-10.3l8.894-5.267v-0.014l8.91 5.28V22.107zM19.006 8.35L27.656 3.226 19.006 8.35zM9.462 25.105V13.88l-4.706-2.616L0.05 13.88v11.226l9.67 5.759 9.67-5.76V13.88l-9.928 5.61v5.614l9.428-5.758v10.63l-9.428 5.63-9.43-5.63V14.5l4.721 2.825v10.606l4.707 2.801zM28.066 13.88v11.226l9.671-5.76V8.12L28.066 13.88z" fill="#8247E5" />
                </svg>
            ),
            color: 'from-purple-500 to-pink-600'
        },
        {
            name: 'Arbitrum',
            params: ARBITRUM_PARAMS,
            icon: (
                <svg viewBox="0 0 464 464" xmlns="http://www.w3.org/2000/svg" className="w-8 h-8">
                    <path fill="#2D374B" d="M232.001 0C104.09 0 0.407 103.684 0.407 231.595S104.09 463.19 232.001 463.19c127.91 0 231.593-103.684 231.593-231.595S359.911 0 232.001 0zm0 411.378c-99.197 0-179.79-80.593-179.79-179.79S132.805 51.797 232.001 51.797c99.197 0 179.79 80.593 179.79 179.79s-80.593 179.79-179.79 179.79z" />
                    <path fill="#28A0F0" d="M232.001 51.797C132.805 51.797 52.21 132.39 52.21 231.587c0 99.198 80.594 179.791 179.791 179.791s179.791-80.593 179.791-179.791c-.001-99.197-80.594-179.79-179.791-179.79z" />
                    <path fill="#fff" d="M198.813 325.32l32.895-163.488 33.722 163.488h39.141L254.437 127.76h-46.06l-51.042 197.56h41.478z" />
                </svg>
            ),
            color: 'from-blue-400 to-blue-600'
        },
        {
            name: 'Optimism',
            params: OPTIMISM_PARAMS,
            icon: (
                <svg viewBox="0 0 120 120" xmlns="http://www.w3.org/2000/svg" className="w-8 h-8">
                    <path fill="#FF0420" d="M60 0C26.863 0 0 26.863 0 60s26.863 60 60 60 60-26.863 60-60S93.137 0 60 0z" />
                    <path fill="#fff" d="M38.8 32.7h-7.6v19.1H15.6v7.6h15.6v19.1h7.6V59.4h15.6v-7.6H38.8V32.7zm49.9 0h-7.6v19.1H65.5v7.6h15.6v19.1h7.6V59.4h15.6v-7.6H88.7V32.7z" />
                </svg>
            ),
            color: 'from-red-500 to-red-600'
        },
        {
            name: 'Avalanche',
            params: AVALANCHE_PARAMS,
            icon: (
                <svg viewBox="0 0 1373 1373" xmlns="http://www.w3.org/2000/svg" className="w-8 h-8">
                    <path fill="#E84142" d="M46.864 1009.28h340.06L686.953 490.64 46.864 1009.28ZM986.326 1009.28h340.06l-170.16-291.56-169.9 291.56ZM686.953 147.108 474.697 453.303 686.953 807.59l212.19-354.288L686.953 147.108Z" />
                </svg>
            ),
            color: 'from-red-600 to-red-800'
        },
        {
            name: 'Base',
            params: BASE_PARAMS,
            icon: (
                <svg viewBox="0 0 550 550" xmlns="http://www.w3.org/2000/svg" className="w-8 h-8">
                    <circle cx="275" cy="275" r="275" fill="#0052FF" />
                    <path d="M387.5 167.5c-44.183 0-80 35.817-80 80s35.817 80 80 80 80-35.817 80-80-35.817-80-80-80zm0 120c-22.091 0-40-17.909-40-40s17.909-40 40-40 40 17.909 40 40-17.909 40-40 40z" fill="#fff" />
                </svg>
            ),
            color: 'from-blue-600 to-blue-800'
        },
        {
            name: 'Fantom',
            params: FANTOM_PARAMS,
            icon: (
                <svg viewBox="0 0 800 800" xmlns="http://www.w3.org/2000/svg" className="w-8 h-8">
                    <circle cx="400" cy="400" r="400" fill="#13B5EC" />
                    <path fill="#fff" d="M608.2 284h-99c-5.8 0-11-3.1-13.8-8.2l-37-67.9c-2.8-5.1-8-8.2-13.8-8.2H355.4c-5.8 0-11 3.1-13.8 8.2l-37 67.9c-2.8 5.1-8 8.2-13.8 8.2h-99c-10.5 0-16.5 11.9-10.4 20.6l79.9 116.3c3.4 5 4.6 11.2 3.3 17.1l-25.5 125.7c-2.4 11.8 11.7 20.8 21.6 13.9l122.9-85.3c4.7-3.3 11-3.3 15.7 0l122.9 85.3c9.9 6.9 24-2.1 21.6-13.9l-25.5-125.7c-1.2-5.9 0-12.1 3.3-17.1l79.9-116.3c6.1-8.7.1-20.6-10.4-20.6z" />
                </svg>
            ),
            color: 'from-blue-400 to-indigo-500'
        },
    ];

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center min-h-screen p-4 overflow-y-auto">
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300"
                onClick={onClose}
            />

            {/* Modal Container */}
            <div className="relative z-10 bg-[#0f1014]/90 backdrop-blur-xl border border-white/10 rounded-3xl w-full max-w-3xl shadow-2xl p-8 animate-in zoom-in-95 slide-in-from-bottom-5 duration-300 overflow-hidden my-auto">
                {/* Decoration */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-1 bg-gradient-to-r from-transparent via-primary to-transparent opacity-50 blur-sm"></div>
                <div className="absolute -top-20 -right-20 w-64 h-64 bg-primary/10 rounded-full blur-3xl"></div>
                <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-primary/10 rounded-full blur-3xl"></div>

                <button
                    onClick={onClose}
                    className="absolute top-6 right-6 text-gray-400 hover:text-white transition-colors bg-white/5 hover:bg-white/10 p-2 rounded-full z-20"
                >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"></path></svg>
                </button>

                <div className="mb-8 text-center relative z-10">
                    <h2 className="text-3xl font-bold mb-2">
                        <span className="bg-gradient-to-r from-primary via-accent to-primary bg-clip-text text-transparent">
                            Select Network
                        </span>
                    </h2>
                    <p className="text-gray-400 text-sm max-w-md mx-auto">
                        Connect your wallet to one of the supported high-performance blockchain networks.
                    </p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar relative z-10">
                    {networks.map((network) => (
                        <button
                            key={network.name}
                            onClick={() => onSelectNetwork(network.params)}
                            className="group relative flex flex-col items-center justify-center p-6 rounded-2xl bg-white/5 border border-white/5 hover:border-white/20 transition-all duration-300 hover:-translate-y-1 overflow-hidden"
                        >
                            {/* Hover Gradient Background */}
                            <div className={`absolute inset-0 bg-gradient-to-br ${network.color} opacity-0 group-hover:opacity-10 transition-opacity duration-300`}></div>

                            {/* Icon Glow */}
                            <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-12 h-12 bg-gradient-to-br ${network.color} blur-xl opacity-0 group-hover:opacity-20 transition-opacity duration-300`}></div>

                            <div className="relative z-10 transform group-hover:scale-110 transition-transform duration-300 text-4xl mb-4 filter drop-shadow-md">
                                {network.icon}
                            </div>

                            <h3 className="relative z-10 font-bold text-gray-200 group-hover:text-white transition-colors text-sm md:text-base">
                                {network.name}
                            </h3>

                            <div className="absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-300 transform translate-x-2 group-hover:translate-x-0">
                                <span className={`text-${network.color.split('-')[1]}-400 text-xs`}>●</span>
                            </div>
                        </button>
                    ))}
                </div>
            </div>
        </div>
    );
};
