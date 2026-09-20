'use client';

import { useState, useEffect, useRef, use } from 'react';
import axios from 'axios';
import { useRouter } from 'next/navigation';
import { useUserStore } from '@/lib/store';
import { ReferralTree, TreeNodeData } from '@/components/ReferralTree';
import { TreeViewer } from '@/components/TreeViewer';
import { Spinner } from '@/components/Spinner';

export default function AdminUserTreePage({ params }: { params: Promise<{ id: string }> }) {
    const { id: userId } = use(params);
    const [treeData, setTreeData] = useState<TreeNodeData | null>(null);
    const [loading, setLoading] = useState(true);
    const router = useRouter();
    const { token, user, _hasHydrated } = useUserStore();

    useEffect(() => {
        if (!_hasHydrated) return;
        if (!token || user?.role !== 'admin') {
            router.push('/login');
            return;
        }

        const fetchTree = async () => {
            try {
                const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
                const res = await axios.get(`${apiBase}/referrals/admin/tree/${userId}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setTreeData(res.data);
            } catch (error: any) {
                console.error("Error fetching tree:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchTree();
    }, [token, userId, _hasHydrated, user]);

    // Auto-scale logic


    if (loading || !_hasHydrated) {
        return <div className="flex justify-center p-10"><Spinner size="lg" /></div>;
    }

    return (
        <div className="min-h-screen text-foreground p-4 overflow-hidden flex flex-col space-y-4">
            <div className="flex items-center gap-4">
                <button
                    onClick={() => router.back()}
                    className="p-2 rounded-xl bg-gray-100 hover:bg-gray-200 transition-colors"
                >
                    ← Back
                </button>
                <h1 className="text-2xl font-bold text-primary">User Referral Tree</h1>
            </div>

            {/* Tree Viewer Component */}
            <div className="flex-1 w-full bg-white rounded-xl shadow-sm border border-gray-200 min-h-[600px]">
                <TreeViewer
                    data={treeData}
                    // Admin view doesn't need a current user referral code for the tree perspective usually, 
                    // or it might use the admin's. For now we can pass undefined or the tree root's code if needed.
                    // But ReferralTree typically highlights "My Link". 
                    // In admin view, we probably just want to see the structure.
                    loading={loading}
                />
            </div>
        </div>
    );
}
