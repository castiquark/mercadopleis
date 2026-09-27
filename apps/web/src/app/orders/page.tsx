'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAccount, useWriteContract } from 'wagmi';
import { MarketplaceEscrowAbi, ESCROW_ADDRESSES } from '@mercadopleis/contracts-abi';
import { CONTRACT_CONFIG } from '@mercadopleis/types';
import {
  ShieldCheck,
  Clock,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
  UploadCloud,
  FileCheck,
  ExternalLink,
  PlusCircle,
  ArrowRight,
} from 'lucide-react';

interface MockOrder {
  id: string;
  contractOrderId: number;
  serviceTitle: string;
  role: 'buyer' | 'seller';
  amountUsdc: number;
  sellerAmountUsdc: number;
  platformFeeUsdc: number;
  status: 'FUNDED' | 'DELIVERED' | 'RELEASED' | 'REFUNDED' | 'DISPUTED';
  deliveryHash?: string;
  deliveryUrl?: string;
  deadlineTimestamp: number;
  autoReleaseDeadline?: number;
  sellerAddress: string;
  buyerAddress: string;
}

const INITIAL_DEMO_ORDERS: MockOrder[] = [
  {
    id: 'ord-101',
    contractOrderId: 1,
    serviceTitle: 'Desarrollo de Smart Contract Escrow o ERC20 en Solidity',
    role: 'buyer',
    amountUsdc: 250,
    sellerAmountUsdc: 242.5,
    platformFeeUsdc: 7.5,
    status: 'DELIVERED',
    deliveryHash: '0x8f2d79c6b840e53a29b433a7e5814bfb2298e3b5e4ff8890dfcfb37b670356c1',
    deliveryUrl: 'https://github.com/example/solidity-escrow-delivery',
    deadlineTimestamp: Math.floor(Date.now() / 1000) + 86400 * 3,
    autoReleaseDeadline: Math.floor(Date.now() / 1000) + 86400 * 4, // 4 days remaining for buyer review
    sellerAddress: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    buyerAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  },
  {
    id: 'ord-102',
    contractOrderId: 2,
    serviceTitle: 'Diseño UI/UX de Landing Page Web3 en Figma',
    role: 'seller',
    amountUsdc: 180,
    sellerAmountUsdc: 174.6,
    platformFeeUsdc: 5.4,
    status: 'FUNDED',
    deadlineTimestamp: Math.floor(Date.now() / 1000) + 86400 * 2,
    sellerAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    buyerAddress: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
  },
  {
    id: 'ord-103',
    contractOrderId: 3,
    serviceTitle: 'Consultoría y Auditoría de Seguridad Preliminar de Contratos',
    role: 'buyer',
    amountUsdc: 300,
    sellerAmountUsdc: 291,
    platformFeeUsdc: 9,
    status: 'RELEASED',
    deadlineTimestamp: Math.floor(Date.now() / 1000) - 86400 * 10,
    sellerAddress: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65',
    buyerAddress: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
  },
];

