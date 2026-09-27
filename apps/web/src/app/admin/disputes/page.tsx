'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAccount, useWriteContract } from 'wagmi';
import { parseUnits } from 'viem';
import { MarketplaceEscrowAbi, ESCROW_ADDRESSES, calculateOrderAmounts } from '@mercadopleis/contracts-abi';
import { CONTRACT_CONFIG } from '@mercadopleis/types';
import { fetchDisputes, resolveDisputeApi } from '@/lib/api';
import {
  Gavel,
  ShieldAlert,
  CheckCircle2,
  AlertTriangle,
  Scale,
  ArrowRight,
  RefreshCw,
  ExternalLink,
  Percent,
} from 'lucide-react';

interface DisputeItem {
  id: string;
  contractOrderId: number;
  orderId?: string;
  serviceTitle: string;
  grossAmountUsdc: number;
  reason: string;
  evidenceUrl?: string;
  buyerAddress: string;
  sellerAddress: string;
  status: 'OPEN' | 'RESOLVED';
  sellerAwardUsdc?: number;
  buyerRefundUsdc?: number;
  createdAt: string;
}

const DEMO_DISPUTES: DisputeItem[] = [
  {
    id: 'disp-demo-1',
    contractOrderId: 104,
    serviceTitle: 'Desarrollo de Smart Contract Escrow o ERC20 en Solidity',
    grossAmountUsdc: 250,
    reason: 'El entregable entregado tiene errores de compilación y no incluye los tests unitarios prometidos.',
    evidenceUrl: 'https://github.com/client-test/dispute-evidence-sample',
    buyerAddress: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
    sellerAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    status: 'OPEN',
    createdAt: '2026-09-27T14:30:00Z',
  },
  {
    id: 'disp-demo-2',
    contractOrderId: 102,
    serviceTitle: 'Diseño UI/UX de Landing Page Web3 en Figma',
    grossAmountUsdc: 180,
    reason: 'Faltó entregar el prototipo mobile responsivo y los componentes de diseño en Figma.',
    buyerAddress: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65',
    sellerAddress: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    status: 'RESOLVED',
    sellerAwardUsdc: 120,
    buyerRefundUsdc: 60,
    createdAt: '2026-09-25T11:15:00Z',
  },
];

