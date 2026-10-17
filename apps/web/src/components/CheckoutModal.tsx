'use client';

import React, { useState } from 'react';
import { Service, MARKETPLACE_CATEGORIES, categoryLabel as categoryLabel_ } from '@mercadopleis/types';
import { useLanguage } from '@/lib/languageContext';
import { useAccount, useWriteContract, useReadContract, usePublicClient } from 'wagmi';
import { useChainModal } from '@rainbow-me/rainbowkit';
import { parseUnits, formatUnits, parseEventLogs } from 'viem';
import { Erc20Abi, MarketplaceEscrowAbi } from '@mercadopleis/contracts-abi';
import { Shield, Clock, CheckCircle2, AlertCircle, X, Droplet, MapPin, FlaskConical } from 'lucide-react';
import { FaucetButton } from './FaucetButton';
import { isUserRejection } from '../lib/web3Errors';
import { BUILDER_DATA_SUFFIX } from '@/lib/builderCode';
import { resolveNetwork } from '@/lib/networks';
import { addPendingOrder, withRetries } from '@/lib/pendingOrders';

interface CheckoutModalProps {
  service: Service | null;
  onClose: () => void;
  onSuccess: (orderId?: string) => void;
}

export function CheckoutModal({ service, onClose, onSuccess }: CheckoutModalProps) {
  const { language, L } = useLanguage();
  const { address, isConnected, chainId } = useAccount();
  const [step, setStep] = useState<'quote' | 'approving' | 'funding' | 'success'>('quote');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);


  const network = resolveNetwork(chainId);
  const sym = network.tokenSymbol;
  const { openChainModal } = useChainModal();
  const activeChainId = network.chainId;
  const escrowAddress = network.escrow;
  const usdcAddress = network.usdc;

  const rawAmount = service ? parseUnits(service.priceUsdc.toString(), network.tokenDecimals) : 0n;

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

  const publicClient = usePublicClient();
  const { writeContractAsync: writeApprove } = useWriteContract();
  const { writeContractAsync: writeFund } = useWriteContract();

  if (!service) return null;

  const categoryObj = MARKETPLACE_CATEGORIES.find((c) => c.id === service.category);
  const categoryLabel = categoryObj ? categoryLabel_(categoryObj, language) : service.category;

  const needsApproval = currentAllowance !== undefined && currentAllowance < rawAmount;
  const hasInsufficientBalance = currentBalance !== undefined && currentBalance < rawAmount;


  const handleConfirmOrder = async () => {
    try {
      setErrorMessage(null);

      if (!address || !isConnected) {
        throw new Error(
          L('Por favor conecta tu wallet Web3 para continuar.', 'Please connect your Web3 wallet to proceed.', 'Conecte sua carteira Web3 para continuar.')
        );
      }

      if (!network.supported || !escrowAddress || escrowAddress === '0x0000000000000000000000000000000000000000') {
        throw new Error(
          L('No hay contrato de escrow configurado para esta red. Por favor cambia a Base Mainnet o Base Sepolia.', 'No escrow contract configured for this network. Please switch to Base Mainnet or Base Sepolia.', 'Não há contrato de escrow configurado para esta rede. Mude para a Base Mainnet ou a Base Sepolia.')
        );
      }

      const sellerWallet = service.seller?.walletAddress as `0x${string}` | undefined;
      if (!sellerWallet || !sellerWallet.startsWith('0x') || sellerWallet.length !== 42) {
        throw new Error(
          L('La wallet del vendedor no está configurada o es inválida para este servicio.', 'Seller wallet is unavailable or invalid for this service.', 'A carteira do vendedor não está configurada ou é inválida para este serviço.')
        );
      }

      // Step 1: Approve USDC if needed on real deployed contract
      if (needsApproval) {
        setStep('approving');
        const approveTx = await writeApprove({
          address: usdcAddress,
          abi: Erc20Abi,
          functionName: 'approve',
          args: [escrowAddress, rawAmount],
        });
        console.log('[Escrow] Approve tx submitted:', approveTx);
        if (publicClient) {
          await publicClient.waitForTransactionReceipt({ hash: approveTx });
        }
        await refetchAllowance();
      }

      // Step 2: Fund Escrow Order on chain (No simulated fallback)
      setStep('funding');
      const fundTx = await writeFund({
        address: escrowAddress,
        abi: MarketplaceEscrowAbi,
        dataSuffix: BUILDER_DATA_SUFFIX,
        functionName: 'createAndFundOrder',
        args: [
          sellerWallet,
          usdcAddress,
          rawAmount,
          BigInt(service.deliveryDays),
        ],
      });
      console.log('[Escrow] Order funded tx submitted:', fundTx);

      // Step 3: Wait for transaction confirmation & parse authoritative OrderFunded event
      if (!publicClient) {
        throw new Error(
          L('Cliente de red no disponible para verificar el recibo de la transacción.', 'Network client unavailable to verify transaction receipt.', 'Cliente de rede indisponível para verificar o recibo da transação.')
        );
      }

      const receipt = await publicClient.waitForTransactionReceipt({ hash: fundTx });
      const logs = parseEventLogs({
        abi: MarketplaceEscrowAbi,
        logs: receipt.logs,
        eventName: 'OrderFunded',
      });

      if (!logs.length || logs[0].args?.orderId === undefined) {
        throw new Error(
          L('Transacción confirmada en Base, pero no se pudo decodificar el evento OrderFunded. Por favor revisa en BaseScan.', 'Transaction confirmed on Base, but could not decode OrderFunded event. Please check BaseScan.', 'Transação confirmada na Base, mas não foi possível decodificar o evento OrderFunded. Verifique no BaseScan.')
        );
      }

      const realContractOrderId = Number(logs[0].args.orderId);
      console.log(`[Escrow] Confirmed on-chain Order ID: ${realContractOrderId} (tx: ${fundTx})`);

      // Step 4: Register the on-chain order with the API (retried; if it still fails, My Orders keeps retrying).
      try {
        const { createOrder } = await import('@/lib/api');
        await withRetries(() =>
          createOrder({
            serviceId: service.id,
            contractOrderId: realContractOrderId,
            txHashFunding: fundTx,
            buyerWallet: address,
            chainId: activeChainId,
          })
        );
      } catch (dbErr) {
        console.warn('[Escrow] Registration pending (funds are safe on-chain):', dbErr);
        addPendingOrder({
          serviceId: service.id,
          serviceTitle: service.title,
          contractOrderId: realContractOrderId,
          txHashFunding: fundTx,
          chainId: activeChainId,
          buyerWallet: address || '',
          sellerWallet,
          amountUsdc: Number(service.priceUsdc),
          deliveryDays: service.deliveryDays,
          createdAt: Date.now(),
        });
      }

      setStep('success');
      setTimeout(() => onSuccess(realContractOrderId.toString()), 2000);
    } catch (err: any) {
      if (isUserRejection(err)) {
        setErrorMessage(
          L('Firma o transacción cancelada en tu wallet. No se debitó ningún fondo.', 'Signature or transaction cancelled in your wallet. No funds were debited.', 'Assinatura ou transação cancelada na sua carteira. Nenhum valor foi debitado.')
        );
      } else {
        console.error('Order error:', err);
        setErrorMessage(
          err?.shortMessage ||
            err?.message ||
            (L('Error al procesar la transacción en la wallet.', 'The transaction could not be processed in your wallet.', 'Não foi possível processar a transação na carteira.'))
        );
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
              {L('Contratar con Escrow Seguro', 'Hire with Secure Escrow', 'Contratar com Escrow Seguro')}
            </h2>
            <p className="text-xs text-slate-400">
              {L('Los fondos quedan bloqueados hasta que apruebes la entrega o termine el período de revisión', 'Funds stay locked in the smart contract until the delivery is approved or the review period ends', 'Os fundos ficam bloqueados até você aprovar a entrega ou terminar o período de revisão')}
            </p>
          </div>
        </div>

        {/* Network the payment will use. The catalog is shared by both networks, so say it before any signature
            and point to the network selector. */}
        {isConnected && (
          <div
            className={`mt-5 flex flex-wrap items-center justify-between gap-2 rounded-xl border p-3 text-xs ${
              !network.supported
                ? 'border-red-500/40 bg-red-500/10 text-red-200'
                : network.isTestnet
                  ? 'border-amber-500/40 bg-amber-500/10 text-amber-200'
                  : 'border-primary/30 bg-primary/10 text-slate-200'
            }`}
          >
            <span className="flex min-w-0 items-start gap-2">
              {network.isTestnet ? (
                <FlaskConical className="mt-0.5 h-4 w-4 shrink-0 text-amber-400" />
              ) : (
                <Shield className={`mt-0.5 h-4 w-4 shrink-0 ${network.supported ? 'text-primary-light' : 'text-red-400'}`} />
              )}
              <span>
                {!network.supported
                  ? L('Tu wallet está en una red no soportada. Cambia a Base Mainnet para pagar.', 'Your wallet is on an unsupported network. Switch to Base Mainnet to pay.', 'Sua carteira está em uma rede não suportada. Mude para a Base Mainnet para pagar.')
                  : network.isTestnet
                    ? L(`Modo prueba: pagarás en ${network.name} con ${sym} de prueba (sin valor real). No es una contratación real.`, `Test mode: you will pay on ${network.name} with test ${sym} (no real value). This is not a real hire.`, `Modo de teste: você vai pagar na ${network.name} com ${sym} de teste (sem valor real). Não é uma contratação real.`)
                    : L(`Pagarás en ${network.name} con ${sym} real.`, `You will pay on ${network.name} with real ${sym}.`, `Você vai pagar na ${network.name} com ${sym} real.`)}{' '}
                <span className="opacity-80">
                  {L('Revisa el selector de red junto a tu wallet antes de confirmar.', 'Check the network selector next to your wallet before confirming.', 'Confira o seletor de rede ao lado da sua carteira antes de confirmar.')}
                </span>
              </span>
            </span>
            {openChainModal && step === 'quote' && (
              <button
                type="button"
                onClick={openChainModal}
                className="shrink-0 rounded-lg border border-white/20 bg-black/20 px-2.5 py-1 font-semibold transition hover:bg-black/40"
              >
                {L('Cambiar red', 'Change network', 'Trocar rede')}
              </button>
            )}
          </div>
        )}

        {/* Service Summary */}
        <div className="mt-5 rounded-xl border border-border/80 bg-background/50 p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              {categoryLabel}
            </span>
            {service.deliveryType === 'in_person' && (
              <span className="rounded-md bg-cyan-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cyan-300 border border-cyan-500/30">
                {L('Presencial', 'In-Person', 'Presencial')}
              </span>
            )}
            {service.deliveryType === 'both' && (
              <span className="rounded-md bg-indigo-500/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-indigo-300 border border-indigo-500/30">
                {L('Híbrido', 'Hybrid', 'Híbrido')}
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
              <span>{L('Precio del servicio', 'Service price', 'Preço do serviço')}</span>
              <span className="font-medium text-white">{service.priceUsdc} {sym}</span>
            </div>
            <div className="flex justify-between text-slate-400">
              <span className="flex items-center gap-1">
                {L('Comisión para comprador', 'Buyer fee', 'Taxa para quem compra')}
                <span className="rounded bg-accent/10 px-1 text-[10px] font-semibold text-accent">0%</span>
              </span>
              <span className="text-accent font-medium">0.00 {sym}</span>
            </div>
            <div className="flex justify-between border-t border-border/60 pt-2 text-base font-bold text-white">
              <span>{L('Total a fondear', 'Total to fund', 'Total a depositar')}</span>
              <span className="text-primary-light">{service.priceUsdc} {sym}</span>
            </div>
          </div>
        </div>

        {/* Protections list */}
        <div className="mt-4 space-y-2 rounded-xl bg-surface-elevated/50 p-3.5 text-xs text-slate-300">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-accent" />
            <span>
              {L('Los fondos permanecen en el smart contract, nunca en manos de terceros.', 'Funds remain in the smart contract, never held by third parties.', 'Os fundos ficam no smart contract, nunca nas mãos de terceiros.')}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Clock className="h-4 w-4 shrink-0 text-primary-light" />
            <span>
              {L('Tienes 5 días desde la entrega para aprobarla o abrir una disputa. Después, el vendedor puede cobrar.', 'You have 5 days after delivery to approve it or open a dispute. After that, the seller can claim the payment.', 'Você tem 5 dias após a entrega para aprovar ou abrir uma disputa. Depois disso, o vendedor pode receber.')}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 shrink-0 text-amber-400" />
            <span>
              {L('Reembolso íntegro si el vendedor no entrega a tiempo: lo reclamas desde Mis Órdenes al vencer el plazo.', 'Full refund if the seller does not deliver on time: claim it from My Orders once the deadline passes.', 'Reembolso total se o vendedor não entregar a tempo: solicite em Meus Pedidos quando o prazo vencer.')}
            </span>
          </div>
        </div>

        {/* User Balance & Faucet Assist */}
        {isConnected && (
          <div className="mt-4 flex items-center justify-between rounded-xl border border-border/70 bg-surface-elevated/40 px-3.5 py-2.5 text-xs">
            <span className="text-slate-400">
              {L(`Tu saldo de ${sym}:`, `Your ${sym} balance:`, `Seu saldo de ${sym}:`)}{' '}
              <strong className="text-white">
                {currentBalance !== undefined
                  ? `${Number(formatUnits(currentBalance, network.tokenDecimals)).toLocaleString('en-US', { minimumFractionDigits: 2 })} ${sym}`
                  : (L('Cargando...', 'Loading...', 'Carregando...'))}
              </strong>
            </span>

            {hasInsufficientBalance && activeChainId === 84532 && (
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
              {activeChainId === 84532
                ? (L('Saldo insuficiente para esta orden. Reclama fondos de prueba arriba con 1 clic.', 'Insufficient balance for this order. Claim testnet funds above with 1 click.', 'Saldo insuficiente para este pedido. Obtenha fundos de teste acima com 1 clique.'))
                : (L(`Saldo insuficiente de ${sym} en ${network.name}. Por favor fondea tu wallet con ${sym}.`, `Insufficient ${sym} balance on ${network.name}. Please fund your wallet with ${sym}.`, `Saldo insuficiente de ${sym} na ${network.name}. Adicione ${sym} à sua carteira.`))}
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
                {L('Conecta tu wallet para proceder con el escrow', 'Connect your wallet to proceed with escrow', 'Conecte sua carteira para continuar com o escrow')}
              </p>
            </div>
          ) : step === 'success' ? (
            <div className="flex items-center justify-center gap-2 rounded-xl bg-accent/20 py-3 text-sm font-bold text-accent">
              <CheckCircle2 className="h-5 w-5" />
              <span>
                {L('¡Orden fondeada en Escrow exitosamente!', 'Order successfully funded in Escrow!', 'Pedido depositado no escrow com sucesso!')}
              </span>
            </div>
          ) : (
            <button
              onClick={handleConfirmOrder}
              disabled={step !== 'quote'}
              className="w-full rounded-xl bg-primary py-3 font-semibold text-white shadow-lg shadow-primary/25 transition hover:bg-primary-hover active:scale-[0.99] disabled:opacity-50"
            >
              {step === 'approving' && (L(`1/2 Aprobando ${sym} en tu wallet...`, `1/2 Approving ${sym} in your wallet...`, `1/2 Aprovando ${sym} na sua carteira...`))}
              {step === 'funding' && (L('2/2 Confirmando depósito en el Smart Contract...', '2/2 Confirming deposit in the Smart Contract...', '2/2 Confirmando depósito no Smart Contract...'))}
              {step === 'quote' && (
                needsApproval
                  ? (L(`Aprobar ${sym} y Fondear Escrow`, `Approve ${sym} & Fund Escrow`, `Aprovar ${sym} e Depositar no Escrow`))
                  : (L('Confirmar y Fondear en Escrow', 'Confirm & Fund in Escrow', 'Confirmar e Depositar no Escrow'))
              )}
            </button>
          )}

          <p className="mt-3 text-center text-[11px] leading-relaxed text-slate-500">
            {L('Al continuar aceptas los ', 'By continuing you accept the ', 'Ao continuar você aceita os ')}
            <a href="/terms" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-300">
              {L('Términos', 'Terms', 'Termos')}
            </a>
            {L(' y la ', ' and the ', ' e a ')}
            <a href="/privacy" target="_blank" rel="noopener noreferrer" className="underline hover:text-slate-300">
              {L('Política de Privacidad', 'Privacy Policy', 'Política de Privacidade')}
            </a>
            .
          </p>
        </div>
      </div>
    </div>
  );
}

