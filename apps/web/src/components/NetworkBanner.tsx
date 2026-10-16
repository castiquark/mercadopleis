'use client';

import React from 'react';
import { useAccount, useSwitchChain } from 'wagmi';
import { FlaskConical, AlertTriangle } from 'lucide-react';
import { useLanguage } from '@/lib/languageContext';
import { CONTRACT_CONFIG } from '@mercadopleis/types';

/**
 * Persistent strip under the header whenever the wallet is not on Base Mainnet. The catalog is the same on
 * both networks, so without it someone on Base Sepolia could think they are paying for real.
 */
export function NetworkBanner() {
  const { isConnected, chainId } = useAccount();
  const { switchChain, isPending } = useSwitchChain();
  const { language } = useLanguage();
  const en = language === 'en';

  if (!isConnected || chainId === CONTRACT_CONFIG.BASE_MAINNET_CHAIN_ID) return null;
  const isSepolia = chainId === CONTRACT_CONFIG.BASE_SEPOLIA_CHAIN_ID;

  return (
    <div
      role="status"
      className={`border-b ${isSepolia ? 'border-amber-500/30 bg-amber-500/10 text-amber-200' : 'border-red-500/30 bg-red-500/10 text-red-200'}`}
    >
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-x-4 gap-y-2 px-4 py-2 text-xs sm:px-6 lg:px-8">
        <span className="flex min-w-0 items-start gap-2">
          {isSepolia ? (
            <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
          ) : (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
          )}
          <span>
            {isSepolia ? (
              <>
                <strong>{en ? 'Test mode (Base Sepolia).' : 'Modo prueba (Base Sepolia).'}</strong>{' '}
                {en
                  ? 'Payments use test USDC with no real value and orders are test orders. To hire for real, switch your wallet to Base Mainnet.'
                  : 'Los pagos usan USDC de prueba sin valor real y las órdenes son de prueba. Para contratar de verdad, cambia tu wallet a Base Mainnet.'}
              </>
            ) : (
              <>
                <strong>{en ? 'Unsupported network.' : 'Red no soportada.'}</strong>{' '}
                {en ? 'Switch your wallet to Base Mainnet to pay or manage orders.' : 'Cambia tu wallet a Base Mainnet para pagar o gestionar órdenes.'}
              </>
            )}
          </span>
        </span>
        <button
          type="button"
          onClick={() => switchChain({ chainId: CONTRACT_CONFIG.BASE_MAINNET_CHAIN_ID })}
          disabled={isPending}
          className={`shrink-0 rounded-lg border bg-black/20 px-3 py-1.5 font-semibold transition hover:bg-black/40 disabled:opacity-50 ${
            isSepolia ? 'border-amber-500/40' : 'border-red-500/40'
          }`}
        >
          {isPending ? (en ? 'Check your wallet…' : 'Revisa tu wallet…') : en ? 'Switch to Base Mainnet' : 'Cambiar a Base Mainnet'}
        </button>
      </div>
    </div>
  );
}
