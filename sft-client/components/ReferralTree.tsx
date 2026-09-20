import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { CopyButton } from './CopyButton';

export interface TreeNodeData {
    _id: string;
    name?: string;
    username?: string;
    email: string;
    referralCode: string;
    left: TreeNodeData | null;
    right: TreeNodeData | null;
    isPlacedInTree: boolean;
    isActive?: boolean;
    referrer?: {
        _id: string;
        email: string;
        username?: string;
    } | string;
    // New Stats
    leftVolume?: number;
    rightVolume?: number;
    totalMatched?: number;
    leftCount?: number;
    rightCount?: number;
    leftActiveCount?: number;
    rightActiveCount?: number;
    personalInvestment?: number;
}

const DetailModal = ({ isOpen, onClose, node, currentUserReferralCode }: { isOpen: boolean, onClose: () => void, node: TreeNodeData, currentUserReferralCode?: string }) => {
    if (!isOpen) return null;

    const leftVol = node.leftVolume || 0;
    const rightVol = node.rightVolume || 0;
    const totalMatched = node.totalMatched || 0;
    const personalInvestment = node.personalInvestment || 0;

    // Calculate Pending (Unpaired)
    const unpairedLeft = Math.max(0, leftVol - totalMatched);
    const unpairedRight = Math.max(0, rightVol - totalMatched);

    // Member Counts
    const lCount = node.leftCount || 0;
    const rCount = node.rightCount || 0;
    const lActive = node.leftActiveCount || 0;
    const rActive = node.rightActiveCount || 0;
    const lInactive = lCount - lActive;
    const rInactive = rCount - rActive;

    // Determine which code to use: Logged in user's OR the node's itself (fallback, though req says logged in)
    const refCodeToUse = currentUserReferralCode || node.referralCode;

    return createPortal(
        <div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
            onClick={onClose}
        >
            <div
                className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden relative animate-in fade-in zoom-in-95 duration-200"
                onClick={(e) => e.stopPropagation()}
            >
                {/* Header */}
                <div className="bg-primary/10 p-4 flex justify-between items-center border-b border-gray-100">
                    <div>
                        <h3 className="text-lg font-bold text-primary">{node.username || node.email.split('@')[0]}</h3>
                        <p className="text-xs text-muted-foreground">{node.email}</p>
                        {node.referrer && (
                            <div className="text-xs text-gray-500 mt-1 flex flex-col">
                                <span className="flex items-center gap-1">
                                    <span className="text-muted-foreground">Referred by:</span>
                                    <span className="font-semibold text-primary">
                                        {typeof node.referrer === 'object'
                                            ? (node.referrer.username || node.referrer.email.split('@')[0])
                                            : 'Unknown'}
                                    </span>
                                </span>
                                {typeof node.referrer === 'object' && (
                                    <span className="text-[10px] text-muted-foreground ml-auto">
                                        ({node.referrer.email})
                                    </span>
                                )}
                            </div>
                        )}
                    </div>
                    <div className="flex flex-col items-end">
                        <div className="text-[10px] text-muted-foreground uppercase font-bold">Personal Investment</div>
                        <div className="text-lg font-bold text-green-600">{personalInvestment.toLocaleString()} SFT</div>
                    </div>
                </div>

                {/* Referral Link Section */}
                <div className="px-4 py-3 border-b border-gray-100 space-y-3">
                    {/* Left Link */}
                    <div>
                        <label className="block text-xs font-semibold text-blue-600 mb-1">Left Referral Link</label>
                        <div className="bg-blue-50/50 p-2 rounded-lg font-mono text-xs border border-blue-100 flex items-center justify-between gap-2 text-foreground">
                            <div
                                className="overflow-x-auto whitespace-nowrap text-nowrap [&::-webkit-scrollbar]:hidden"
                                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                            >
                                {typeof window !== 'undefined' ? `${window.location.origin}/signup?referral=${refCodeToUse}&position=left&placement=${node._id}` : ''}
                            </div>
                            <div className="flex-shrink-0 pl-2">
                                <CopyButton
                                    text={typeof window !== 'undefined' ? `${window.location.origin}/signup?referral=${refCodeToUse}&position=left&placement=${node._id}` : ''}
                                    className="hover:bg-blue-100 p-1.5 rounded transition-colors text-blue-600"
                                />
                            </div>
                        </div>
                    </div>

                    {/* Right Link */}
                    <div>
                        <label className="block text-xs font-semibold text-purple-600 mb-1">Right Referral Link</label>
                        <div className="bg-purple-50/50 p-2 rounded-lg font-mono text-xs border border-purple-100 flex items-center justify-between gap-2 text-foreground">
                            <div
                                className="overflow-x-auto whitespace-nowrap text-nowrap [&::-webkit-scrollbar]:hidden"
                                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
                            >
                                {typeof window !== 'undefined' ? `${window.location.origin}/signup?referral=${refCodeToUse}&position=right&placement=${node._id}` : ''}
                            </div>
                            <div className="flex-shrink-0 pl-2">
                                <CopyButton
                                    text={typeof window !== 'undefined' ? `${window.location.origin}/signup?referral=${refCodeToUse}&position=right&placement=${node._id}` : ''}
                                    className="hover:bg-purple-100 p-1.5 rounded transition-colors text-purple-600"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="p-0">
                    <table className="w-full text-sm">
                        <thead className="bg-gray-50 text-xs text-gray-500 font-semibold uppercase">
                            <tr>
                                <th className="px-4 py-3 text-left">Metric</th>
                                <th className="px-4 py-3 text-center text-blue-600">Left</th>
                                <th className="px-4 py-3 text-center text-purple-600">Right</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {/* Business Volume */}
                            <tr>
                                <td className="px-4 py-3 font-medium text-gray-700">Team Volume (Business)</td>
                                <td className="px-4 py-3 text-center font-bold">{leftVol.toLocaleString()}</td>
                                <td className="px-4 py-3 text-center font-bold">{rightVol.toLocaleString()}</td>
                            </tr>
                            {/* Team Count */}
                            <tr>
                                <td className="px-4 py-3 font-medium text-gray-700">Total Members</td>
                                <td className="px-4 py-3 text-center">{lCount}</td>
                                <td className="px-4 py-3 text-center">{rCount}</td>
                            </tr>
                            {/* Active/Inactive */}
                            <tr>
                                <td className="px-4 py-3 font-medium text-gray-700">Active / Inactive</td>
                                <td className="px-4 py-3 text-center">
                                    <span className="text-green-600 font-bold">{lActive}</span> / <span className="text-red-400">{lInactive}</span>
                                </td>
                                <td className="px-4 py-3 text-center">
                                    <span className="text-green-600 font-bold">{rActive}</span> / <span className="text-red-400">{rInactive}</span>
                                </td>
                            </tr>
                            {/* Unpaired */}
                            <tr>
                                <td className="px-4 py-3 font-medium text-gray-700">Unpaired (Carry)</td>
                                <td className="px-4 py-3 text-center text-gray-600">{unpairedLeft.toLocaleString()}</td>
                                <td className="px-4 py-3 text-center text-gray-600">{unpairedRight.toLocaleString()}</td>
                            </tr>
                        </tbody>
                    </table>

                    {/* Summary Footer */}
                    <div className="bg-gray-50 p-4 border-t border-gray-100 flex justify-between items-center">
                        <div className="flex flex-col text-center w-1/2 border-r border-gray-200">
                            <span className="text-xs text-gray-500 uppercase font-bold">Total Matched</span>
                            <span className="text-xl font-bold text-green-600">{totalMatched.toLocaleString()}</span>
                        </div>
                        <div className="flex flex-col text-center w-1/2">
                            <span className="text-xs text-gray-500 uppercase font-bold">Total Team Volume</span>
                            <span className="text-xl font-bold text-gray-800">{(leftVol + rightVol).toLocaleString()}</span>
                        </div>
                    </div>
                </div>

                <div className="p-3 bg-white text-center">
                    <button
                        onClick={onClose}
                        className="w-full py-2 rounded-lg bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium transition"
                    >
                        Close
                    </button>
                </div>
            </div>
        </div >,
        document.body
    );
};

