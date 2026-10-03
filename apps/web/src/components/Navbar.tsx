'use client';

import React from 'react';
import Link from 'next/link';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { useAuth } from '@/lib/authContext';
import { useLanguage } from '@/lib/languageContext';
import { ShieldCheck, PlusCircle, ShoppingBag, KeyRound, UserCheck, Scale, Droplet } from 'lucide-react';
import { FaucetButton } from './FaucetButton';
import { LanguageSwitch } from './LanguageSwitch';

export function Navbar() {
  const { isConnected, chainId } = useAccount();
  const { user, isAuthenticated, isAdmin, isLoading, signIn } = useAuth();
  const { t, language } = useLanguage();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand */}
        <div className="flex min-w-0 items-center gap-3 sm:gap-6">
          <Link href="/" aria-label="mercadopleis" className="flex shrink-0 items-center gap-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary font-bold text-white shadow-lg shadow-primary/30">
              M
            </div>
            <span className="hidden text-base font-bold tracking-tight text-white xs:inline sm:text-xl">
              mercado<span className="text-primary-light">pleis</span>
            </span>
          </Link>

          <div className="hidden items-center gap-1.5 rounded-full border border-border/80 bg-surface px-3 py-1 text-xs text-slate-300 md:flex">
            <ShieldCheck className="h-3.5 w-3.5 text-accent" />
            <span>
              {chainId === 84532
                ? 'Base Sepolia (Testnet)'
                : 'Base Mainnet'}
            </span>
            {chainId === 84532 && (
              <span className="rounded bg-amber-500/20 px-1.5 py-0.2 text-[10px] font-bold text-amber-300 border border-amber-500/30">
                TEST
              </span>
            )}
          </div>
        </div>

        {/* Action Links & Connect Wallet */}
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
          <Link
            href="/services/new"
            className="hidden items-center gap-1.5 rounded-lg border border-border bg-surface px-3.5 py-2 text-sm font-medium text-slate-200 transition hover:bg-surface-elevated hover:text-white sm:flex"
          >
            <PlusCircle className="h-4 w-4 text-primary-light" />
            <span>{t('postService')}</span>
          </Link>

          <Link
            href="/orders"
            className="flex items-center gap-1.5 rounded-lg border border-border bg-surface p-3 sm:px-3.5 sm:py-2 text-sm font-medium text-slate-200 transition hover:bg-surface-elevated hover:text-white"
            title={t('myOrders')}
            aria-label={t('myOrders')}
          >
            <ShoppingBag className="h-4 w-4 text-slate-400" />
            <span className="hidden sm:inline">{t('myOrders')}</span>
          </Link>

          {isAdmin && (
            <Link
              href="/admin/disputes"
              className="hidden items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 text-xs font-semibold text-amber-300 transition hover:bg-amber-500/20 hover:text-white lg:flex"
              title="Panel de Mediación de Disputas"
            >
              <Scale className="h-3.5 w-3.5 text-amber-400" />
              <span>{t('adminPanel')}</span>
            </Link>
          )}

          {/* Test-token faucet only while the wallet is on Base Sepolia (chainId 84532); real users never see it */}
          {chainId === 84532 && (
            <Link
              href="/faucet"
              className="hidden sm:flex items-center gap-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-300 transition hover:bg-cyan-500/20 hover:border-cyan-400"
              title="Faucet de Test USDC en Base Sepolia"
            >
              <Droplet className="h-3.5 w-3.5 fill-cyan-400/20 text-cyan-400" />
              <span className="hidden sm:inline">{t('faucet')}</span>
            </Link>
          )}

          {/* Quick Faucet Mint Button if connected to Base Sepolia */}
          {isConnected && chainId === 84532 && (
            <div className="hidden md:block">
              <FaucetButton variant="navbar" amount="1000" />
            </div>
          )}

          {/* Language Switcher */}
          <LanguageSwitch />

          {/* SIWE Authenticated user pill or Sign button */}
          {isConnected && !isAuthenticated && (
            <button
              onClick={() => signIn()}
              disabled={isLoading}
              aria-label={isLoading ? t('signing') : t('signSession')}
              title={t('signSession')}
              className="inline-flex items-center gap-1 rounded-lg bg-primary/20 border border-primary/40 px-3 sm:px-3 py-2.5 sm:py-2 text-[11px] sm:text-xs font-semibold text-primary-light transition hover:bg-primary/30 active:scale-95 animate-pulse"
            >
              <KeyRound className="h-3.5 w-3.5" />
              <span className="hidden xs:inline">{isLoading ? t('signing') : t('signSession')}</span>
            </button>
          )}

          {isConnected && isAuthenticated && user && (
            <Link
              href="/profile"
              className="hidden sm:flex items-center gap-1.5 rounded-lg border border-accent/30 bg-accent/10 px-3 py-2 text-xs font-semibold text-accent transition hover:bg-accent/20"
            >
              <UserCheck className="h-3.5 w-3.5" />
              <span>{user.displayName || user.username}</span>
            </Link>
          )}

          <div className="shrink-0">
            <ConnectButton
              label={language === 'en' ? 'Connect' : 'Conectar'}
              chainStatus="none"
              showBalance={false}
              accountStatus={{
                smallScreen: 'avatar',
                largeScreen: 'full',
              }}
            />
          </div>
        </div>
      </div>
    </header>
  );
}