export default function AdminDisputesPage() {
  const { address, isConnected, chainId } = useAccount();
  const [disputesList, setDisputesList] = useState<DisputeItem[]>(DEMO_DISPUTES);
  const [selectedDispute, setSelectedDispute] = useState<DisputeItem | null>(null);
  const [sellerSplitPct, setSellerSplitPct] = useState<number>(50); // percentage to seller (0 to 100)
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [notification, setNotification] = useState<string | null>(null);

  const activeChainId = chainId || CONTRACT_CONFIG.BASE_SEPOLIA_CHAIN_ID;
  const escrowAddress = ESCROW_ADDRESSES[activeChainId] || ESCROW_ADDRESSES[CONTRACT_CONFIG.BASE_SEPOLIA_CHAIN_ID];
  const { writeContractAsync } = useWriteContract();

  const ARBITRATOR_WALLET = '0xF6d48E6EFa40Ac16B2A71fa89c81D93da171cA00'.toLowerCase();
  const isArbitrator = address?.toLowerCase() === ARBITRATOR_WALLET;

  const loadData = async () => {
    try {
      const apiDisputes = await fetchDisputes();
      if (apiDisputes && apiDisputes.length > 0) {
        const mapped: DisputeItem[] = apiDisputes.map((d: any) => ({
          id: d.id,
          contractOrderId: d.order?.contractOrderId || 101,
          orderId: d.orderId,
          serviceTitle: d.order?.service?.title || 'Servicio de Marketplace',
          grossAmountUsdc: parseFloat(d.order?.grossAmountUsdc || '100'),
          reason: d.reason,
          evidenceUrl: d.evidenceUrl,
          buyerAddress: d.order?.buyer?.walletAddress || '0x...',
          sellerAddress: d.order?.seller?.walletAddress || '0x...',
          status: d.status,
          sellerAwardUsdc: d.sellerAwardUsdc ? parseFloat(d.sellerAwardUsdc) : undefined,
          buyerRefundUsdc: d.buyerRefundUsdc ? parseFloat(d.buyerRefundUsdc) : undefined,
          createdAt: d.createdAt,
        }));
        setDisputesList([...mapped, ...DEMO_DISPUTES.filter(d => !mapped.some(m => m.id === d.id))]);
      }
    } catch (e) {
      console.warn('Disputes fetch note:', e);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Compute breakdown for selected dispute
  const totalAmount = selectedDispute ? selectedDispute.grossAmountUsdc : 0;
  const sellerGross = Number(((totalAmount * sellerSplitPct) / 100).toFixed(2));
  const buyerRefund = Number((totalAmount - sellerGross).toFixed(2));
  // Platform fee 3% applies only to seller gross portion
  const { platformFeeUsdc, sellerAmountUsdc: sellerNetPayout } = calculateOrderAmounts(sellerGross, 300);

  const handleExecuteResolution = async () => {
    if (!selectedDispute) return;
    try {
      setIsProcessing(true);
      setNotification(`Ejecutando fallo arbitral para Orden #${selectedDispute.contractOrderId}...`);

      const sellerRaw = parseUnits(sellerGross.toString(), 6);
      const buyerRaw = parseUnits(buyerRefund.toString(), 6);

      // On-chain resolution if connected
      if (isConnected && escrowAddress && escrowAddress !== '0x0000000000000000000000000000000000000000') {
        await writeContractAsync({
          address: escrowAddress,
          abi: MarketplaceEscrowAbi,
          functionName: 'resolveDispute',
          args: [BigInt(selectedDispute.contractOrderId), sellerRaw, buyerRaw],
        });
      }

      // Backend API resolution
      try {
        await resolveDisputeApi(selectedDispute.id, {
          sellerAwardUsdc: sellerGross,
          buyerRefundUsdc: buyerRefund,
          resolutionNotes,
        });
      } catch (err) {
        console.warn('API resolve note:', err);
      }

      // Update state
      setDisputesList((prev) =>
        prev.map((d) =>
          d.id === selectedDispute.id
            ? {
                ...d,
                status: 'RESOLVED',
                sellerAwardUsdc: sellerGross,
                buyerRefundUsdc: buyerRefund,
              }
            : d
        )
      );

      setNotification(`¡Fallo arbitral emitido con éxito! ${sellerGross} USDC al prestador, ${buyerRefund} USDC reembolsados.`);
      setSelectedDispute(null);
    } catch (err: any) {
      console.error(err);
      setNotification(`Error: ${err?.shortMessage || err?.message || 'Error al ejecutar resolución'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <div className="flex items-center gap-2 text-primary-light">
            <Scale className="h-5 w-5" />
            <span className="text-xs font-semibold uppercase tracking-wider">Módulo de Gobernanza</span>
          </div>
          <h1 className="mt-1 text-3xl font-extrabold text-white">Panel de Arbitraje y Disputas</h1>
          <p className="mt-1 text-sm text-slate-400">
            Resolución justa y proporcional de conflictos entre compradores y prestadores en Base Sepolia.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => loadData()}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-surface-elevated hover:text-white"
          >
            <RefreshCw className="h-4 w-4 text-primary-light" />
            <span>Actualizar</span>
          </button>
          <Link
            href="/orders"
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-surface-elevated"
          >
            <span>Ver Órdenes</span>
            <ArrowRight className="h-4 w-4 text-primary-light" />
          </Link>
        </div>
      </div>

      {/* Contract & Role Banner */}
      <div className="mt-6 rounded-2xl border border-border bg-surface p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between text-xs">
          <div>
            <span className="text-slate-400">Smart Contract Escrow: </span>
            <a
              href={`https://sepolia.basescan.org/address/${escrowAddress}`}
              target="_blank"
              rel="noreferrer"
              className="font-mono text-primary-light hover:underline inline-flex items-center gap-1"
            >
              {escrowAddress}
              <ExternalLink className="h-3 w-3" />
            </a>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-slate-400">Tu Estado:</span>
            {isArbitrator ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/20 px-3 py-1 font-bold text-accent">
                <Gavel className="h-3.5 w-3.5" /> Árbitro Autorizado On-Chain
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-surface-elevated px-3 py-1 text-slate-400">
                Visualización (Solo el árbitro puede resolver)
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Notification banner */}
      {notification && (
        <div className="mt-6 flex items-center justify-between rounded-xl border border-primary/30 bg-primary/10 p-4 text-sm text-primary-light">
          <span>{notification}</span>
          <button
            onClick={() => setNotification(null)}
            className="text-xs font-semibold text-slate-400 hover:text-white"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* Disputes Grid */}
      <div className="mt-8 space-y-4">
        {disputesList.map((dispute) => (
          <div
            key={dispute.id}
            className="rounded-2xl border border-border bg-surface p-6 transition hover:border-slate-600"
          >
            <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
              <div className="max-w-2xl">
                <div className="flex items-center gap-3">
                  <span className="rounded bg-surface-elevated px-2 py-0.5 text-xs font-mono text-slate-300">
                    Smart Contract ID #{dispute.contractOrderId}
                  </span>

                  {dispute.status === 'OPEN' ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2.5 py-0.5 text-xs font-medium text-red-400">
                      <AlertTriangle className="h-3 w-3" /> Disputa Abierta
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-medium text-accent">
                      <CheckCircle2 className="h-3 w-3" /> Resuelta
                    </span>
                  )}
                </div>

                <h3 className="mt-2 text-lg font-bold text-white">{dispute.serviceTitle}</h3>

                {/* Reason description */}
                <div className="mt-3 rounded-xl border border-red-500/20 bg-red-500/5 p-3.5 text-xs text-red-200">
                  <strong className="block text-red-400 mb-1">Motivo del reclamo:</strong>
                  {dispute.reason}
                </div>

                {dispute.evidenceUrl && (
                  <div className="mt-2 text-xs text-slate-400">
                    <span>Pruebas aportadas: </span>
                    <a
                      href={dispute.evidenceUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-primary-light hover:underline inline-flex items-center gap-1"
                    >
                      {dispute.evidenceUrl}
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}

                {/* Wallets involved */}
                <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-400">
                  <span>Comprador: <code className="text-slate-300">{dispute.buyerAddress.slice(0, 10)}...</code></span>
                  <span>Prestador: <code className="text-slate-300">{dispute.sellerAddress.slice(0, 10)}...</code></span>
                </div>
              </div>

              {/* Amounts and Actions */}
              <div className="flex flex-col lg:items-end justify-between self-stretch">
                <div>
                  <div className="flex items-baseline gap-1 lg:justify-end">
                    <span className="text-2xl font-extrabold text-white">{dispute.grossAmountUsdc}</span>
                    <span className="text-xs font-semibold text-usdc">USDC en Escrow</span>
                  </div>
                  {dispute.status === 'RESOLVED' && (
                    <div className="mt-2 text-xs text-accent lg:text-right">
                      <p>Fallo: {dispute.sellerAwardUsdc} USDC prestador / {dispute.buyerRefundUsdc} USDC reembolso</p>
                    </div>
                  )}
                </div>

                {dispute.status === 'OPEN' && (
                  <button
                    onClick={() => {
                      setSelectedDispute(dispute);
                      setSellerSplitPct(50);
                    }}
                    className="mt-4 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-primary/20 transition hover:bg-primary-hover active:scale-95"
                  >
                    Evaluar y Emitir Fallo
                  </button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Resolution Modal */}
      {selectedDispute && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-xl rounded-2xl border border-border bg-surface p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border/80 pb-4">
              <div className="flex items-center gap-2 text-primary-light">
                <Gavel className="h-5 w-5" />
                <h3 className="text-lg font-bold text-white">Emitir Fallo Arbitral</h3>
              </div>
              <button
                onClick={() => setSelectedDispute(null)}
                className="text-xs text-slate-400 hover:text-white"
              >
                Cancelar
              </button>
            </div>

            <div className="mt-4 text-xs text-slate-300 space-y-1">
              <p><strong>Orden:</strong> #{selectedDispute.contractOrderId} - {selectedDispute.serviceTitle}</p>
              <p><strong>Monto total en disputa:</strong> <span className="font-bold text-white">{totalAmount} USDC</span></p>
            </div>

            {/* Presets */}
            <div className="mt-5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-400">
                División del Fondo
              </label>
              <div className="mt-2 grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setSellerSplitPct(100)}
                  className={`rounded-xl border p-2 text-xs font-semibold transition ${
                    sellerSplitPct === 100
                      ? 'border-accent bg-accent/20 text-accent'
                      : 'border-border text-slate-400 hover:bg-surface-elevated'
                  }`}
                >
                  100% Prestador
                </button>
                <button
                  type="button"
                  onClick={() => setSellerSplitPct(50)}
                  className={`rounded-xl border p-2 text-xs font-semibold transition ${
                    sellerSplitPct === 50
                      ? 'border-primary bg-primary/20 text-primary-light'
                      : 'border-border text-slate-400 hover:bg-surface-elevated'
                  }`}
                >
                  50% / 50% Mitad
                </button>
                <button
                  type="button"
                  onClick={() => setSellerSplitPct(0)}
                  className={`rounded-xl border p-2 text-xs font-semibold transition ${
                    sellerSplitPct === 0
                      ? 'border-amber-500 bg-amber-500/20 text-amber-400'
                      : 'border-border text-slate-400 hover:bg-surface-elevated'
                  }`}
                >
                  100% Reembolso
                </button>
              </div>
            </div>

            {/* Custom slider */}
            <div className="mt-5">
              <div className="flex justify-between text-xs text-slate-300">
                <span>Porcentaje para el prestador:</span>
                <span className="font-bold text-white">{sellerSplitPct}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                step="5"
                value={sellerSplitPct}
                onChange={(e) => setSellerSplitPct(parseInt(e.target.value, 10))}
                className="mt-2 w-full accent-primary cursor-pointer"
              />
            </div>

            {/* Mathematical distribution breakdown */}
            <div className="mt-5 space-y-2 rounded-xl border border-border/80 bg-background/50 p-4 text-xs">
              <div className="flex justify-between text-slate-300">
                <span>Adjudicación al Prestador (Bruto):</span>
                <span className="font-semibold text-white">{sellerGross} USDC</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Comisión de plataforma (3% sobre pago al prestador):</span>
                <span>-{platformFeeUsdc} USDC</span>
              </div>
              <div className="flex justify-between border-t border-border/60 pt-1 text-slate-300">
                <span>Neto que recibirá el prestador en wallet:</span>
                <span className="font-bold text-accent">{sellerNetPayout} USDC</span>
              </div>
              <div className="flex justify-between border-t border-border/60 pt-1 text-slate-300">
                <span>Reembolso directo al comprador (0% comisión):</span>
                <span className="font-bold text-amber-400">{buyerRefund} USDC</span>
              </div>
            </div>

            {/* Arbitrator notes */}
            <div className="mt-4">
              <label className="block text-xs font-semibold text-slate-400">
                Fundamentación del fallo arbitral
              </label>
              <textarea
                rows={2}
                placeholder="Explica brevemente los motivos de la decisión para constancia en la plataforma..."
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                className="mt-1.5 w-full rounded-xl border border-border bg-background p-3 text-xs text-white placeholder-slate-500 focus:border-primary focus:outline-none"
              />
            </div>

            {/* Confirm button */}
            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => setSelectedDispute(null)}
                className="flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold text-slate-400 hover:text-white"
              >
                Volver
              </button>
              <button
                type="button"
                onClick={handleExecuteResolution}
                disabled={isProcessing}
                className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary/20 transition hover:bg-primary-hover active:scale-95 disabled:opacity-50"
              >
                {isProcessing ? 'Firmando en Smart Contract...' : 'Ejecutar Fallo en Escrow'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
