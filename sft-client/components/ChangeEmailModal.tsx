import React, { useState } from 'react';
import { Modal } from '@/components/Modal';
import axios from 'axios';
import { useUserStore } from '@/lib/store';
import { Spinner } from '@/components/Spinner';

interface ChangeEmailModalProps {
    isOpen: boolean;
    onClose: () => void;
    currentEmail: string;
}

export const ChangeEmailModal: React.FC<ChangeEmailModalProps> = ({ isOpen, onClose, currentEmail }) => {
    const { token } = useUserStore();
    const [newEmail, setNewEmail] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (!newEmail) {
            setError('Please enter a new email address.');
            return;
        }

        if (newEmail === currentEmail) {
            setError('New email cannot be same as current email.');
            return;
        }

        setLoading(true);
        try {
            const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
            await axios.post(`${apiBase}/email-change/request`, {
                oldEmail: currentEmail,
                newEmail
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setSuccess('Your email change request has been sent to the admin. Once approved, you will receive a verification email within 24 hours. You can then verify your new email.');
            setNewEmail('');
            // removed auto close per user request
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to submit request.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Change Email Address"
        >
            <form onSubmit={handleSubmit} className="space-y-4">
                {success ? (
                    <div className="space-y-6">
                        <div className="bg-green-50 text-green-800 p-4 rounded-xl text-sm text-center border border-green-200">
                            <div className="mb-2 text-2xl">✅</div>
                            <p className="leading-relaxed font-medium">{success}</p>
                        </div>
                        <div className="flex justify-center">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-6 py-2 bg-gray-900 text-white rounded-lg hover:bg-black transition-colors font-medium shadow-lg hover:shadow-xl transform hover:-translate-y-0.5 active:translate-y-0"
                            >
                                Close
                            </button>
                        </div>
                    </div>
                ) : (
                    <>
                        {error && (
                            <div className="bg-red-100 text-red-700 p-3 rounded-lg text-sm">
                                {error}
                            </div>
                        )}

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Current Email</label>
                            <input
                                type="text"
                                value={currentEmail}
                                disabled
                                className="w-full bg-gray-100 border border-gray-300 rounded-lg p-3 text-gray-500 cursor-not-allowed"
                            />
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">New Email</label>
                            <input
                                type="email"
                                value={newEmail}
                                onChange={(e) => setNewEmail(e.target.value)}
                                placeholder="Enter new email address"
                                className="w-full border border-gray-300 rounded-lg p-3 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                                required
                            />
                        </div>

                        <div className="flex justify-end gap-3 mt-6">
                            <button
                                type="button"
                                onClick={onClose}
                                className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                                disabled={loading}
                            >
                                Cancel
                            </button>
                            <button
                                type="submit"
                                className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center min-w-[100px]"
                                disabled={loading}
                            >
                                {loading ? <Spinner size="sm" className="text-white" /> : 'Submit Request'}
                            </button>
                        </div>
                    </>
                )}
            </form>
        </Modal>
    );
};
