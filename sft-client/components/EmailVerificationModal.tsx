import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Modal } from './Modal';
import { useUserStore } from '@/lib/store';
import { Mail, RefreshCw, CheckCircle, AlertTriangle } from 'lucide-react';
import { Spinner } from './Spinner';

interface EmailVerificationModalProps {
    isOpen: boolean;
    onClose: () => void;
    email?: string;
}

export const EmailVerificationModal: React.FC<EmailVerificationModalProps> = ({ isOpen, onClose, email }) => {
    const { user } = useUserStore();
    const targetEmail = email || user?.email;
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const [timer, setTimer] = useState(0);

    useEffect(() => {
        let interval: NodeJS.Timeout;
        if (timer > 0) {
            interval = setInterval(() => {
                setTimer((prev) => prev - 1);
            }, 1000);
        }
        return () => clearInterval(interval);
    }, [timer]);

    const handleSendVerification = async () => {
        if (!targetEmail) return;
        setIsLoading(true);
        setError('');
        setSuccess('');

        try {
            const apiBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
            await axios.post(`${apiBase}/auth/resend-verification`, { email: targetEmail });
            setSuccess('Verification email sent! Please check your inbox.');
            setTimer(60); // 1 minute cooldown
        } catch (err: any) {
            setError(err.response?.data?.message || 'Failed to send verification email');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Email Verification Required"
            footer={
                <button
                    onClick={onClose}
                    className="w-full px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg transition-colors"
                >
                    Close
                </button>
            }
        >
            <div className="flex flex-col items-center text-center p-2">
                <div className="w-16 h-16 bg-yellow-100 rounded-full flex items-center justify-center mb-6">
                    <AlertTriangle className="h-8 w-8 text-yellow-600" />
                </div>

                <h3 className="text-xl font-bold text-gray-800 mb-2">Verify Your Email</h3>
                <p className="text-gray-600 mb-6 max-w-sm">
                    Your email <span className="font-semibold text-gray-900">{targetEmail}</span> is not verified yet.
                    Please verify it to proceed with withdrawals.
                </p>

                {error && (
                    <div className="w-full bg-red-50 text-red-600 p-3 rounded-lg mb-4 text-sm flex items-center justify-center gap-2">
                        <AlertTriangle size={16} /> {error}
                    </div>
                )}

                {success && (
                    <div className="w-full bg-green-50 text-green-600 p-3 rounded-lg mb-4 text-sm flex items-center justify-center gap-2 animate-in fade-in">
                        <CheckCircle size={16} /> {success}
                    </div>
                )}

                <button
                    onClick={handleSendVerification}
                    disabled={isLoading || timer > 0}
                    className={`w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl font-bold text-white shadow-lg transition-all
                        ${timer > 0
                            ? 'bg-gray-400 cursor-not-allowed'
                            : 'bg-gradient-to-r from-primary to-accent hover:from-primary/90 hover:to-accent/90 transform hover:scale-[1.02]'
                        }`}
                >
                    {isLoading ? (
                        <Spinner size="sm" className="border-white/30 border-t-white" />
                    ) : timer > 0 ? (
                        <>
                            <RefreshCw size={18} className="animate-spin" /> Resend in {timer}s
                        </>
                    ) : (
                        <>
                            <Mail size={18} /> Send Verification Email
                        </>
                    )}
                </button>
            </div>
        </Modal>
    );
};
