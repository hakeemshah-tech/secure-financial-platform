import React from 'react';
import { Users, Coins, ArrowUpRight, LayoutDashboard } from 'lucide-react';

interface AdminStats {
    totalUsers: number;
    totalInvested: number;
    pendingWithdrawalsCount: number;
    totalWithdrawn: number;
}

interface AdminStatsGridProps {
    stats: AdminStats;
}

export const AdminStatsGrid: React.FC<AdminStatsGridProps> = ({ stats }) => {
    return (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            <StatCard
                title="Total Users"
                value={stats.totalUsers.toString()}
                icon={<Users className="w-6 h-6 text-blue-500" />}
                color="bg-blue-500/10 border-blue-200"
            />
            <StatCard
                title="Total Invested"
                value={`${stats.totalInvested.toFixed(2)} SFT`}
                icon={<Coins className="w-6 h-6 text-amber-500" />}
                color="bg-amber-500/10 border-amber-200"
            />
            <StatCard
                title="Pending Withdrawals"
                value={stats.pendingWithdrawalsCount.toString()}
                icon={<ArrowUpRight className="w-6 h-6 text-orange-500" />}
                color="bg-orange-500/10 border-orange-200"
            />
            <StatCard
                title="Total Withdrawn"
                value={`${stats.totalWithdrawn.toFixed(2)} SFT`}
                icon={<LayoutDashboard className="w-6 h-6 text-green-500" />}
                color="bg-green-500/10 border-green-200"
            />
        </div>
    );
};

const StatCard = ({ title, value, icon, color }: { title: string, value: string, icon: React.ReactNode, color: string }) => {
    return (
        <div className={`p-6 rounded-2xl border backdrop-blur-sm ${color} transition-all hover:scale-[1.02] shadow-sm`}>
            <div className="flex justify-between items-start mb-4">
                <h3 className="text-muted-foreground text-sm font-medium">{title}</h3>
                <div className="p-2 bg-white/50 rounded-lg shadow-sm">
                    {icon}
                </div>
            </div>
            <div className="text-2xl font-bold text-foreground">
                {value}
            </div>
        </div>
    );
};
