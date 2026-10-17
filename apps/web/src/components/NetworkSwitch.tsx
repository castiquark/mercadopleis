'use client';

import React from 'react';
import { useAccount } from 'wagmi';
import { useChainModal } from '@rainbow-me/rainbowkit';
import { ShieldCheck, ChevronDown, AlertTriangle } from 'lucide-react';
import { useLanguage } from '@/lib/languageContext';
import { CONTRACT_CONFIG } from '@mercadopleis/types';

/**
 * Network selector for the header. The site follows the wallet's network, so this is the visible place to
 * see it and change it (opens the wallet's network picker). Disconnected visitors see Base Mainnet.
 */
export function NetworkSwitch() {
  const { isConnected, chainId } = useAccount();
  const { openChainModal } = useChainModal();
  const { L } = useLanguage();

  const isSepolia = chainId === CONTRACT_CONFIG.BASE_SEPOLIA_CHAIN_ID;
  const isMainnet = !isConnected || chainId === CONTRACT_CONFIG.BASE_MAINNET_CHAIN_ID;
  const unsupported = isConnected && !isSepolia && !isMainnet;

  const label = unsupported ? (L('Red no soportada', 'Wrong network', 'Rede não suportada')) : isSepolia ? 'Base Sepolia' : 'Base Mainnet';
  const title = isConnected
    ? L('Cambiar de red', 'Change network', 'Trocar de rede')
    : L('Los pagos se hacen en Base Mainnet', 'Payments run on Base Mainnet', 'Os pagamentos são feitos na Base Mainnet');

  const tone = unsupported
    ? 'border-red-500/40 bg-red-500/10 text-red-300'
    : isSepolia
      ? 'border-amber-500/40 bg-amber-500/10 text-amber-300'
      : 'border-border/80 bg-surface text-slate-300';

  const content = (
    <>
      {unsupported ? (
        <AlertTriangle className="h-3.5 w-3.5 text-red-400" />
      ) : (
        <ShieldCheck className={`h-3.5 w-3.5 ${isSepolia ? 'text-amber-400' : 'text-accent'}`} />
      )}
      {/* Full name on wide screens; a short tag in between so the header never overflows */}
      <span className="hidden xl:inline">{label}</span>
      <span className="xl:hidden">{unsupported ? '!' : isSepolia ? 'TEST' : 'Base'}</span>
      {isSepolia && (
        <span className="hidden rounded border border-amber-500/30 bg-amber-500/20 px-1 text-[10px] font-bold text-amber-300 xl:inline">
          TEST
        </span>
      )}
      {isConnected && openChainModal && <ChevronDown className="h-3 w-3 opacity-70" />}
    </>
  );

  const className = `hidden md:flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${tone}`;

  if (isConnected && openChainModal) {
    return (
      <button type="button" onClick={openChainModal} title={title} aria-label={`${label}. ${title}`} className={`${className} transition hover:brightness-125`}>
        {content}
      </button>
    );
  }
  return (
    <span title={title} className={className}>
      {content}
    </span>
  );
}
