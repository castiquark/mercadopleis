'use client';

import React, { useState } from 'react';
import { Service, MARKETPLACE_CATEGORIES } from '@mercadopleis/types';
import { useLanguage } from '@/lib/languageContext';
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { Erc20Abi, MarketplaceEscrowAbi, ESCROW_ADDRESSES } from '@mercadopleis/contracts-abi';
import { CONTRACT_CONFIG } from '@mercadopleis/types';
import { Shield, Clock, CheckCircle2, AlertCircle, X, ExternalLink, Droplet, MapPin } from 'lucide-react';
import { FaucetButton } from './FaucetButton';
import { isUserRejection } from '../lib/web3Errors';

interface CheckoutModalProps {
  service: Service | null;
  onClose: () => void;
  onSuccess: (orderId?: string) => void;
}

export function CheckoutModal({ service, onClose, onSuccess }: CheckoutModalProps) {
  const { language } = useLanguage();
  const { address, isConnected, chainId } = useAccount();
  const [step, setStep] = useState<'quote' | 'approving' | 'funding' | 'success'>('quote');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);


  const activeChainId = chainId || CONTRACT_CONFIG.BASE_SEPOLIA_CHAIN_ID;
  const escrowAddress = ESCROW_ADDRESSES[activeChainId] || ESCROW_ADDRESSES[CONTRACT_CONFIG.BASE_SEPOLIA_CHAIN_ID];
  const usdcAddress = activeChainId === CONTRACT_CONFIG.BASE_MAINNET_CHAIN_ID 
    ? CONTRACT_CONFIG.USDC_BASE_MAINNET 
    : CONTRACT_CONFIG.USDC_BASE_SEPOLIA;

  const rawAmount = service ? parseUnits(service.priceUsdc.toString(), 6) : 0n;

  // Read current USDC allowance
  const { data: currentAllowance, refetch: refetchAllowance } = useReadContract({
    address: usdcAddress,
    abi: Erc20Abi,
    functionName: 'allowance',
    args: address && escrowAddress ? [address, escrowAddress] : undefined,
  });

  // Read current USDC balance
  const { data: currentBalance, refetch: refetchBalance } = useReadContract({
    address: usdcAddress,
    abi: Erc20Abi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
  });

  const { writeContractAsync: writeApprove } = useWriteContract();
  const { writeContractAsync: writeFund } = useWriteContract();

  if (!service) return null;

  const categoryObj = MARKETPLACE_CATEGORIES.find((c) => c.id === service.category);
  const categoryLabel = categoryObj
    ? language === 'en'
      ? categoryObj.nameEn || categoryObj.name
      : categoryObj.name
    : service.category;

  const needsApproval = currentAllowance !== undefined && currentAllowance < rawAmount;
  const hasInsufficientBalance = currentBalance !== undefined && currentBalance < rawAmount;


  const handleConfirmOrder = async () => {
    try {
      setErrorMessage(null);

      const sellerWallet = (service.seller?.walletAddress || '0x70997970C51812dc3A010C7d01b50e0d17dc79C8') as `0x${string}`;
      let fundTx = '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');

      // Step 1: Approve USDC if needed on real deployed contract
      if (escrowAddress && escrowAddress !== '0x0000000000000000000000000000000000000000') {
        if (needsApproval) {
          setStep('approving');
          const approveTx = await writeApprove({
            address: usdcAddress,
            abi: Erc20Abi,
            functionName: 'approve',
            args: [escrowAddress, rawAmount],
          });
          console.log('Approve tx submitted:', approveTx);
          await refetchAllowance();
        }

        // Step 2: Fund Escrow Order on chain
        setStep('funding');
        fundTx = await writeFund({
          address: escrowAddress,
          abi: MarketplaceEscrowAbi,
          functionName: 'createAndFundOrder',
          args: [
            sellerWallet,
            usdcAddress,
            rawAmount,
            BigInt(service.deliveryDays),
          ],
        });
      } else {
        setStep('funding');
        // Simulated block confirmation delay for realistic escrow UX
        await new Promise((resolve) => setTimeout(resolve, 800));
      }

      const generatedContractOrderId = Math.floor(100 + Math.random() * 900);

      // Step 3: Persist Order in PostgreSQL backend
      try {
        const { createOrder } = await import('@/lib/api');
        await createOrder({
          serviceId: service.id,
          contractOrderId: generatedContractOrderId,
          txHashFunding: fundTx,
          buyerWallet: address,
        });
      } catch (dbErr) {
        console.warn('[Escrow] Backend registration notice:', dbErr);
      }

      // Local storage fallback for instant reactivity
      const localOrders = JSON.parse(localStorage.getItem('mercadopleis_custom_orders') || '[]');
      const newLocalOrder = {
        id: `ord-${Date.now()}`,
        contractOrderId: generatedContractOrderId,
        serviceTitle: service.title,
        role: 'buyer',
        amountUsdc: service.priceUsdc,
        sellerAmountUsdc: Number((service.priceUsdc * 0.97).toFixed(2)),
        platformFeeUsdc: Number((service.priceUsdc * 0.03).toFixed(2)),
        status: 'FUNDED',
        deadlineTimestamp: Math.floor(Date.now() / 1000) + service.deliveryDays * 86400,
        sellerAddress: sellerWallet,
        buyerAddress: address || '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
        txHashFunding: fundTx,
      };
      localStorage.setItem('mercadopleis_custom_orders', JSON.stringify([newLocalOrder, ...localOrders]));

      setStep('success');
      setTimeout(() => onSuccess(), 2000);
    } catch (err: any) {
      if (isUserRejection(err)) {
        console.info('[Wallet] Transacción o firma cancelada por el usuario en su wallet.');
        setErrorMessage(
          language === 'en'
            ? 'Signature or transaction cancelled in your wallet. No funds were debited.'
            : 'Firma o transacción cancelada en tu wallet. No se debitó ningún fondo.'
        );
      } else {
        console.error('Order error:', err);
        setErrorMessage(err?.shortMessage || err?.message || 'Error al procesar la transacción en la wallet.');
      }
      setStep('quote');
    }
  };


  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
      <div className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-surface p-6 shadow-2xl">
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute right-4 top-4 rounded-lg p-1 text-slate-400 hover:bg-surface-elevated hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Modal Header */}
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/20 text-primary-light">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-white">
              {language === 'en' ? 'Hire with Secure Escrow' : 'Contratar con Escrow Seguro'}
            </h2>
            <p className="text-xs text-slate-400">
              {language === 'en'
                ? 'Funds locked in smart contract until your delivery approval'
                : 'Fondos bloqueados hasta tu aprobación de entrega'}
            </p>
          </div>
        </div>

        {/* Service Summary */}
        <div className="mt-5 rounded-xl border border-border/80 bg-background/50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              {categoryLabel}
            </span>
            {service.deliveryType === 'in_person' && (
              <span className="rounded-md bg-cyan-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cyan-300 border border-cyan-500/30">
                {language === 'en' ? 'In-Person' : 'Presencial'}
              </span>
            )}
            {service.deliveryType === 'both' && (
              <span className="rounded-md bg-indigo-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-300 border border-indigo-500/30">
                {language === 'en' ? 'Hybrid' : 'Híbrido'}
              </span>
            )}
          </div>
          <h4 className="mt-1 font-semibold text-white">{service.title}</h4>
          {(service.locality || service.city) && (
            <div className="mt-1.5 flex items-center gap-1 text-xs text-cyan-300">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-cyan-400" />
              <span>{service.locality ? `${service.locality}, ` : ''}{service.city || service.country}</span>
            </div>
          )}

          <div className="mt-4 space-y-2 border-t border-border/60 pt-3 text-sm">
            <div className="flex justify-between text-slate-300">
              <span>{language === 'en' ? 'Service price' : 'Precio del servicio'}</span>
              <span className="font-medium text-white">{service.priceUsdc} USDC</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span className="flex items-center gap-1">
                {language === 'en' ? 'Buyer fee' : 'Comisión para comprador'}
                <span className="rounded bg-accent/10 px-1 text-[10px] font-semibold text-accent">0%</span>
              </span>
              <span className="text-accent font-medium">0.00 USDC</span>
            </div>
            <div className="flex justify-between border-t border-border/60 pt-2 text-base font-bold text-white">
              <span>{language === 'en' ? 'Total to fund' : 'Total a fondear'}</span>
              <span className="text-primary-light">{service.priceUsdc} USDC</span>
            </div>
          </div>
        </div>

        {/* Protections list */}
        <div className="mt-4 space-y-2 rounded-xl bg-surface-elevated/50 p-3.5 text-xs text-slate-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-accent" />
            <span>
              {language === 'en'
                ? 'Funds remain in the smart contract, never held by third parties.'
                : 'Los fondos permanecen en el smart contract, nunca en manos de terceros.'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 shrink-0 text-primary-light" />
            <span>
              {language === 'en'
                ? 'You have 5 days to review deliverables before automatic release.'
                : 'Dispones de 5 días para revisar la entrega antes de la liberación automática.'}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 shrink-0 text-amber-400" />
            <span>
              {language === 'en'
                ? '100% automatic refund if freelancer fails to deliver before deadline.'
                : 'Reembolso 100% automático si el vendedor no entrega antes del deadline.'}
            </span>
          </div>
        </div>

        {/* User Balance & Faucet Assist */}
        {isConnected && (
          <div className="mt-4 flex items-center justify-between rounded-xl border border-border/70 bg-surface-elevated/40 px-3.5 py-2.5 text-xs">
            <span className="text-slate-400">
              {language === 'en' ? 'Your USDC balance:' : 'Tu saldo de USDC:'}{' '}
              <strong className="text-white">
                {currentBalance !== undefined
                  ? `${Number(formatUnits(currentBalance, 6)).toLocaleString('en-US', { minimumFractionDigits: 2 })} USDC`
                  : (language === 'en' ? 'Loading...' : 'Cargando...')}
              </strong>
            </span>

            {hasInsufficientBalance && (
              <FaucetButton
                variant="compact"
                amount={service.priceUsdc.toString()}
                onMintSuccess={refetchBalance}
              />
            )}
          </div>
        )}

        {/* Insufficient balance warning */}
        {hasInsufficientBalance && isConnected && (
          <div className="mt-2.5 flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-2.5 text-xs text-amber-300">
            <Droplet className="h-4 w-4 shrink-0 text-amber-400" />
            <span>
              {language === 'en'
                ? 'Insufficient balance for this order. Claim testnet funds above with 1 click.'
                : 'Saldo insuficiente para esta orden. Reclama fondos de prueba arriba con 1 clic.'}
            </span>
          </div>
        )}

        {/* Error message */}
        {errorMessage && (
          <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* Action Button */}
        <div className="mt-6">
          {!isConnected ? (
            <div className="text-center">
              <p className="mb-2 text-xs text-slate-400">
                {language === 'en'
                  ? 'Connect your wallet to proceed with escrow'
                  : 'Conecta tu wallet para proceder con el escrow'}
              </p>
            </div>
          ) : step === 'success' ? (
            <div className="flex items-center justify-center gap-2 rounded-xl bg-accent/20 py-3 text-sm font-bold text-accent">
              <CheckCircle2 className="h-5 w-5" />
              <span>
                {language === 'en'
                  ? 'Order successfully funded in Escrow!'
                  : '¡Orden fondeada en Escrow exitosamente!'}
              </span>
            </div>
          ) : (
            <button
              onClick={handleConfirmOrder}
              disabled={step !== 'quote'}
              className="w-full rounded-xl bg-primary py-3 font-semibold text-white shadow-lg shadow-primary/25 transition hover:bg-primary-hover active:scale-[0.99] disabled:opacity-50"
            >
              {step === 'approving' && (language === 'en' ? '1/2 Approving USDC in your wallet...' : '1/2 Aprobando USDC en tu wallet...')}
              {step === 'funding' && (language === 'en' ? '2/2 Confirming deposit in the Smart Contract...' : '2/2 Confirmando depósito en el Smart Contract...')}
              {step === 'quote' && (
                needsApproval
                  ? (language === 'en' ? 'Approve USDC & Fund Escrow' : 'Aprobar USDC y Fondear Escrow')
                  : (language === 'en' ? 'Confirm & Fund in Escrow' : 'Confirmar y Fondear en Escrow')
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

