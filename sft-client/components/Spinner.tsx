import React from 'react';

export const Spinner = ({ size = 'md', className = '', color }: { size?: 'sm' | 'md' | 'lg', className?: string, color?: string }) => {
    const sizeClasses = {
        sm: 'w-4 h-4',
        md: 'w-8 h-8',
        lg: 'w-12 h-12'
    };

    const colorClasses = color === 'white'
        ? 'border-white/20 border-t-white'
        : 'border-secondary border-t-primary';

    return (
        <div className={`flex justify-center items-center ${className}`}>
            <div className={`${sizeClasses[size]} border-4 ${colorClasses} rounded-full animate-spin`}></div>
        </div>
    );
};