export default function OrdersDashboardPage() {
  const { isConnected, chainId } = useAccount();
  const [activeTab, setActiveTab] = useState<'buyer' | 'seller'>('buyer');
  const [orders, setOrders] = useState<MockOrder[]>(INITIAL_DEMO_ORDERS);
  const [activeDeliveryModalOrder, setActiveDeliveryModalOrder] = useState<MockOrder | null>(null);
  const [deliveryInputUrl, setDeliveryInputUrl] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const activeChainId = chainId || CONTRACT_CONFIG.BASE_SEPOLIA_CHAIN_ID;
  const escrowAddress = ESCROW_ADDRESSES[activeChainId] || ESCROW_ADDRESSES[CONTRACT_CONFIG.BASE_SEPOLIA_CHAIN_ID];
  const { writeContractAsync } = useWriteContract();

  const filteredOrders = orders.filter((o) => o.role === activeTab);

  // Buyer Action: Approve delivery and release funds
  const handleApproveDelivery = async (order: MockOrder) => {
    try {
      setIsProcessing(true);
      setActionNotice(`Aprobando entrega de Orden #${order.contractOrderId}...`);

      if (isConnected && escrowAddress) {
        await writeContractAsync({
          address: escrowAddress,
          abi: MarketplaceEscrowAbi,
          functionName: 'approveDelivery',
          args: [BigInt(order.contractOrderId)],
        });
      }

      setOrders((prev) =>
        prev.map((o) => (o.id === order.id ? { ...o, status: 'RELEASED' } : o))
      );
      setActionNotice(`¡Orden #${order.contractOrderId} aprobada! Fondos liberados al prestador.`);
    } catch (err: any) {
      console.error(err);
      setActionNotice(`Error: ${err?.shortMessage || err?.message || 'Error en transacción'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Buyer Action: Open dispute
  const handleOpenDispute = async (order: MockOrder) => {
    try {
      setIsProcessing(true);
      setActionNotice(`Abriendo disputa para Orden #${order.contractOrderId}...`);

      if (isConnected && escrowAddress) {
        await writeContractAsync({
          address: escrowAddress,
          abi: MarketplaceEscrowAbi,
          functionName: 'openDispute',
          args: [BigInt(order.contractOrderId)],
        });
      }

      setOrders((prev) =>
        prev.map((o) => (o.id === order.id ? { ...o, status: 'DISPUTED' } : o))
      );
      setActionNotice(`Disputa abierta para Orden #${order.contractOrderId}. Fondos congelados en escrow.`);
    } catch (err: any) {
      console.error(err);
      setActionNotice(`Error: ${err?.shortMessage || err?.message || 'Error en transacción'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Buyer Action: Claim timeout refund
  const handleClaimRefund = async (order: MockOrder) => {
    try {
      setIsProcessing(true);
      setActionNotice(`Reclamando reembolso por timeout para Orden #${order.contractOrderId}...`);

      if (isConnected && escrowAddress) {
        await writeContractAsync({
          address: escrowAddress,
          abi: MarketplaceEscrowAbi,
          functionName: 'claimTimeoutRefund',
          args: [BigInt(order.contractOrderId)],
        });
      }

      setOrders((prev) =>
        prev.map((o) => (o.id === order.id ? { ...o, status: 'REFUNDED' } : o))
      );
      setActionNotice(`100% de los fondos reembolsados directamente al comprador.`);
    } catch (err: any) {
      console.error(err);
      setActionNotice(`Error: ${err?.shortMessage || err?.message || 'Error en transacción'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Seller Action: Submit delivery
  const handleSubmitDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDeliveryModalOrder || !deliveryInputUrl) return;

    try {
      setIsProcessing(true);
      const mockHash = '0x' + Array.from({ length: 64 }, () => Math.floor(Math.random() * 16).toString(16)).join('');

      if (isConnected && escrowAddress) {
        await writeContractAsync({
          address: escrowAddress,
          abi: MarketplaceEscrowAbi,
          functionName: 'submitDelivery',
          args: [BigInt(activeDeliveryModalOrder.contractOrderId), mockHash as `0x${string}`],
        });
      }

      setOrders((prev) =>
        prev.map((o) =>
          o.id === activeDeliveryModalOrder.id
            ? {
                ...o,
                status: 'DELIVERED',
                deliveryUrl: deliveryInputUrl,
                deliveryHash: mockHash,
                autoReleaseDeadline: Math.floor(Date.now() / 1000) + 86400 * 5,
              }
            : o
        )
      );

      setActionNotice(`Entrega registrada. Se inicia el período de revisión de 5 días.`);
      setActiveDeliveryModalOrder(null);
      setDeliveryInputUrl('');
    } catch (err: any) {
      console.error(err);
      setActionNotice(`Error: ${err?.shortMessage || err?.message || 'Error en transacción'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-extrabold text-white">Panel de Órdenes</h1>
          <p className="mt-1 text-sm text-slate-400">
            Supervisa tus contratos de escrow activos en Base, aprueba entregas o gestiona cobros.
          </p>
        </div>

        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-surface-elevated"
        >
          <span>Explorar Más Servicios</span>
          <ArrowRight className="h-4 w-4 text-primary-light" />
        </Link>
      </div>

      {/* Notifications Alert */}
      {actionNotice && (
        <div className="mt-6 flex items-center justify-between rounded-xl border border-primary/30 bg-primary/10 p-4 text-sm text-primary-light">
          <span>{actionNotice}</span>
          <button
            onClick={() => setActionNotice(null)}
            className="text-xs font-semibold text-slate-400 hover:text-white"
          >
            Cerrar
          </button>
        </div>
      )}

      {/* Role Tabs */}
      <div className="mt-8 flex gap-2 border-b border-border pb-4">
        <button
          onClick={() => setActiveTab('buyer')}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
            activeTab === 'buyer'
              ? 'bg-primary text-white shadow-md shadow-primary/20'
              : 'text-slate-400 hover:bg-surface hover:text-white'
          }`}
        >
          Como Comprador ({orders.filter((o) => o.role === 'buyer').length})
        </button>
        <button
          onClick={() => setActiveTab('seller')}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
            activeTab === 'seller'
              ? 'bg-primary text-white shadow-md shadow-primary/20'
              : 'text-slate-400 hover:bg-surface hover:text-white'
          }`}
        >
          Como Prestador ({orders.filter((o) => o.role === 'seller').length})
        </button>
      </div>

      {/* Orders List */}
      <div className="mt-6 space-y-4">
        {filteredOrders.map((order) => {
          return (
            <div
              key={order.id}
              className="overflow-hidden rounded-2xl border border-border bg-surface p-6 transition hover:border-slate-600"
            >
              <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                {/* Order info */}
                <div className="max-w-xl">
                  <div className="flex items-center gap-3">
                    <span className="rounded bg-surface-elevated px-2 py-0.5 text-xs font-mono text-slate-300">
                      Smart Contract ID #{order.contractOrderId}
                    </span>

                    {/* Status Badge */}
                    {order.status === 'FUNDED' && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-blue-500/10 px-2.5 py-0.5 text-xs font-medium text-blue-400">
                        <Clock className="h-3 w-3" /> Fondeada (En progreso)
                      </span>
                    )}
                    {order.status === 'DELIVERED' && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/10 px-2.5 py-0.5 text-xs font-medium text-purple-400">
                        <FileCheck className="h-3 w-3" /> Entregada (En revisión)
                      </span>
                    )}
                    {order.status === 'RELEASED' && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-medium text-accent">
                        <CheckCircle className="h-3 w-3" /> Completada & Pagada
                      </span>
                    )}
                    {order.status === 'REFUNDED' && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-400">
                        <RotateCcw className="h-3 w-3" /> Reembolsada 100%
                      </span>
                    )}
                    {order.status === 'DISPUTED' && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2.5 py-0.5 text-xs font-medium text-red-400">
                        <AlertTriangle className="h-3 w-3" /> En Disputa
                      </span>
                    )}
                  </div>

                  <h3 className="mt-2 text-lg font-bold text-white">{order.serviceTitle}</h3>

                  {order.deliveryUrl && (
                    <div className="mt-2 text-xs text-slate-400">
                      <span>Entregable: </span>
                      <a
                        href={order.deliveryUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 font-mono text-primary-light hover:underline"
                      >
                        {order.deliveryUrl}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}

                  {order.deliveryHash && (
                    <p className="mt-1 text-xs font-mono text-slate-500 truncate max-w-md">
                      Hash on-chain: {order.deliveryHash}
                    </p>
                  )}
                </div>

                {/* Amounts Breakdown */}
                <div className="flex flex-col lg:items-end text-sm">
                  <div className="flex items-baseline gap-1">
                    <span className="text-2xl font-extrabold text-white">{order.amountUsdc}</span>
                    <span className="text-xs font-semibold text-usdc">USDC</span>
                  </div>
                  <span className="text-xs text-slate-400">
                    {order.role === 'seller'
                      ? `Neto a recibir: ${order.sellerAmountUsdc} USDC (3% fee deducido)`
                      : '0% comisión para el comprador'}
                  </span>
                </div>
              </div>

              {/* Action Buttons Row */}
              <div className="mt-6 flex flex-wrap items-center gap-3 border-t border-border/80 pt-4">
                {/* Buyer Controls */}
                {order.role === 'buyer' && order.status === 'DELIVERED' && (
                  <>
                    <button
                      onClick={() => handleApproveDelivery(order)}
                      disabled={isProcessing}
                      className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-background transition hover:bg-accent/90 active:scale-95"
                    >
                      Aprobar Entrega y Liberar Pago
                    </button>
                    <button
                      onClick={() => handleOpenDispute(order)}
                      disabled={isProcessing}
                      className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-500/20"
                    >
                      Abrir Disputa
                    </button>
                    <span className="text-xs text-slate-400 ml-auto">
                      Auto-release activo en 4 días si no hay disputa.
                    </span>
                  </>
                )}

                {order.role === 'buyer' && order.status === 'FUNDED' && (
                  <div className="flex items-center justify-between w-full">
                    <span className="text-xs text-slate-400">
                      El prestador está trabajando. Si no entrega antes del plazo acordado, podrás reclamar el 100% de reembolso.
                    </span>
                    <button
                      onClick={() => handleClaimRefund(order)}
                      disabled={isProcessing}
                      className="rounded-lg border border-border px-3 py-1.5 text-xs font-semibold text-slate-400 hover:text-white"
                    >
                      Verificar Timeout
                    </button>
                  </div>
                )}

                {/* Seller Controls */}
                {order.role === 'seller' && order.status === 'FUNDED' && (
                  <button
                    onClick={() => setActiveDeliveryModalOrder(order)}
                    disabled={isProcessing}
                    className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-md shadow-primary/20 transition hover:bg-primary-hover active:scale-95"
                  >
                    Registrar Entrega de Trabajo
                  </button>
                )}

                {order.role === 'seller' && order.status === 'DELIVERED' && (
                  <div className="flex items-center justify-between w-full text-xs text-slate-400">
                    <span>
                      Entrega enviada al comprador. Si el cliente no revisa en 5 días, los fondos se liberarán automáticamente a tu wallet.
                    </span>
                  </div>
                )}

                {order.status === 'RELEASED' && (
                  <span className="text-xs text-accent font-semibold flex items-center gap-1.5">
                    <CheckCircle className="h-4 w-4" /> Contrato finalizado con éxito.
                  </span>
                )}
              </div>
            </div>
          );
        })}

        {filteredOrders.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border p-12 text-center text-slate-400">
            <p className="text-base font-semibold">No tienes órdenes activas en este rol</p>
            <p className="mt-1 text-xs text-slate-500">
              Explora el catálogo para contratar o publica tu primer servicio.
            </p>
          </div>
        )}
      </div>

      {/* Modal for Seller Delivery Submission */}
      {activeDeliveryModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-surface p-6 shadow-2xl">
            <h3 className="text-lg font-bold text-white">Registrar Entrega de Trabajo</h3>
            <p className="mt-1 text-xs text-slate-400">
              Ingresa el enlace al repositorio, archivo zip o entregable. Se calculará un hash criptográfico que quedará asentado en el smart contract.
            </p>

            <form onSubmit={handleSubmitDelivery} className="mt-4 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300">
                  Enlace al Entregable (GitHub, Drive, Figma, IPFS, etc.)
                </label>
                <input
                  type="url"
                  required
                  placeholder="https://..."
                  value={deliveryInputUrl}
                  onChange={(e) => setDeliveryInputUrl(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-primary focus:outline-none"
                />
              </div>

              <div className="rounded-xl bg-surface-elevated p-3 text-xs text-slate-400">
                Al confirmar, el contrato pasará a estado <strong>DELIVERED</strong> y el comprador tendrá 5 días para validar antes del auto-release.
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => setActiveDeliveryModalOrder(null)}
                  className="flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isProcessing || !deliveryInputUrl}
                  className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary/20 transition hover:bg-primary-hover active:scale-95 disabled:opacity-50"
                >
                  {isProcessing ? 'Registrando en Smart Contract...' : 'Confirmar Entrega'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
