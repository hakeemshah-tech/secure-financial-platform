'use client';

import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useUserStore } from '@/lib/store';
import { useRouter } from 'next/navigation';
import { Spinner } from '@/components/Spinner';
import { CustomSelect } from '@/components/CustomSelect';
import { Modal } from '@/components/Modal'; // Import Modal
import { Search, Ban, CheckCircle, ChevronLeft, ChevronRight, Trash2, AlertTriangle, Eye, MoreVertical, PlusCircle } from 'lucide-react';
import { useRef } from 'react';

export default function UserManagementPage() {
    const { token, user, _hasHydrated, logout } = useUserStore();
    const router = useRouter();
    const [users, setUsers] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [pages, setPages] = useState(1);
    const [status, setStatus] = useState('all');
    const [keyword, setKeyword] = useState('');

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [showSuccessModal, setShowSuccessModal] = useState(false);
    const [selectedUser, setSelectedUser] = useState<{ id: string, name: string, isBlocked: boolean, walletAddress?: string } | null>(null);
    const [actionType, setActionType] = useState<'block' | 'unblock' | 'delete' | 'invest'>('block');

    // Wallet Modal State
    const [walletModalOpen, setWalletModalOpen] = useState(false);
    const [walletAddressInput, setWalletAddressInput] = useState('');

    // Investment Modal State
    const [investmentModalOpen, setInvestmentModalOpen] = useState(false);
    const [plans, setPlans] = useState<any[]>([]);
    const [selectedPlans, setSelectedPlans] = useState<string[]>([]);
    const [activeDropdown, setActiveDropdown] = useState<string | null>(null);

    // Dropdown ref for clicking outside
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Error Modal State
    const [errorModalOpen, setErrorModalOpen] = useState(false);
    const [errorMessage, setErrorMessage] = useState('');

    const filterOptions = [
        { value: 'all', label: 'All Users' },
        { value: 'active', label: 'Active Plan' },
        { value: 'inactive', label: 'Inactive' },
        { value: 'blocked', label: 'Blocked' },
        { value: 'unblocked', label: 'Unblocked' }
    ];

    useEffect(() => {
        if (!_hasHydrated) return;

        if (!token || user?.role !== 'admin') {
            router.push('/login');
            return;
        }

        fetchUsers();
        // Close dropdown when clicking outside
        function handleClickOutside(event: any) {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
                setActiveDropdown(null);
            }
        }
        document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [token, user, _hasHydrated, page, keyword, status]);

    const fetchUsers = async () => {
        try {
            setIsLoading(true);
            const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
            const { data } = await axios.get(`${apiBase}/users?page=${page}&keyword=${keyword}&status=${status}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setUsers(data.users);
            setPages(data.pages);
            setPage(data.page);
        } catch (error: any) {
            console.error("Failed to fetch users", error);
            if (error.response?.status === 401 || error.response?.status === 403) {
                // Although admin shouldn't be blocked typically, safety check
                if (error.response?.data?.message?.includes('blocked')) {
                    logout();
                    router.push('/login');
                }
            }
        } finally {
            setIsLoading(false);
        }
    };

    // Open modal for Block/Unblock
    const handleBlockClick = (user: any) => {
        setSelectedUser({ id: user._id, name: user.username, isBlocked: user.isBlocked });
        setActionType(user.isBlocked ? 'unblock' : 'block');
        setIsModalOpen(true);
    };

    // Open modal for Delete
    const handleDeleteClick = (user: any) => {
        setSelectedUser({ id: user._id, name: user.username, isBlocked: user.isBlocked });
        setActionType('delete');
        setIsModalOpen(true);
        setActiveDropdown(null);
    };

    // Open Investment Modal
    const handleInvestmentClick = async (user: any) => {
        setSelectedUser({ id: user._id, name: user.username, isBlocked: user.isBlocked, walletAddress: user.walletAddress });
        setActiveDropdown(null);
        openInvestmentModal(true); // Open and Reset
    };

    const openInvestmentModal = async (resetSelection = false) => {
        // Fetch plans if not already fetched
        if (plans.length === 0) {
            try {
                const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
                const { data } = await axios.get(`${apiBase}/plans`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setPlans(data);
            } catch (error) {
                console.error("Failed to fetch plans", error);
                setErrorMessage("Failed to load investment plans.");
                setErrorModalOpen(true);
                return;
            }
        }
        if (resetSelection) {
            setSelectedPlans([]); // Reset selection only if requested
        }
        setInvestmentModalOpen(true);
    }

    // Helper to open investment confirmation
    const openInvestmentConfirmation = () => {
        setActionType('invest');
        setIsModalOpen(true);
    };

    // Handle Wallet Save
    const handleWalletSave = async () => {
        if (!walletAddressInput.trim() || !selectedUser) {
            setErrorMessage("Please enter a wallet address.");
            setErrorModalOpen(true);
            return;
        }

        try {
            setIsLoading(true);
            const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
            await axios.patch(`${apiBase}/users/${selectedUser.id}/wallet`, {
                walletAddress: walletAddressInput
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            // Update local selected user
            setSelectedUser(prev => prev ? { ...prev, walletAddress: walletAddressInput } : null);

            // Update main users list (so verifying works next time without refresh)
            setUsers(prevUsers => prevUsers.map(u => u._id === selectedUser.id ? { ...u, walletAddress: walletAddressInput } : u));

            setWalletModalOpen(false);
            setIsLoading(false);

            // Proceed directly to Confirmation Modal
            openInvestmentConfirmation();

        } catch (error: any) {
            console.error("Failed to update wallet", error);
            setErrorMessage(error.response?.data?.message || "Failed to update wallet address");
            setErrorModalOpen(true);
            setIsLoading(false);
        }
    };

    const togglePlanSelection = (planId: string) => {
        setSelectedPlans(prev =>
            prev.includes(planId)
                ? prev.filter(id => id !== planId)
                : [...prev, planId]
        );
    };

    const handleAddInvestmentConfirm = () => {
        if (selectedPlans.length === 0) {
            setErrorMessage("Please select at least one plan.");
            setErrorModalOpen(true);
            return;
        }

        console.log('🔍 checking wallet for:', selectedUser);

        // Check for Wallet Address NOW (Before Final Confirmation)
        // Also treat "PENDING_" addresses as invalid (user needs to set a real one)
        if (!selectedUser?.walletAddress ||
            selectedUser.walletAddress.trim() === '' ||
            selectedUser.walletAddress.startsWith('PENDING_')) {

            console.log('⚠️ Invalid/Missing wallet address found! Opening Wallet Modal.');
            setInvestmentModalOpen(false); // Close Plan Selection

            // If it's a PENDING address, clear it so input is empty for admin to type new one
            // OR keep it so they see it? Better to clear it for the input field itself, or pre-fill?
            // User said "add here for that particular user account wallet address".
            // If I clear it, they have to type. 
            // setWalletAddressInput(selectedUser.walletAddress.startsWith('PENDING_') ? '' : selectedUser.walletAddress);
            // Actually the current logic sets input to '' on open: setWalletAddressInput('');
            // So just ensuring we enter this block is enough.

            setWalletAddressInput('');
            setWalletModalOpen(true); // Open Wallet Modal
            return;
        }

        console.log('✅ Wallet address exists:', selectedUser.walletAddress);
        setInvestmentModalOpen(false); // Close Plan Selection Modal
        openInvestmentConfirmation(); // Open Confirmation Modal
    };

    const confirmAction = async () => {
        if (!selectedUser) return;

        try {
            const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

            if (actionType === 'delete') {
                await axios.delete(`${apiBase}/users/${selectedUser.id}`, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setShowSuccessModal(true);
            } else if (actionType === 'invest') {
                await axios.post(`${apiBase}/investments/admin/add`, {
                    userId: selectedUser.id,
                    planIds: selectedPlans
                }, {
                    headers: { Authorization: `Bearer ${token}` }
                });
                setInvestmentModalOpen(false); // Close investment modal
                setShowSuccessModal(true);
            } else {
                await axios.patch(`${apiBase}/users/${selectedUser.id}/block`, {}, {
                    headers: { Authorization: `Bearer ${token}` }
                });
            }

            fetchUsers();
            setIsModalOpen(false);
        } catch (error: any) {
            console.error(error);
            setErrorMessage(error.response?.data?.message || 'Action failed');
            setErrorModalOpen(true);
        }
    };

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        setPage(1); // Reset to page 1 on search
        fetchUsers();
    };

    if (!_hasHydrated) return <div className="flex min-h-screen items-center justify-center"><Spinner size="lg" /></div>;

    // Helper for Modal Content
    const getModalContent = () => {
        if (actionType === 'delete') {
            return {
                title: 'Delete User',
                colorClass: 'bg-red-600 hover:bg-red-700 shadow-red-200',
                iconBg: 'bg-red-100 text-red-600',
                Icon: AlertTriangle, // Or Trash2
                confirmText: 'Yes, Delete',
                message: (
                    <>
                        Are you sure you want to <strong>PERMANENTLY DELETE</strong> user <span className="font-bold text-gray-900">{selectedUser?.name}</span>?
                        <br /><br />
                        <span className="text-red-500 text-sm font-bold">This action cannot be undone.</span>
                    </>
                ),
                subMessage: 'The user will be forcefully logged out immediately.'
            };
        } else if (actionType === 'unblock') {
            return {
                title: 'Unblock User',
                colorClass: 'bg-green-600 hover:bg-green-700 shadow-green-200',
                iconBg: 'bg-green-100 text-green-600',
                Icon: CheckCircle,
                confirmText: 'Yes, Unblock',
                message: (
                    <>Are you sure you want to unblock <span className="font-bold text-gray-900">{selectedUser?.name}</span>?</>
                ),
                subMessage: null
            };
        } else if (actionType === 'invest') {
            return {
                title: 'Confirm Investment Activation',
                colorClass: 'bg-blue-600 hover:bg-blue-700 shadow-blue-200',
                iconBg: 'bg-blue-100 text-blue-600',
                Icon: PlusCircle,
                confirmText: 'Yes, Activate Plans',
                message: (
                    <>
                        Are you sure you want to add <strong>{selectedPlans.length}</strong> investment plan(s) to <span className="font-bold text-gray-900">{selectedUser?.name}</span>?
                    </>
                ),
                subMessage: 'This will immediately activate the user account and distribute commissions.'
            };
        } else {
            return {
                title: 'Block User',
                colorClass: 'bg-red-600 hover:bg-red-700 shadow-red-200',
                iconBg: 'bg-red-100 text-red-600',
                Icon: Ban,
                confirmText: 'Yes, Block',
                message: (
                    <>Are you sure you want to block <span className="font-bold text-gray-900">{selectedUser?.name}</span>?</>
                ),
                subMessage: 'This user will be logged out immediately and prevented from logging back in.'
            };
        }
    };

    const modalContent = getModalContent();

    return (
        <div className="space-y-6 animate-in fade-in duration-700 pb-20">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mt-4">
                <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                    User Management
                </h1>
            </div>

            {/* Filters & Search - Added z-10 to ensure dropdown appears above table */}
            <div className="bg-white backdrop-blur-xl border border-gray-200 rounded-2xl p-6 shadow-sm relative z-10">
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-5 h-5" />
                        <input
                            type="text"
                            placeholder="Search by username, email, phone, wallet..."
                            className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
                            value={keyword}
                            onChange={(e) => {
                                setKeyword(e.target.value);
                                setPage(1); // Reset to first page on search
                            }}
                        />
                    </div>

                    <div className="w-full md:w-48">
                        <CustomSelect
                            options={filterOptions}
                            value={status}
                            onChange={(val: string) => {
                                setStatus(val);
                                setPage(1);
                            }}
                            className="w-full"
                            placeholder="Filter Status"
                        />
                    </div>
                </div>
            </div>

            {/* Users Table */}
            <div className="bg-white backdrop-blur-xl border border-gray-200 rounded-2xl p-6 overflow-x-auto shadow-xl">
                {isLoading ? (
                    <div className="flex justify-center p-12"><Spinner size="lg" /></div>
                ) : (
                    <>
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="text-gray-500 text-sm font-medium border-b border-gray-100">
                                    <th className="p-4 whitespace-nowrap">User Info</th>
                                    <th className="p-4 whitespace-nowrap">Contact</th>
                                    <th className="p-4 whitespace-nowrap">Wallet Address</th>
                                    <th className="p-4 whitespace-nowrap">Joined Date</th>
                                    <th className="p-4 whitespace-nowrap">Status</th>
                                    <th className="p-4 whitespace-nowrap">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm">
                                {users.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="text-center p-8 text-gray-500">No users found.</td>
                                    </tr>
                                ) : (
                                    users.map((u) => (
                                        <tr key={u._id} className={`border-b border-gray-100 hover:bg-gray-50 transition-colors ${u.isBlocked ? 'bg-red-50/50' : ''}`}>
                                            <td className="p-4">
                                                <div className="font-bold text-gray-900">{u.username || 'N/A'}</div>
                                                <div className="text-xs text-gray-400">{u.role?.name || 'User'}</div>
                                            </td>
                                            <td className="p-4">
                                                <div className="text-gray-700">{u.email || '-'}</div>
                                                <div className="text-xs text-gray-500">{u.phoneNumber || '-'}</div>
                                            </td>
                                            <td className="p-4 font-mono text-xs text-gray-600">
                                                {u.walletAddress}
                                            </td>
                                            <td className="p-4 text-gray-600">
                                                {new Date(u.createdAt).toLocaleDateString('en-GB')}
                                            </td>
                                            <td className="p-4">
                                                <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${u.isActive
                                                    ? 'bg-green-100 text-green-700 border-green-200'
                                                    : 'bg-red-100 text-red-700 border-red-200'}`}>
                                                    {u.isActive ? 'Active Plan' : 'Inactive'}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                <div className="flex items-center gap-2 relative">
                                                    {/* Existing Quick Actions */}
                                                    <a
                                                        href={`/admin/users/${u._id}`}
                                                        className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all shadow-sm bg-blue-100 text-blue-600 hover:bg-blue-200 border border-blue-200"
                                                        title="View User Details"
                                                    >
                                                        <Eye size={14} />
                                                    </a>

                                                    {/* 3-Dot Dropdown Trigger */}
                                                    <div className="relative">
                                                        <button
                                                            onClick={() => setActiveDropdown(activeDropdown === u._id ? null : u._id)}
                                                            className="p-1.5 rounded-full hover:bg-gray-100 text-gray-500 transition-colors"
                                                        >
                                                            <MoreVertical size={16} />
                                                        </button>

                                                        {/* Dropdown Menu */}
                                                        {activeDropdown === u._id && (
                                                            <div ref={dropdownRef} className="absolute right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-gray-100 z-50 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                                                <div className="p-1">
                                                                    <button
                                                                        onClick={() => handleInvestmentClick(u)}
                                                                        className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg flex items-center gap-2 transition-colors"
                                                                    >
                                                                        <PlusCircle size={14} className="text-blue-600" />
                                                                        Add Investment
                                                                    </button>
                                                                    <div className="h-px bg-gray-100 my-1"></div>
                                                                    <button
                                                                        onClick={() => handleBlockClick(u)}
                                                                        className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded-lg flex items-center gap-2 transition-colors"
                                                                    >
                                                                        {u.isBlocked ? <CheckCircle size={14} className="text-green-600" /> : <Ban size={14} className="text-yellow-600" />}
                                                                        {u.isBlocked ? 'Unblock User' : 'Block User'}
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleDeleteClick(u)}
                                                                        className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-2 transition-colors"
                                                                    >
                                                                        <Trash2 size={14} />
                                                                        Delete User
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>

                        {/* Pagination */}
                        {pages > 1 && (
                            <div className="flex justify-center items-center gap-2 mt-8">
                                <button
                                    onClick={() => setPage(p => Math.max(1, p - 1))}
                                    disabled={page === 1}
                                    className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-gray-500 transition-colors"
                                >
                                    <ChevronLeft size={20} />
                                </button>

                                <div className="flex items-center gap-1">
                                    {(() => {
                                        const range = [];

                                        if (pages <= 7) {
                                            for (let i = 1; i <= pages; i++) range.push(i);
                                        } else {
                                            if (page <= 4) {
                                                // 1 2 3 4 5 ... 48
                                                range.push(1, 2, 3, 4, 5, '...', pages);
                                            } else if (page >= pages - 3) {
                                                // 1 ... 44 45 46 47 48
                                                range.push(1, '...', pages - 4, pages - 3, pages - 2, pages - 1, pages);
                                            } else {
                                                // 1 ... 4 5 6 ... 48
                                                range.push(1, '...', page - 1, page, page + 1, '...', pages);
                                            }
                                        }

                                        return range.map((p, i) => (
                                            p === '...' ? (
                                                <span key={`dots-${i}`} className="w-8 text-center text-gray-400 font-medium tracking-widest">...</span>
                                            ) : (
                                                <button
                                                    key={p}
                                                    onClick={() => setPage(Number(p))}
                                                    className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold transition-all ${page === p
                                                        ? 'bg-gray-900 text-white shadow-lg shadow-gray-200 transform scale-105'
                                                        : 'text-gray-600 hover:bg-gray-100'
                                                        }`}
                                                >
                                                    {p}
                                                </button>
                                            )
                                        ));
                                    })()}
                                </div>

                                <button
                                    onClick={() => setPage(p => Math.min(pages, p + 1))}
                                    disabled={page === pages}
                                    className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed text-gray-500 transition-colors"
                                >
                                    <ChevronRight size={20} />
                                </button>
                            </div>
                        )}
                    </>
                )}
            </div>
            {/* Confirmation Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title={modalContent.title}
                footer={
                    <div className="flex gap-4 w-full">
                        <button
                            onClick={() => setIsModalOpen(false)}
                            className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-medium transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={confirmAction}
                            className={`flex-1 px-4 py-2 text-white rounded-xl font-medium shadow-md transition-all ${modalContent.colorClass}`}
                        >
                            {modalContent.confirmText}
                        </button>
                    </div>
                }
            >
                <div className="flex flex-col items-center text-center p-4">
                    <div className={`w-16 h-16 rounded-full flex items-center justify-center mb-4 ${modalContent.iconBg}`}>
                        <modalContent.Icon size={32} />
                    </div>
                    <p className="text-gray-600 text-lg">
                        {modalContent.message}
                    </p>
                    {modalContent.subMessage && (
                        <p className="text-sm text-gray-500 mt-2 bg-red-50 p-3 rounded-lg border border-red-100">
                            {modalContent.subMessage}
                        </p>
                    )}
                </div>
            </Modal>

            {/* Add Wallet Modal */}
            <Modal
                isOpen={walletModalOpen}
                onClose={() => setWalletModalOpen(false)}
                title="Add Wallet Address"
                footer={
                    <div className="flex gap-4 w-full">
                        <button
                            onClick={() => setWalletModalOpen(false)}
                            className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-medium transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleWalletSave}
                            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-xl font-medium shadow-md shadow-blue-200 hover:bg-blue-700 transition-all"
                        >
                            Save & Continue
                        </button>
                    </div>
                }
            >
                <div className="flex flex-col p-4">
                    <div className="mb-4 bg-yellow-50 text-yellow-800 p-3 rounded-lg text-sm border border-yellow-200 flex items-start gap-2">
                        <AlertTriangle size={16} className="mt-0.5 shrink-0" />
                        <span>User <strong>{selectedUser?.name}</strong> does not have a wallet address. Please add one to proceed with investment activation.</span>
                    </div>
                    <label className="text-sm font-medium text-gray-700 mb-2">Wallet Address (BEP20)</label>
                    <input
                        type="text"
                        value={walletAddressInput}
                        onChange={(e) => setWalletAddressInput(e.target.value)}
                        placeholder="0x..."
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100 transition-all font-mono"
                    />
                </div>
            </Modal>

            {/* Add Investment Selection Modal */}
            <Modal
                isOpen={investmentModalOpen}
                onClose={() => setInvestmentModalOpen(false)}
                title="Select Investment Plans"
                footer={
                    <div className="flex gap-4 w-full">
                        <button
                            onClick={() => setInvestmentModalOpen(false)}
                            className="flex-1 px-4 py-2 border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 font-medium transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={handleAddInvestmentConfirm}
                            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-xl font-medium shadow-md shadow-blue-200 hover:bg-blue-700 transition-all"
                            disabled={selectedPlans.length === 0}
                        >
                            Confirm Selection
                        </button>
                    </div>
                }
            >
                <div className="p-2 space-y-4">
                    <p className="text-sm text-gray-500 mb-4">Select one or more plans to activate for <span className="font-bold text-gray-900">{selectedUser?.name}</span>.</p>

                    <div className="max-h-[300px] overflow-y-auto space-y-2 pr-2">
                        {plans.length === 0 ? (
                            <p className="text-center text-gray-400 py-4">No plans available.</p>
                        ) : (
                            plans.map(plan => (
                                <div
                                    key={plan._id}
                                    onClick={() => togglePlanSelection(plan._id)}
                                    className={`p-4 rounded-xl border cursor-pointer transition-all flex items-center justify-between group ${selectedPlans.includes(plan._id)
                                        ? 'border-blue-500 bg-blue-50 shadow-sm'
                                        : 'border-gray-200 hover:border-blue-200 hover:bg-gray-50'
                                        }`}
                                >
                                    <div>
                                        <h3 className={`font-bold ${selectedPlans.includes(plan._id) ? 'text-blue-700' : 'text-gray-800'}`}>{plan.name}</h3>
                                        <div className="text-xs text-gray-500 mt-1 flex gap-3">
                                            <span>Price: <span className="font-semibold text-gray-700">{plan.minInvestmentSFT} SFT</span></span>
                                            <span>ROI: <span className="font-semibold text-green-600">{plan.roiPercent}%</span></span>
                                        </div>
                                    </div>
                                    <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${selectedPlans.includes(plan._id)
                                        ? 'border-blue-600 bg-blue-600 text-white'
                                        : 'border-gray-300 group-hover:border-blue-400'
                                        }`}>
                                        {selectedPlans.includes(plan._id) && <CheckCircle size={14} />}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </Modal>

            {/* Success Modal */}
            <Modal
                isOpen={showSuccessModal}
                onClose={() => setShowSuccessModal(false)}
                title="Success"
                footer={
                    <button
                        onClick={() => setShowSuccessModal(false)}
                        className="w-full px-4 py-2 bg-green-600 text-white rounded-xl font-medium shadow-md shadow-green-200 hover:bg-green-700 transition-all"
                    >
                        OK
                    </button>
                }
            >
                <div className="flex flex-col items-center text-center p-6">
                    <div className="w-16 h-16 rounded-full bg-green-100 text-green-600 flex items-center justify-center mb-4">
                        <CheckCircle size={32} />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Action Completed Successfully</h3>
                    <p className="text-gray-600">
                        {actionType === 'delete' ? 'The user account has been permanently removed.' :
                            actionType === 'invest' ? 'Investment plans have been activated for the user.' :
                                'The user status has been updated.'}
                    </p>
                </div>
            </Modal>

            {/* Error Modal */}
            <Modal
                isOpen={errorModalOpen}
                onClose={() => setErrorModalOpen(false)}
                title="Cannot Complete Action"
                footer={
                    <button
                        onClick={() => setErrorModalOpen(false)}
                        className="w-full px-4 py-2 bg-red-600 text-white rounded-xl font-medium shadow-md shadow-red-200 hover:bg-red-700 transition-all"
                    >
                        Close
                    </button>
                }
            >
                <div className="flex flex-col items-center text-center p-6">
                    <div className="w-16 h-16 rounded-full bg-red-100 text-red-600 flex items-center justify-center mb-4">
                        <AlertTriangle size={32} />
                    </div>
                    <h3 className="text-xl font-bold text-gray-900 mb-2">Error</h3>
                    <p className="text-gray-600">
                        {errorMessage}
                    </p>
                </div>
            </Modal>
        </div >
    );
}
