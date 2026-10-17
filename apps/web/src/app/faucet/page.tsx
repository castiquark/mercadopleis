'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useAccount, usePublicClient, useReadContract, useWriteContract } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { Erc20Abi, ESCROW_ADDRESSES } from '@mercadopleis/contracts-abi';
import { CONTRACT_CONFIG } from '@mercadopleis/types';
import {
  Droplet,
  CheckCircle2,
  Loader2,
  ExternalLink,
  ArrowRight,
  Plus,
  Copy,
  Check,
} from 'lucide-react';
import { isUserRejection } from '../../lib/web3Errors';
import { useLanguage } from '@/lib/languageContext';

export default function FaucetPage() {
  const { address, isConnected, chainId } = useAccount();
  const { L } = useLanguage();
  const sepolia = CONTRACT_CONFIG.BASE_SEPOLIA_CHAIN_ID;
  const wrongNetwork = isConnected && chainId !== sepolia;
  const publicClient = usePublicClient({ chainId: sepolia });
  const [selectedAmount, setSelectedAmount] = useState<string>('1000');
  const [isMinting, setIsMinting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const usdcAddress = CONTRACT_CONFIG.USDC_BASE_SEPOLIA;
  const escrowAddress = ESCROW_ADDRESSES[CONTRACT_CONFIG.BASE_SEPOLIA_CHAIN_ID];

  const { data: balance, refetch: refetchBalance } = useReadContract({
    address: usdcAddress,
    abi: Erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    chainId: sepolia,
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
        chainId: sepolia,
      });

      // Only report success once the mint is mined.
      await publicClient?.waitForTransactionReceipt({ hash: tx });
      setSuccess(true);
      await refetchBalance();
      setTimeout(() => setSuccess(false), 5000);
    } catch (err: any) {
      if (isUserRejection(err)) {
        setErrorMessage(L('Reclamo cancelado en tu wallet.', 'Cancelled in your wallet.', 'Cancelado na sua carteira.'));
        setTimeout(() => setErrorMessage(null), 3000);
      } else {
        console.error('Error minting test USDC:', err);
        setErrorMessage(err?.shortMessage || err?.message || (L('Error al procesar el reclamo de USDC', 'Could not mint test USDC', 'Não foi possível gerar USDC de teste')));
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
          {L('Obtén USDC de prueba para probar mercadopleis', 'Get test USDC to try mercadopleis', 'Obtenha USDC de teste para experimentar a mercadopleis')}
        </h1>
        <p className="mx-auto mt-3 max-w-2xl text-base text-slate-300">
          {L('Crea fondos de prueba en Base Sepolia para contratar servicios, usar el contrato de escrow y probar entregas y liberaciones sin dinero real. Los tokens de prueba no tienen valor.', 'Mint test funds on Base Sepolia to hire services, use the escrow contract and try deliveries and releases without real money. Test tokens have no value.', 'Gere fundos de teste na Base Sepolia para contratar serviços, usar o contrato de escrow e testar entregas e liberações sem dinheiro real. Tokens de teste não têm valor.')}
        </p>
      </div>

      {/* Main Faucet Card */}
      <div className="mt-10 overflow-hidden rounded-2xl border border-cyan-500/30 bg-surface/90 p-8 shadow-2xl backdrop-blur-xl">
        <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
          <div>
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              {L('Elige el monto', 'Choose an amount', 'Escolha o valor')}
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
                  {Number(amt).toLocaleString(L('es-ES', 'en-US', 'pt-BR'))} USDC
                </button>
              ))}
            </div>
          </div>

          {/* Current balance */}
          <div className="rounded-xl border border-border bg-surface-elevated p-4 md:text-right">
            <span className="text-xs text-slate-400">{L('Tu saldo de USDC de prueba:', 'Your test USDC balance:', 'Seu saldo de USDC de teste:')}</span>
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
            disabled={!isConnected || wrongNetwork || isMinting}
            className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-cyan-500 via-blue-600 to-indigo-600 px-6 py-4 text-base font-bold text-white shadow-xl shadow-cyan-500/25 transition hover:brightness-110 active:scale-98 disabled:opacity-50"
          >
            {isMinting ? (
              <>
                <Loader2 className="h-5 w-5 animate-spin" />
                <span>{L(`Creando ${selectedAmount} USDC en Base Sepolia...`, `Minting ${selectedAmount} USDC on Base Sepolia...`, `Gerando ${selectedAmount} USDC na Base Sepolia...`)}</span>
              </>
            ) : success ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-emerald-300" />
                <span>{L(`¡${selectedAmount} USDC de prueba acreditados!`, `${selectedAmount} test USDC received`, `${selectedAmount} USDC de teste recebidos!`)}</span>
              </>
            ) : (
              <>
                <Droplet className="h-5 w-5 fill-white/20" />
                <span>
                  {!isConnected
                    ? (L('Conecta tu wallet para continuar', 'Connect your wallet to mint', 'Conecte sua carteira para continuar'))
                    : wrongNetwork
                    ? (L('Cambia tu wallet a Base Sepolia', 'Switch your wallet to Base Sepolia', 'Mude sua carteira para a Base Sepolia'))
                    : (L(`Obtener ${selectedAmount} USDC de prueba`, `Mint ${selectedAmount} test USDC`, `Obter ${selectedAmount} USDC de teste`))}
                </span>
              </>
            )}
          </button>

          <button
            onClick={handleAddToWallet}
            type="button"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-elevated px-5 py-4 text-sm font-semibold text-slate-200 transition hover:bg-surface hover:text-white"
            title={L('Agregar el token a tu wallet', 'Add the token to your wallet', 'Adicionar o token à sua carteira')}
          >
            <Plus className="h-4 w-4 text-cyan-400" />
            <span>{L('Agregar a la wallet', 'Add to wallet', 'Adicionar à carteira')}</span>
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
              {L('Token USDC de prueba', 'Test USDC token', 'Token USDC de teste')}
            </span>
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/20">
              {L('Verificado en BaseScan', 'Verified on BaseScan', 'Verificado no BaseScan')}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between font-mono text-xs text-slate-300">
            <span className="truncate pr-2">{usdcAddress}</span>
            <button
              onClick={() => handleCopy(usdcAddress)}
              className="-m-2.5 p-2.5 text-slate-400 hover:text-white transition"
              title={L('Copiar dirección', 'Copy address', 'Copiar endereço')}
              aria-label={L('Copiar dirección', 'Copy address', 'Copiar endereço')}
            >
              {copiedToken ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
            </button>
          </div>
          <a
            href={`https://sepolia.basescan.org/address/${usdcAddress}#code`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex min-h-10 items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 sm:min-h-0"
          >
            <span>{L('Ver código en BaseScan', 'View code on BaseScan', 'Ver código no BaseScan')}</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>

        <div className="rounded-xl border border-border bg-surface p-5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              {L('Contrato de escrow (Sepolia)', 'Escrow contract (Sepolia)', 'Contrato de escrow (Sepolia)')}
            </span>
            <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-[10px] font-bold text-emerald-400 border border-emerald-500/20">
              {L('Verificado en BaseScan', 'Verified on BaseScan', 'Verificado no BaseScan')}
            </span>
          </div>
          <div className="mt-2 flex items-center justify-between font-mono text-xs text-slate-300">
            <span className="truncate pr-2">{escrowAddress}</span>
            <button
              onClick={() => handleCopy(escrowAddress)}
              className="-m-2.5 p-2.5 text-slate-400 hover:text-white transition"
              title={L('Copiar dirección', 'Copy address', 'Copiar endereço')}
              aria-label={L('Copiar dirección', 'Copy address', 'Copiar endereço')}
            >
              <Copy className="h-4 w-4" />
            </button>
          </div>
          <a
            href={`https://sepolia.basescan.org/address/${escrowAddress}#code`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex min-h-10 items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 sm:min-h-0"
          >
            <span>{L('Ver contrato en BaseScan', 'View contract on BaseScan', 'Ver contrato no BaseScan')}</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>

      {/* Next Steps CTA */}
      <div className="mt-8 rounded-2xl border border-primary/30 bg-gradient-to-r from-primary/10 via-surface to-background p-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h3 className="text-base font-bold text-white">{L('¿Listo para probar el escrow?', 'Ready to try the escrow?', 'Pronto para testar o escrow?')}</h3>
            <p className="text-xs text-slate-300 mt-1">
              {L('Con tu wallet en Base Sepolia, contrata un servicio y comprueba cómo los fondos quedan en el contrato hasta la entrega.', 'With your wallet on Base Sepolia, hire a service and see how the funds stay in the smart contract until delivery.', 'Com sua carteira na Base Sepolia, contrate um serviço e veja como os fundos ficam no contrato até a entrega.')}
            </p>
          </div>
          <Link
            href="/"
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-primary/25 transition hover:bg-primary-hover active:scale-95"
          >
            <span>{L('Explorar servicios', 'Explore services', 'Explorar serviços')}</span>
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}
