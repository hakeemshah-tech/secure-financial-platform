'use client';

import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useUserStore } from '@/lib/store';
import { ReferralTree, TreeNodeData } from '@/components/ReferralTree'; // Import Shared Component
import { TreeViewer } from '@/components/TreeViewer';

export default function TreePage() {
    const [treeData, setTreeData] = useState<TreeNodeData | null>(null);
    const [loading, setLoading] = useState(true);
    const [viewDepth, setViewDepth] = useState(3); // Default view depth
    const [maxDepthAvailable, setMaxDepthAvailable] = useState(10); // Default, will update from API
    const router = useRouter();
    const { token, user } = useUserStore();

    // Auto-scale logic removed (handled by TreeViewer)

    // Auto-scale logic


    // Fetch Tree Data
    useEffect(() => {
        if (!token) return;

        const fetchTree = async () => {
            setLoading(true);
            try {
                const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
                const res = await axios.get(`${apiBase}/referrals/tree?depth=${viewDepth}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                // Ensure we handle plain object (reverted backend structure)
                setTreeData(res.data);
            } catch (error: any) {
                if (error.response?.status === 403 && error.response?.data?.message?.includes('blocked')) {
                    useUserStore.getState().logout();
                    router.push('/login');
                    return;
                }
                console.error("Error fetching tree:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchTree();
    }, [viewDepth, token, router]);

    // Separate effect for one-time fetches (Depth & Preference)
    useEffect(() => {
        if (!token) return;

        const fetchMaxDepth = async () => {
            try {
                const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
                const res = await axios.get(`${apiBase}/referrals/tree/depth`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                if (res.data && res.data.totalDepth) {
                    setMaxDepthAvailable(res.data.totalDepth);
                }
            } catch (error) {
                console.error("Error fetching max depth:", error);
            }
        };

        fetchMaxDepth();
    }, [token]);




    return (
        <div className="min-h-screen w-full text-foreground p-4 overflow-x-hidden flex flex-col">
            <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4">
                <h1 className="text-3xl font-bold text-primary">My Team</h1>
            </div>

            <div className="flex justify-end mb-4 relative z-20">
                <div className="flex items-center gap-2 bg-white/80 backdrop-blur p-2 rounded-lg shadow-sm border border-gray-100">
                    <label className="text-sm font-medium text-gray-700">View Levels:</label>
                    <select
                        value={viewDepth}
                        onChange={(e) => setViewDepth(Number(e.target.value))}
                        className="text-sm border-gray-300 rounded-md focus:ring-primary focus:border-primary bg-white px-2 py-1 outline-none border"
                    >
                        {Array.from({ length: maxDepthAvailable }, (_, i) => i + 1).map(level => (
                            <option key={level} value={level}>{level} Level{level > 1 ? 's' : ''}</option>
                        ))}
                    </select>
                </div>
            </div>

            {/* Tree Viewer Component */}
            <div className="flex-1 w-full bg-white rounded-xl shadow-sm">
                <TreeViewer
                    data={treeData}
                    currentUserReferralCode={user?.referralCode}
                    loading={loading}
                />
            </div>
        </div>
    );
}
