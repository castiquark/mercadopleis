'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAccount, useReadContract, useWriteContract } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { Erc20Abi } from '@mercadopleis/contracts-abi';
import { CONTRACT_CONFIG } from '@mercadopleis/types';
import { 
  Droplet, 
  CheckCircle2, 
  Loader2, 
  ExternalLink, 
  ShieldCheck, 
  Wallet, 
  ArrowRight, 
  Plus, 
  Copy, 
  Check, 
  HelpCircle,
  Coins
} from 'lucide-react';

export default function FaucetPage() {
  const { address, isConnected, chainId } = useAccount();
  const [selectedAmount, setSelectedAmount] = useState<string>('1000');
  const [isMinting, setIsMinting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const usdcAddress = CONTRACT_CONFIG.USDC_BASE_SEPOLIA;
  const escrowAddress = '0x9E5b4C1112F026568233DC571Dd4120DbE9fBF48';

  const { data: balance, refetch: refetchBalance } = useReadContract({
    address: usdcAddress,
    abi: Erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
  });

  const { writeContractAsync } = useWriteContract();

  const handleMint = async () => {
    if (!address) return;
    try {
      setIsMinting(true);
      setErrorMessage(null);
      setSuccess(false);

      const parsedAmount = parseUnits(selectedAmount, 6);
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
      }, 2000);
      setTimeout(() => setSuccess(false), 5000);
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
        setErrorMessage(err?.shortMessage || err?.message || 'Error al procesar el reclamo de USDC');
      }
    } finally {
      setIsMinting(false);
    }

  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedToken(true);
    setTimeout(() => setCopiedToken(false), 2000);
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

  return (
    <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3.5 py-1.5 text-xs font-semibold text-cyan-300">
          <Droplet className="h-4 w-4 fill-cyan-400/20 text-cyan-400" />
          <span>Base Sepolia Testnet Faucet</span>
        </div>
        <h1 className="mt-4 text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          Obtén Test USDC para Probar mercadopleis
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-base text-slate-300">
          Mintea fondos de prueba en Base Sepolia para contratar servicios, interactuar con el smart contract de escrow y simular entregas y liberaciones sin dinero real.
        </p>
      </div>

      {/* Main Faucet Card */}
      <div className="mt-10 overflow-hidden rounded-2xl border border-cyan-500/30 bg-surface/90 p-8 shadow-2xl backdrop-blur-xl">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              Selecciona el monto a mintear
            </span>
            <div className="mt-3 flex flex-wrap gap-3">
              {['500', '1000', '2500', '5000'].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() => setSelectedAmount(amt)}
                  className={`rounded-xl px-4 py-2.5 text-sm font-bold transition ${
                    selectedAmount === amt
                      ? 'border border-cyan-400 bg-cyan-500/20 text-cyan-300 shadow-md shadow-cyan-500/20'
                      : 'border border-border bg-surface-elevated text-slate-300 hover:border-slate-500 hover:text-white'
                  }`}
                >
                  {Number(amt).toLocaleString()} USDC
                </button>
              ))}
            </div>
          </div>

          {/* Current balance */}
          <div className="rounded-xl border border-border bg-surface-elevated p-4 md:text-right">
            <span className="text-xs text-slate-400">Tu Balance de Test USDC:</span>
            <div className="mt-1 flex items-baseline gap-1 md:justify-end">
              <span className="text-2xl font-black text-white">
                {balance !== undefined
                  ? Number(formatUnits(balance, 6)).toLocaleString('en-US', { minimumFractionDigits: 2 })
                  : isConnected
                  ? '0.00'
                  : '—'}
              </span>
              <span className="text-xs font-bold text-cyan-400">USDC</span>
            </div>
          </div>
        </div>

        {/* Action Button */}
        <div className="mt-8 flex flex-col sm:flex-row gap-4">
          <button
            onClick={handleMint}
            disabled={!isConnected || isMinting}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 px-6 py-4 text-base font-bold text-white shadow-xl shadow-cyan-500/25 transition hover:brightness-110 active:scale-98 disabled:opacity-50"
          >
            {isMinting ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>Minteando {selectedAmount} USDC en Base Sepolia...</span>
              </>
            ) : success ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-emerald-300" />
                <span>¡{selectedAmount} USDC Acreditados con Éxito!</span>
              </>
            ) : (
              <>
                <Droplet className="h-5 w-5 fill-white/20" />
                <span>
                  {isConnected
                    ? `Mintear ${selectedAmount} Test USDC Ahora`
                    : 'Conecta tu Wallet para Mintear'}
                </span>
              </>
            )}
          </button>

          <button
            onClick={handleAddToWallet}
            type="button"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-elevated px-5 py-4 text-sm font-semibold text-slate-200 transition hover:bg-surface hover:text-white"
            title="Agregar token a MetaMask o Coinbase Wallet"
          >
            <Plus className="h-4 w-4 text-cyan-400" />
            <span>Agregar a Billetera</span>
          </button>
        </div>

        {errorMessage && (
          <div className="mt-4 rounded-xl border border-red-500/30 bg-red-950/40 p-4 text-xs text-red-300">
            {errorMessage}
          </div>
        )}
      </div>

      {/* Contract & Tech Details */}
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              MockUSDC Token Contract
            </span>
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/20">
              Verified BaseScan
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between font-mono text-xs text-slate-300">
            <span className="truncate pr-2">{usdcAddress}</span>
            <button
              onClick={() => handleCopy(usdcAddress)}
              className="text-slate-400 hover:text-white transition"
              title="Copiar dirección"
            >
              {copiedToken ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
          <a
            href={`https://sepolia.basescan.org/address/${usdcAddress}#code`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300"
          >
            <span>Ver código en BaseScan</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              MarketplaceEscrow Contract
            </span>
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/20">
              Verified BaseScan
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between font-mono text-xs text-slate-300">
            <span className="truncate pr-2">{escrowAddress}</span>
            <button
              onClick={() => handleCopy(escrowAddress)}
              className="text-slate-400 hover:text-white transition"
              title="Copiar dirección"
            >
              <Copy className="h-4 w-4" />
            </button>
          </div>
          <a
            href={`https://sepolia.basescan.org/address/${escrowAddress}#code`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300"
          >
            <span>Ver contrato en BaseScan</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>

      {/* Next Steps CTA */}
      <div className="mt-8 rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/10 via-surface to-background p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-white">¿Listo para probar el escrow?</h3>
            <p className="text-xs text-slate-300 mt-1">
              Explora los servicios disponibles, contrata a un freelancer y comprueba cómo los fondos quedan protegidos por el contrato inteligente.
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-primary/25 transition hover:bg-primary-hover active:scale-95"
          >
            <span>Explorar Catálogo</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
