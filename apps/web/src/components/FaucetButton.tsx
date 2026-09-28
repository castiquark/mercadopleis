'use client';

import React, { useState } from 'react';
import { useAccount, useWriteContract, useReadContract } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { Erc20Abi } from '@mercadopleis/contracts-abi';
import { CONTRACT_CONFIG } from '@mercadopleis/types';
import { Droplet, CheckCircle2, Loader2, Sparkles, Plus } from 'lucide-react';

interface FaucetButtonProps {
  amount?: string;
  variant?: 'navbar' | 'compact' | 'full';
  onMintSuccess?: () => void;
}

export function FaucetButton({ amount = '1000', variant = 'navbar', onMintSuccess }: FaucetButtonProps) {
  const { address, isConnected, chainId } = useAccount();
  const [isMinting, setIsMinting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const activeChainId = chainId || CONTRACT_CONFIG.BASE_SEPOLIA_CHAIN_ID;
  const isTestnet = activeChainId === CONTRACT_CONFIG.BASE_SEPOLIA_CHAIN_ID;
  const usdcAddress = CONTRACT_CONFIG.USDC_BASE_SEPOLIA;

  const { data: balance, refetch: refetchBalance } = useReadContract({
    address: usdcAddress,
    abi: Erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
  });

  const { writeContractAsync } = useWriteContract();

  if (!isTestnet && !isConnected) {
    return null;
  }

  const handleMint = async () => {
    if (!address) return;
    try {
      setIsMinting(true);
      setErrorMessage(null);
      setSuccess(false);

      const parsedAmount = parseUnits(amount, 6);
      const tx = await writeContractAsync({
        address: usdcAddress,
        abi: Erc20Abi,
        functionName: 'mint',
        args: [address, parsedAmount],
      });

      console.log('Mint transaction submitted:', tx);
      setSuccess(true);
      setTimeout(async () => {
        await refetchBalance();
        if (onMintSuccess) onMintSuccess();
      }, 2000);

      setTimeout(() => setSuccess(false), 4000);
    } catch (err: any) {
      const isRejection =
        err?.name === 'UserRejectedRequestError' ||
        err?.code === 4001 ||
        err?.cause?.code === 4001 ||
        err?.message?.includes('User rejected') ||
        err?.message?.includes('User denied') ||
        err?.shortMessage?.includes('User rejected') ||
        err?.shortMessage?.includes('User denied');

      if (isRejection) {
        console.info('[Faucet] Reclamo cancelado por el usuario en su wallet.');
        setErrorMessage('Reclamo cancelado en tu wallet.');
        setTimeout(() => setErrorMessage(null), 3000);
      } else {
        console.error('Error minting test USDC:', err);
        setErrorMessage(err?.shortMessage || err?.message || 'Error al reclamar test USDC');
        setTimeout(() => setErrorMessage(null), 5000);
      }
    } finally {
      setIsMinting(false);
    }

  };

  const handleAddToWallet = async () => {
    if (typeof window === 'undefined' || !(window as any).ethereum) return;
    try {
      await (window as any).ethereum.request({
        method: 'wallet_watchAsset',
        params: {
          type: 'ERC20',
          options: {
            address: usdcAddress,
            symbol: 'USDC',
            decimals: 6,
            image: 'https://cryptologos.cc/logos/usd-coin-usdc-logo.png',
          },
        },
      });
    } catch (err) {
      console.warn('Could not add token to wallet:', err);
    }
  };

  if (variant === 'navbar') {
    return (
      <div className="relative flex items-center">
        <button
          onClick={handleMint}
          disabled={isMinting || !isConnected}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-semibold transition active:scale-95 ${
            success
              ? 'border-emerald-500/50 bg-emerald-500/20 text-emerald-300'
              : 'border-cyan-500/40 bg-cyan-500/10 text-cyan-300 hover:bg-cyan-500/20 hover:border-cyan-400'
          }`}
          title="Mintear 1,000 Test USDC en Base Sepolia para probar el marketplace"
        >
          {isMinting ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-300" />
              <span>Minteando...</span>
            </>
          ) : success ? (
            <>
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              <span>+1,000 USDC!</span>
            </>
          ) : (
            <>
              <Droplet className="h-3.5 w-3.5 text-cyan-400 fill-cyan-400/20" />
              <span>Faucet Test USDC</span>
            </>
          )}
        </button>

        {errorMessage && (
          <div className="absolute right-0 top-12 z-50 whitespace-nowrap rounded-lg border border-red-500/50 bg-slate-900 px-3 py-1.5 text-xs text-red-300 shadow-xl">
            {errorMessage}
          </div>
        )}
      </div>
    );
  }

  if (variant === 'compact') {
    return (
      <button
        onClick={handleMint}
        disabled={isMinting || !isConnected}
        className="inline-flex items-center gap-1 text-xs font-medium text-cyan-400 hover:text-cyan-300 underline underline-offset-2 transition"
      >
        {isMinting ? (
          <>
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>Minteando {amount} USDC...</span>
          </>
        ) : success ? (
          <>
            <CheckCircle2 className="h-3 w-3 text-emerald-400" />
            <span>¡{amount} USDC Acreditados!</span>
          </>
        ) : (
          <>
            <Sparkles className="h-3 w-3" />
            <span>Reclamar {amount} USDC de prueba</span>
          </>
        )}
      </button>
    );
  }

  // Full card variant (used in dedicated /faucet page or large modals)
  return (
    <div className="rounded-2xl border border-cyan-500/30 bg-gradient-to-b from-cyan-950/40 via-surface to-background p-6 shadow-2xl backdrop-blur-xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/20 border border-cyan-500/40 text-cyan-300 shadow-lg shadow-cyan-500/10">
            <Droplet className="h-6 w-6 fill-cyan-400/30" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-white">Faucet de Test USDC</h3>
            <p className="text-xs text-slate-400">Red: Base Sepolia Testnet (Chain ID 84532)</p>
          </div>
        </div>

        {balance !== undefined && (
          <div className="text-right">
            <span className="text-xs text-slate-400">Tu Saldo Actual:</span>
            <p className="text-sm font-bold text-cyan-300">
              {Number(formatUnits(balance, 6)).toLocaleString('en-US', { minimumFractionDigits: 2 })}{' '}
              <span className="text-xs text-slate-400">USDC</span>
            </p>
          </div>
        )}
      </div>

      <div className="mt-6 flex flex-col sm:flex-row gap-3">
        <button
          onClick={handleMint}
          disabled={isMinting || !isConnected}
          className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 to-blue-600 px-5 py-3 text-sm font-bold text-white shadow-lg shadow-cyan-500/25 transition hover:brightness-110 active:scale-98 disabled:opacity-50"
        >
          {isMinting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              <span>Minteando {amount} USDC...</span>
            </>
          ) : success ? (
            <>
              <CheckCircle2 className="h-4 w-4 text-emerald-300" />
              <span>¡Reclamados {amount} USDC con Éxito!</span>
            </>
          ) : (
            <>
              <Droplet className="h-4 w-4" />
              <span>Reclamar {amount} Test USDC Gratis</span>
            </>
          )}
        </button>

        <button
          onClick={handleAddToWallet}
          type="button"
          className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-border bg-surface px-4 py-3 text-xs font-semibold text-slate-300 transition hover:bg-surface-elevated hover:text-white"
          title="Agregar el token a tu MetaMask u otra billetera"
        >
          <Plus className="h-3.5 w-3.5 text-cyan-400" />
          <span>Agregar token a Billetera</span>
        </button>
      </div>

      {errorMessage && (
        <p className="mt-3 text-xs text-red-400 bg-red-950/40 border border-red-800/40 p-2 rounded-lg">
          {errorMessage}
        </p>
      )}
    </div>
  );
}
