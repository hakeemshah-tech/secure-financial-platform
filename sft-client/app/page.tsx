'use client';

import React from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowDown } from 'lucide-react';

import Image from 'next/image';

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[calc(100vh-80px)] text-center space-y-8">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
        className="space-y-4 flex flex-col items-center"
      >
        <div className="relative w-32 h-32 mb-4 animate-pulse">
          <Image
            src="/logo/sft_logo.png"
            alt="SFT Logo"
            fill
            className="object-contain drop-shadow-[0_0_15px_rgba(212,175,55,0.5)]"
          />
        </div>
        <h1 className="text-6xl sm:text-7xl font-extrabold tracking-tight">
          <span className="block text-foreground">Future of Finance</span>
          <span className="block bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
            SFT TOKEN
          </span>
        </h1>
        <p className="max-w-2xl mx-auto text-xl text-muted">
          Invest in SFT Token on the BNB Smart Chain Network. Secure, fast, and high-yield returns with our binary referral system.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.3, duration: 0.5 }}
        className="flex flex-col sm:flex-row gap-4 items-center"
      >
        <Link href="/dashboard">
          <button className="bg-primary hover:bg-accent text-white font-bold py-4 px-8 rounded-full shadow-lg shadow-primary/30 transition-all transform hover:scale-105">
            Launch App
          </button>
        </Link>
        <Link href="/invest">
          <button className="bg-transparent border border-primary/20 hover:bg-primary/10 text-primary font-bold py-4 px-8 rounded-full backdrop-blur-md transition-all">
            View Plans
          </button>
        </Link>
        <a href="/platform-overview.pdf" download="platform-overview.pdf" target="_blank" rel="noopener noreferrer">
          <button className="flex items-center gap-2 bg-transparent border border-primary/20 hover:bg-primary/10 text-primary font-bold py-4 px-8 rounded-full backdrop-blur-md transition-all">
            Know more about SFT Token
            <ArrowDown className="w-5 h-5 animate-bounce" />
          </button>
        </a>
      </motion.div>

      <div className="pt-20 grid grid-cols-1 md:grid-cols-3 gap-8 text-left w-full max-w-5xl">
        {[
          { title: "BNB Smart Chain Network", desc: "Built on the speed and security of BNB Smart Chain Network." },
          { title: "High Yields", desc: "Earn guaranteed returns with our locked investment plans." },
          { title: "Binary Referrals", desc: "Earn passive income by growing your network 3 levels deep." }
        ].map((item, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.5 + (i * 0.1) }}
            className="bg-white/80 backdrop-blur border border-gray-200 p-6 rounded-2xl hover:bg-gray-50 hover:shadow-lg transition-all"
          >
            <h3 className="text-xl font-bold mb-2 text-foreground">{item.title}</h3>
            <p className="text-muted">{item.desc}</p>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