export const ReferralTree = ({ node, currentUserReferralCode }: { node: TreeNodeData | null, currentUserReferralCode?: string }) => {
    const [showModal, setShowModal] = useState(false);

    if (!node) {
        return (
            <div className="flex flex-col items-center">
                <div className="relative z-10 flex flex-col items-center">
                    <div className="flex flex-col items-center opacity-40">
                        <div className="w-10 h-10 md:w-12 md:h-12 rounded-full bg-secondary border-2 border-dashed border-gray-300 flex items-center justify-center">
                            <span className="text-muted text-[10px] md:text-xs">Empty</span>
                        </div>
                    </div>
                </div>
            </div>
        )
    }

    return (
        <div className="flex flex-col items-center">
            <div className="relative z-10 flex flex-col items-center">
                {/* Node Card - Clickable */}
                <div
                    onClick={() => setShowModal(true)}
                    className="flex flex-col items-center group relative cursor-pointer"
                >
                    <div className={`w-12 h-12 md:w-16 md:h-16 rounded-full bg-white border-2 ${node.isActive ? 'border-primary' : 'border-red-500'} flex items-center justify-center shadow-lg transition-all hover:shadow-primary/50 hover:scale-110`}>
                        <span className={`text-xl md:text-2xl ${node.isActive ? 'text-primary' : 'text-red-500'}`}>👤</span>
                    </div>

                    {/* Visible Name Label */}
                    <div className="mt-1 md:mt-2 text-center">
                        <div className="text-[10px] md:text-xs font-bold text-foreground max-w-[80px] md:max-w-[100px] truncate">{node.username || node.name || node.email.split('@')[0]}</div>
                        <div className="text-[8px] md:text-[10px] text-primary">{node.referralCode}</div>
                    </div>
                </div>

                {/* Modal */}
                <DetailModal isOpen={showModal} onClose={() => setShowModal(false)} node={node} currentUserReferralCode={currentUserReferralCode} />
            </div>

            {/* Lines and Children */}
            <div className="flex items-start justify-center pt-4 md:pt-8 relative">
                {/* Vertical Line from Parent to Branch Split */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-4 md:h-8 bg-gray-300"></div>

                {/* Left Child Wrapper */}
                <div className="relative flex flex-col items-center px-0.5 md:px-2">
                    {/* Horizontal Line connecting to center (Right Half of Top) */}
                    <div className="absolute top-0 right-0 w-1/2 h-px bg-gray-300"></div>
                    {/* Vertical line down to Child */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-4 md:h-8 bg-gray-300"></div>

                    <div className="mt-4 md:mt-8">
                        <ReferralTree node={node.left} currentUserReferralCode={currentUserReferralCode} />
                    </div>
                </div>

                {/* Right Child Wrapper */}
                <div className="relative flex flex-col items-center px-0.5 md:px-2">
                    {/* Horizontal Line connecting to center (Left Half of Top) */}
                    <div className="absolute top-0 left-0 w-1/2 h-px bg-gray-300"></div>
                    {/* Vertical line down to Child */}
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-px h-4 md:h-8 bg-gray-300"></div>

                    <div className="mt-4 md:mt-8">
                        <ReferralTree node={node.right} currentUserReferralCode={currentUserReferralCode} />
                    </div>
                </div>
            </div>
        </div>
    )
}
