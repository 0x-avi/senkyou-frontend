'use client'

import { usePrivy } from '@privy-io/react-auth'
import { WalletActions } from '@/components/wallet/WalletActions'
import Link from 'next/link'
import { BookOpen } from 'lucide-react'

export function Header() {
    const { login, logout, ready, authenticated } = usePrivy()

    return (
        <header className="fixed top-0 left-0 right-0 z-50 border-b border-gray-200 bg-white/95 backdrop-blur-sm shadow-sm">
            <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-6">

                {/* Logo */}
                <Link href="/" className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-600">
                        <BookOpen className="h-4 w-4 text-white" />
                    </div>
                    <span className="text-lg font-bold text-gray-900 tracking-tight">Senkyou</span>
                </Link>

                {/* Nav */}
                <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-gray-500">
                    <Link href="/" className="hover:text-gray-900 transition-colors">Courses</Link>
                    <Link href="/" className="hover:text-gray-900 transition-colors">Library</Link>
                    <Link href="/" className="hover:text-gray-900 transition-colors">About</Link>
                </nav>

                {/* Auth */}
                <div className="flex items-center gap-3">
                    {authenticated ? (
                        <>
                            <WalletActions />
                            <button
                                onClick={logout}
                                className="text-sm font-medium text-gray-500 hover:text-gray-900 transition-colors"
                            >
                                Sign out
                            </button>
                        </>
                    ) : (
                        <button
                            onClick={login}
                            disabled={!ready}
                            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 transition-colors disabled:opacity-40"
                        >
                            Connect Wallet
                        </button>
                    )}
                </div>
            </div>
        </header>
    )
}