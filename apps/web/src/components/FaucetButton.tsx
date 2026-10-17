'use client';

import React, { useState } from 'react';
import { useAccount, usePublicClient, useWriteContract, useReadContract } from 'wagmi';
import { parseUnits } from 'viem';
import { Erc20Abi } from '@mercadopleis/contracts-abi';
import { CONTRACT_CONFIG } from '@mercadopleis/types';
import { Droplet, CheckCircle2, Loader2, Sparkles } from 'lucide-react';
import { isUserRejection } from '../lib/web3Errors';
import { useLanguage } from '@/lib/languageContext';

interface FaucetButtonProps {
  amount?: string;
  variant?: 'navbar' | 'compact';
  onMintSuccess?: () => void;
}

export function FaucetButton({ amount = '1000', variant = 'navbar', onMintSuccess }: FaucetButtonProps) {
  const { address, isConnected, chainId } = useAccount();
  const { L } = useLanguage();
  const [isMinting, setIsMinting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Test USDC only exists on Base Sepolia.
  const sepolia = CONTRACT_CONFIG.BASE_SEPOLIA_CHAIN_ID;
  const isTestnet = (chainId || sepolia) === sepolia;
  const usdcAddress = CONTRACT_CONFIG.USDC_BASE_SEPOLIA;
  const publicClient = usePublicClient({ chainId: sepolia });
  const formattedAmount = Number(amount).toLocaleString(L('es-ES', 'en-US', 'pt-BR'));

  const { refetch: refetchBalance } = useReadContract({
    address: usdcAddress,
    abi: Erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: sepolia,
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

      const tx = await writeContractAsync({
        address: usdcAddress,
        abi: Erc20Abi,
        functionName: 'mint',
        args: [address, parseUnits(amount, 6)],
        chainId: sepolia,
      });

      // Only report success once the mint is mined.
      await publicClient?.waitForTransactionReceipt({ hash: tx });
      setSuccess(true);
      await refetchBalance();
      onMintSuccess?.();
      setTimeout(() => setSuccess(false), 4000);
    } catch (err: any) {
      if (isUserRejection(err)) {
        setErrorMessage(L('Reclamo cancelado en tu wallet.', 'Cancelled in your wallet.', 'Cancelado na sua carteira.'));
        setTimeout(() => setErrorMessage(null), 3000);
      } else {
        console.error('Error minting test USDC:', err);
        setErrorMessage(err?.shortMessage || err?.message || (L('Error al reclamar USDC de prueba', 'Could not mint test USDC', 'Não foi possível gerar USDC de teste')));
        setTimeout(() => setErrorMessage(null), 5000);
      }
    } finally {
      setIsMinting(false);
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
          title={
            L(`Obtén ${formattedAmount} USDC de prueba en Base Sepolia para probar el marketplace`, `Mint ${formattedAmount} test USDC on Base Sepolia to try the marketplace`, `Obtenha ${formattedAmount} USDC de teste na Base Sepolia para experimentar o marketplace`)
          }
        >
          {isMinting ? (
            <>
              <Loader2 className="h-3.5 w-3.5 animate-spin text-cyan-300" />
              <span>{L('Creando...', 'Minting...', 'Gerando...')}</span>
            </>
          ) : success ? (
            <>
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              <span>+{formattedAmount} USDC</span>
            </>
          ) : (
            <>
              <Droplet className="h-3.5 w-3.5 text-cyan-400 fill-cyan-400/20" />
              <span>{L('Faucet USDC de prueba', 'Test USDC faucet', 'Faucet de USDC de teste')}</span>
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

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button
        onClick={handleMint}
        disabled={isMinting || !isConnected}
        className="inline-flex items-center gap-1 text-xs font-medium text-cyan-400 hover:text-cyan-300 underline underline-offset-2 transition"
      >
        {isMinting ? (
          <>
            <Loader2 className="h-3 w-3 animate-spin" />
            <span>{L(`Creando ${formattedAmount} USDC...`, `Minting ${formattedAmount} USDC...`, `Gerando ${formattedAmount} USDC...`)}</span>
          </>
        ) : success ? (
          <>
            <CheckCircle2 className="h-3 w-3 text-emerald-400" />
            <span>{L(`¡${formattedAmount} USDC de prueba acreditados!`, `${formattedAmount} test USDC received`, `${formattedAmount} USDC de teste recebidos!`)}</span>
          </>
        ) : (
          <>
            <Sparkles className="h-3 w-3" />
            <span>{L(`Obtener ${formattedAmount} USDC de prueba`, `Get ${formattedAmount} test USDC`, `Obter ${formattedAmount} USDC de teste`)}</span>
          </>
        )}
      </button>
      {errorMessage && <span className="text-[11px] text-red-400">{errorMessage}</span>}
    </span>
  );
}
