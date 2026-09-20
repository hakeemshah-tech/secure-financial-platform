'use client';

import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useUserStore } from '@/lib/store';
import { useRouter } from 'next/navigation';
import { Spinner } from '@/components/Spinner';
import { Modal } from '@/components/Modal';
import { Search, ChevronLeft, ChevronRight, Eye, ShieldAlert, Globe, Clock, User as UserIcon } from 'lucide-react';

export default function AuditLogsPage() {
    const { token, user, _hasHydrated, logout } = useUserStore();
    const router = useRouter();
    const [logs, setLogs] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [page, setPage] = useState(1);
    const [pages, setPages] = useState(1);
    const [total, setTotal] = useState(0);
    const [keyword, setKeyword] = useState(''); // Search keyword

    // Modal state
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedLog, setSelectedLog] = useState<any | null>(null);

    useEffect(() => {
        if (!_hasHydrated) return;

        if (!token || user?.role !== 'admin') {
            router.push('/login');
            return;
        }

        // Debounce search
        const timeoutId = setTimeout(() => {
            fetchLogs();
        }, 500);

        return () => clearTimeout(timeoutId);
    }, [token, user, _hasHydrated, page, keyword]);

    const fetchLogs = async () => {
        try {
            setIsLoading(true);
            const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
            const { data } = await axios.get(`${apiBase}/audit-logs?pageNumber=${page}&keyword=${keyword}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setLogs(data.logs);
            setPages(data.pages);
            setPage(data.page);
            setTotal(data.total);
        } catch (error: any) {
            console.error("Failed to fetch logs", error);
            if (error.response?.status === 401 || error.response?.status === 403) {
                logout();
                router.push('/login');
            }
        } finally {
            setIsLoading(false);
        }
    };

    const handleViewDetails = (log: any) => {
        setSelectedLog(log);
        setIsModalOpen(true);
    };

    const formatChanges = (changes: any) => {
        if (!changes || Object.keys(changes).length === 0) return "No specific changes recorded.";

        return (
            <div className="bg-gray-50 rounded-lg p-4 font-mono text-xs overflow-x-auto border border-gray-200">
                <table className="w-full text-left">
                    <thead>
                        <tr>
                            <th className="pb-2 text-gray-500">Field</th>
                            <th className="pb-2 text-red-500">Old Value</th>
                            <th className="pb-2 text-green-600">New Value</th>
                        </tr>
                    </thead>
                    <tbody>
                        {Object.entries(changes).map(([key, val]: [string, any]) => (
                            <tr key={key} className="border-t border-gray-100">
                                <td className="py-2 text-gray-700 font-bold pr-4">{key}</td>
                                <td className="py-2 text-gray-600 pr-4 break-all max-w-[150px]">{JSON.stringify(val.old)}</td>
                                <td className="py-2 text-gray-800 break-all max-w-[150px]">{JSON.stringify(val.new)}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        );
    };

    if (!_hasHydrated) return <div className="flex min-h-screen items-center justify-center"><Spinner size="lg" /></div>;

    return (
        <div className="space-y-6 animate-in fade-in duration-700 pb-20">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mt-4">
                <h1 className="text-3xl font-bold bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
                    Audit Logs
                </h1>

                <div className='flex items-center gap-4'>
                    {/* Search Input */}
                    <div className="relative">
                        <input
                            type="text"
                            placeholder="Search user or email..."
                            value={keyword}
                            onChange={(e) => {
                                setKeyword(e.target.value);
                                setPage(1); // Reset to page 1 on search
                            }}
                            className="pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary/20 w-64"
                        />
                        <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                    </div>

                    <div className="text-sm text-gray-500 bg-white px-3 py-1 rounded-full shadow-sm border border-gray-100">
                        Total Records: {total}
                    </div>
                </div>
            </div>

            {/* Logs Table */}
            <div className="bg-white backdrop-blur-xl border border-gray-200 rounded-2xl p-6 overflow-x-auto shadow-xl">
                {isLoading ? (
                    <div className="flex justify-center p-12"><Spinner size="lg" /></div>
                ) : (
                    <>
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="text-gray-500 text-sm font-medium border-b border-gray-100">
                                    <th className="p-4 whitespace-nowrap">Who (User)</th>
                                    <th className="p-4 whitespace-nowrap">Action</th>
                                    <th className="p-4 whitespace-nowrap">Details</th>
                                    <th className="p-4 whitespace-nowrap">When</th>
                                    <th className="p-4 whitespace-nowrap">Where (IP)</th>
                                    <th className="p-4 whitespace-nowrap">Changes</th>
                                </tr>
                            </thead>
                            <tbody className="text-sm">
                                {logs.length === 0 ? (
                                    <tr>
                                        <td colSpan={6} className="text-center p-8 text-gray-500">No logs found.</td>
                                    </tr>
                                ) : (
                                    logs.map((log) => (
                                        <tr key={log._id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                                            <td className="p-4">
                                                <div className="flex items-center gap-2">
                                                    <div className="p-1.5 bg-gray-100 rounded-full text-gray-500">
                                                        <UserIcon size={14} />
                                                    </div>
                                                    <div>
                                                        <div className="font-bold text-gray-900">{log.user?.username || 'Unknown'}</div>
                                                        <div className="text-xs text-gray-400">{log.user?.email || log.user?.role?.name || 'User'}</div>
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <span className={`px-2.5 py-1 rounded-full text-xs font-bold border ${log.action.includes('BLOCK') ? 'bg-red-50 text-red-600 border-red-100' :
                                                    log.action.includes('LOGIN') ? 'bg-blue-50 text-blue-600 border-blue-100' :
                                                        'bg-gray-100 text-gray-600 border-gray-200'
                                                    }`}>
                                                    {log.action}
                                                </span>
                                            </td>
                                            <td className="p-4 max-w-[200px]">
                                                <div className="truncate text-gray-600" title={log.details}>
                                                    {log.details}
                                                </div>
                                                <div className="text-xs text-gray-400 mt-1 flex items-center gap-1">
                                                    {log.resourceType && <span className="px-1.5 py-0.5 bg-gray-100 rounded border border-gray-200">{log.resourceType}</span>}
                                                </div>
                                            </td>
                                            <td className="p-4 text-gray-600 whitespace-nowrap">
                                                <div className="flex items-center gap-1.5">
                                                    <Clock size={14} className="text-gray-400" />
                                                    {new Date(log.createdAt).toLocaleDateString('en-GB')}
                                                    <span className="text-gray-400 text-xs">
                                                        {new Date(log.createdAt).toLocaleTimeString()}
                                                    </span>
                                                </div>
                                            </td>
                                            <td className="p-4 text-gray-600 font-mono text-xs">
                                                <div className="flex items-center gap-1.5">
                                                    <Globe size={14} className="text-gray-400" />
                                                    {log.ipAddress || 'N/A'}
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                {log.changes ? (
                                                    <button
                                                        onClick={() => handleViewDetails(log)}
                                                        className="p-2 bg-white border border-gray-200 rounded-lg text-gray-600 hover:text-primary hover:border-primary transition-colors shadow-sm"
                                                        title="View Changes"
                                                    >
                                                        <Eye size={16} />
                                                    </button>
                                                ) : (
                                                    <span className="text-gray-300">-</span>
                                                )}
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>

                        {/* Pagination */}
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

            {/* Change Details Modal */}
            <Modal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                title="Log Details"
                footer={
                    <button
                        onClick={() => setIsModalOpen(false)}
                        className="w-full px-4 py-2 bg-primary text-white rounded-xl font-medium shadow-md hover:bg-primary/90 transition-all"
                    >
                        Close
                    </button>
                }
            >
                <div className="p-4 space-y-4">
                    <div className="flex flex-col gap-1 pb-4 border-b border-gray-100">
                        <span className="text-xs font-bold text-gray-400 uppercase">Action</span>
                        <span className="text-lg font-bold text-gray-900">{selectedLog?.action}</span>
                    </div>

                    <div className="pb-4 border-b border-gray-100">
                        <span className="text-xs font-bold text-gray-400 uppercase block mb-1">Description</span>
                        <p className="text-gray-700 text-sm leading-relaxed">{selectedLog?.details}</p>
                    </div>

                    <div>
                        <span className="text-xs font-bold text-gray-400 uppercase block mb-2">Changes Recorded</span>
                        {selectedLog?.changes ? formatChanges(selectedLog.changes) : (
                            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 text-center text-gray-500 text-sm">
                                No specific field changes recorded.
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-xs text-gray-500 pt-2">
                        <div>
                            <span className="font-bold">Resource ID:</span> <span className="font-mono">{selectedLog?.resourceId || 'N/A'}</span>
                        </div>
                        <div className="text-right">
                            <span className="font-bold">Date:</span> {selectedLog && new Date(selectedLog.createdAt).toLocaleString()}
                        </div>
                    </div>
                </div>
            </Modal>
        </div>
    );
}
