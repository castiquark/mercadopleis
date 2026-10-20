'use client';

import React from 'react';
import Link from '@/components/LocaleLink';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { useAccount } from 'wagmi';
import { useAuth } from '@/lib/authContext';
import { useLanguage } from '@/lib/languageContext';
import { PlusCircle, ShoppingBag, KeyRound, UserCheck, Scale, Droplet, ClipboardList } from 'lucide-react';
import { FaucetButton } from './FaucetButton';
import { LanguageSwitch } from './LanguageSwitch';
import { NetworkSwitch } from './NetworkSwitch';
import { NetworkBanner } from './NetworkBanner';
import { ActivityMenu } from './ActivityMenu';

export function Navbar() {
  const { isConnected, chainId } = useAccount();
  const { user, isAuthenticated, isAdmin, isLoading, signIn } = useAuth();
  const { t, L } = useLanguage();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand */}
        <div className="flex shrink-0 items-center gap-3 xl:gap-6">
          <Link href="/" aria-label="mercadopleis" className="flex shrink-0 items-center gap-2">
            {/* Same mark as the favicon (app/icon.svg) */}
            <svg viewBox="0 0 64 64" className="h-9 w-9 shrink-0 rounded-lg shadow-lg shadow-primary/30" aria-hidden="true">
              <rect width="64" height="64" rx="14" fill="#0052FF" />
              <path
                d="M17 45V31a7.5 7.5 0 0 1 15 0v14M32 31a7.5 7.5 0 0 1 15 0v14"
                fill="none"
                stroke="#fff"
                strokeWidth="6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span className="hidden text-base font-bold tracking-tight text-white xs:inline lg:text-xl">
              mercado<span className="text-primary-light">pleis</span>
            </span>
          </Link>

          <NetworkSwitch />
        </div>

        {/* Action Links & Connect Wallet */}
        <div className="flex shrink-0 items-center gap-1.5 sm:gap-3">
          <Link
            href="/services/new"
            className="hidden items-center gap-1.5 rounded-lg border border-border bg-surface p-3 xl:px-3.5 xl:py-2 text-sm font-medium text-slate-200 transition hover:bg-surface-elevated hover:text-white lg:flex"
            title={t('postService')}
            aria-label={t('postService')}
          >
            <PlusCircle className="h-4 w-4 text-primary-light" />
            <span className="hidden xl:inline">{t('postService')}</span>
          </Link>

          <Link
            href="/requests"
            className="hidden min-[360px]:flex items-center gap-1.5 rounded-lg border border-border bg-surface p-3 sm:px-3.5 sm:py-2 text-sm font-medium text-slate-200 transition hover:bg-surface-elevated hover:text-white"
            title={t('requests')}
            aria-label={t('requests')}
          >
            <ClipboardList className="h-4 w-4 text-slate-400" />
            <span className="hidden xl:inline">{t('requests')}</span>
          </Link>

          <Link
            href="/orders"
            className="flex items-center gap-1.5 rounded-lg border border-border bg-surface p-3 sm:px-3.5 sm:py-2 text-sm font-medium text-slate-200 transition hover:bg-surface-elevated hover:text-white"
            title={t('myOrders')}
            aria-label={t('myOrders')}
          >
            <ShoppingBag className="h-4 w-4 text-slate-400" />
            <span className="hidden xl:inline">{t('myOrders')}</span>
          </Link>

          {isAdmin && (
            <Link
              href="/admin/disputes"
              className="hidden items-center gap-1.5 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-300 transition hover:bg-amber-500/20 hover:text-white lg:flex"
              title={t('adminPanel')}
              aria-label={t('adminPanel')}
            >
              <Scale className="h-3.5 w-3.5 text-amber-400" />
              <span className="hidden 2xl:inline">{t('adminPanel')}</span>
            </Link>
          )}

          {/* Test-token faucet only while the wallet is on Base Sepolia (chainId 84532); real users never see it */}
          {chainId === 84532 && (
            <Link
              href="/faucet"
              className="hidden lg:flex items-center gap-1.5 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-xs font-semibold text-cyan-300 transition hover:bg-cyan-500/20 hover:border-cyan-400"
              title={t('faucet')}
              aria-label={t('faucet')}
            >
              <Droplet className="h-3.5 w-3.5 fill-cyan-400/20 text-cyan-400" />
              <span className="hidden 2xl:inline">{t('faucet')}</span>
            </Link>
          )}

          {/* Quick Faucet Mint Button if connected to Base Sepolia */}
          {isConnected && chainId === 84532 && (
            <div className="hidden 2xl:block">
              <FaucetButton variant="navbar" amount="1000" />
            </div>
          )}

          {/* What needs the signed-in user's attention */}
          <ActivityMenu />

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
              title={user.displayName || user.username}
              aria-label={user.displayName || user.username}
            >
              <UserCheck className="h-3.5 w-3.5" />
              <span className="hidden 2xl:inline">{user.displayName || user.username}</span>
            </Link>
          )}

          <div className="shrink-0">
            <ConnectButton
              label={L('Conectar', 'Connect', 'Conectar')}
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
      {/* Sticky with the header: always visible while the wallet is on a test or unsupported network */}
      <NetworkBanner />
    </header>
  );
}
