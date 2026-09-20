import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";


import ClientPageLayout from "@/components/ClientPageLayout";
import ClientFcmListener from "@/components/ClientFcmListener";
import AxiosProvider from "@/components/AxiosProvider";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Secure Financial Platform | Next Gen",
  description: "SFT Token is a next-generation decentralized platform offering secure, fast, and transparent blockchain utility ecosystems",
  icons: {
    icon: "/logo/sft_logo.png",
    shortcut: "/logo/sft_logo.png",
    apple: "/logo/sft_logo.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {

  return (
    <html lang="en" suppressHydrationWarning>
      <body
        suppressHydrationWarning
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground min-h-screen selection:bg-primary/30 selection:text-primary`}
      >
        <div className="fixed inset-0 -z-10 h-full w-full bg-background bg-[radial-gradient(#e5e7eb_1px,transparent_1px)] [background-size:16px_16px] [mask-image:radial-gradient(ellipse_50%_50%_at_50%_50%,#000_70%,transparent_100%)]"></div>
        <AxiosProvider>
          <ClientFcmListener />
          <ClientPageLayout>
            {children}
          </ClientPageLayout>
        </AxiosProvider>
      </body>
    </html>
  );
}
