'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useAccount, useWriteContract } from 'wagmi';
import { MarketplaceEscrowAbi, ESCROW_ADDRESSES } from '@mercadopleis/contracts-abi';
import { CONTRACT_CONFIG } from '@mercadopleis/types';
import { useAuth } from '@/lib/authContext';
import { useLanguage } from '@/lib/languageContext';
import { fetchMyOrders, updateOrder, submitReview, openDisputeApi } from '@/lib/api';
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
  RefreshCw,
  Star,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Upload,
  Link as LinkIcon,
  Hash,
  Loader2,
  X,
  Copy,
  Check,
  ShoppingBag,
  Trash2,
  Gavel,
} from 'lucide-react';
import { OrderTimelineAndChat } from '@/components/OrderTimelineAndChat';
import { isUserRejection } from '@/lib/web3Errors';
import { BUILDER_DATA_SUFFIX } from '@/lib/builderCode';

interface MockOrder {
  id: string;
  contractOrderId: number;
  serviceTitle: string;
  role: 'buyer' | 'seller';
  amountUsdc: number;
  sellerAmountUsdc: number;
  platformFeeUsdc: number;
  status: 'CREATED' | 'FUNDED' | 'DELIVERED' | 'RELEASED' | 'REFUNDED' | 'DISPUTED';
  chainId?: number;
  txHashFunding?: string;
  txHashRelease?: string;
  deliveryHash?: string;
  deliveryUrl?: string;
  deadlineTimestamp: number;
  autoReleaseDeadline?: number;
  sellerAddress: string;
  buyerAddress: string;
  isDemo?: boolean;
  dispute?: {
    id: string;
    reason: string;
    evidenceUrl?: string | null;
    status: 'OPEN' | 'RESOLVED';
    sellerAwardUsdc?: string | null;
    buyerRefundUsdc?: string | null;
    resolutionNotes?: string | null;
    createdAt?: string;
  } | null;
  review?: {
    id?: string;
    rating: number;
    comment: string;
    createdAt?: string;
  } | null;
}

const INITIAL_DEMO_ORDERS: MockOrder[] = [];

export default function OrdersDashboardPage() {
  const { isConnected, chainId, address } = useAccount();
  const { user } = useAuth();
  const { t, language } = useLanguage();
  const [activeTab, setActiveTab] = useState<'buyer' | 'seller'>('buyer');
  const [showDemoOrders, setShowDemoOrders] = useState(false);
  const [orders, setOrders] = useState<MockOrder[]>([]);
  const [activeDeliveryModalOrder, setActiveDeliveryModalOrder] = useState<MockOrder | null>(null);
  const [deliveryInputUrl, setDeliveryInputUrl] = useState('');
  const [deliveryHash, setDeliveryHash] = useState('');
  const [deliveryMode, setDeliveryMode] = useState<'file' | 'link'>('file');
  const [uploadedFileMeta, setUploadedFileMeta] = useState<{
    filename: string;
    size: number;
    url: string;
    hash: string;
  } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [copiedHash, setCopiedHash] = useState(false);
  const [activeReviewModalOrder, setActiveReviewModalOrder] = useState<MockOrder | null>(null);
  const [reviewRating, setReviewRating] = useState<number>(5);
  const [reviewHoverRating, setReviewHoverRating] = useState<number>(0);
  const [reviewComment, setReviewComment] = useState<string>('');
  const [reviewedOrders, setReviewedOrders] = useState<Record<string, number>>({});
  const [activeDisputeModalOrder, setActiveDisputeModalOrder] = useState<MockOrder | null>(null);
  const [disputeReason, setDisputeReason] = useState<string>('');
  const [disputeEvidenceUrl, setDisputeEvidenceUrl] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [actionNotice, setActionNotice] = useState<string | null>(null);
  const [expandedOrderId, setExpandedOrderId] = useState<string | null>(null);

  const activeChainId = chainId || CONTRACT_CONFIG.BASE_MAINNET_CHAIN_ID;
  const escrowAddress = ESCROW_ADDRESSES[activeChainId] || ESCROW_ADDRESSES[CONTRACT_CONFIG.BASE_MAINNET_CHAIN_ID];
  const { writeContractAsync } = useWriteContract();

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeReviewModalOrder || !reviewComment.trim()) return;

    try {
      setIsProcessing(true);
      await submitReview({
        orderId: activeReviewModalOrder.id,
        rating: reviewRating,
        comment: reviewComment.trim(),
      });

      const updatedOrderId = activeReviewModalOrder.id;
      const finalRating = reviewRating;
      const finalComment = reviewComment.trim();

      setReviewedOrders((prev) => ({
        ...prev,
        [updatedOrderId]: finalRating,
      }));

      setOrders((prev) =>
        prev.map((ord) =>
          ord.id === updatedOrderId
            ? { ...ord, review: { rating: finalRating, comment: finalComment } }
            : ord
        )
      );

      setActionNotice(t('reviewSubmittedNotice'));
      setActiveReviewModalOrder(null);
      setReviewComment('');
    } catch (err: any) {
      console.error(err);
      setActionNotice(`Error: ${err?.message || 'Error al guardar la reseña'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Load orders from API and local store
  const loadOrders = useCallback(async () => {
    try {
      const localCustom = JSON.parse(localStorage.getItem('mercadopleis_custom_orders') || '[]');
      const apiOrders = await fetchMyOrders(undefined, address);

      let dynamicOrders: MockOrder[] = [];

      if (apiOrders && Array.isArray(apiOrders) && apiOrders.length > 0) {
        const loadedReviews: Record<string, number> = {};
        dynamicOrders = apiOrders.map((bo: any) => {
          if (bo.review?.rating) {
            loadedReviews[bo.id] = bo.review.rating;
          }
          return {
            id: bo.id,
            contractOrderId: bo.contractOrderId || null,
            serviceTitle: bo.service?.title || 'Servicio Contratado',
            role: (bo.buyer?.walletAddress?.toLowerCase() === address?.toLowerCase() || (user?.id && bo.buyerId === user.id)) ? 'buyer' : 'seller',
            amountUsdc: parseFloat(bo.grossAmountUsdc),
            sellerAmountUsdc: parseFloat(bo.sellerAmountUsdc),
            platformFeeUsdc: parseFloat(bo.platformFeeUsdc),
            status: bo.status,
            chainId: bo.chainId || activeChainId,
            txHashFunding: bo.txHashFunding || undefined,
            txHashRelease: bo.txHashRelease || undefined,
            deliveryHash: bo.deliveryHash,
            deliveryUrl: bo.deliveryUrl || bo.deliveryReferenceUrl || undefined,
            deadlineTimestamp: bo.deadlineTimestamp,
            autoReleaseDeadline: bo.autoReleaseDeadline,
            sellerAddress: bo.seller?.walletAddress || '',
            buyerAddress: bo.buyer?.walletAddress || address || '',
            isDemo: false,
            dispute: bo.dispute || null,
            review: bo.review || null,
          };
        });
        setReviewedOrders((prev) => ({ ...loadedReviews, ...prev }));
      }

      // Combine dynamic orders + local custom orders (+ demo orders only if toggled)
      const baseList = [...dynamicOrders, ...localCustom];
      const ordersToDisplay = showDemoOrders ? [...baseList, ...INITIAL_DEMO_ORDERS] : baseList;

      const existingIds = new Set<string>();
      const combined: MockOrder[] = [];

      for (const ord of ordersToDisplay) {
        if (!existingIds.has(ord.id)) {
          existingIds.add(ord.id);
          combined.push(ord);
        }
      }

      setOrders(combined);
    } catch (e) {
      console.warn('Orders load note:', e);
    }
  }, [user?.id, address, showDemoOrders]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const filteredOrders = orders.filter((o) => o.role === activeTab);

  // Buyer Action: Approve delivery and release funds
  const handleApproveDelivery = async (order: MockOrder) => {
    try {
      setIsProcessing(true);
      setActionNotice(`Aprobando entrega de Orden #${order.contractOrderId}...`);

      let txHash: `0x${string}`;

      if (isConnected && escrowAddress && escrowAddress !== '0x0000000000000000000000000000000000000000') {
        txHash = await writeContractAsync({
          address: escrowAddress,
          abi: MarketplaceEscrowAbi,
          dataSuffix: BUILDER_DATA_SUFFIX,
          functionName: 'approveDelivery',
          args: [BigInt(order.contractOrderId)],
        });
      } else {
        throw new Error(language === 'en' ? 'Connect your wallet to send this on-chain transaction.' : 'Conecta tu wallet para enviar esta transacción on-chain.');
      }

      // Sync with PostgreSQL API
      try {
        await updateOrder(order.id, { status: 'RELEASED', txHashRelease: txHash });
      } catch (err) {
        console.warn('Backend sync note:', err);
      }

      setOrders((prev) =>
        prev.map((o) => (o.id === order.id ? { ...o, status: 'RELEASED' } : o))
      );
      setActionNotice(`¡Orden #${order.contractOrderId} aprobada! Fondos liberados al prestador.`);
    } catch (err: any) {
      if (isUserRejection(err)) {
        setActionNotice(language === 'en' ? 'Operation cancelled in your wallet.' : 'Operación cancelada en tu wallet.');
      } else {
        console.error(err);
        setActionNotice(`Error: ${err?.shortMessage || err?.message || 'Error en transacción'}`);
      }
    } finally {
      setIsProcessing(false);
    }
  };


  // Buyer Action: Open dispute modal
  const handleOpenDispute = (order: MockOrder) => {
    setActiveDisputeModalOrder(order);
    setDisputeReason('');
    setDisputeEvidenceUrl('');
  };

  // Buyer Action: Confirm dispute submission
  const handleConfirmDispute = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDisputeModalOrder || !disputeReason.trim()) return;

    try {
      setIsProcessing(true);
      setActionNotice(`Abriendo disputa formal para Orden #${activeDisputeModalOrder.contractOrderId}...`);

      let disputeTxHash: `0x${string}`;

      if (isConnected && escrowAddress && escrowAddress !== '0x0000000000000000000000000000000000000000') {
        disputeTxHash = await writeContractAsync({
          address: escrowAddress,
          abi: MarketplaceEscrowAbi,
          dataSuffix: BUILDER_DATA_SUFFIX,
          functionName: 'openDispute',
          args: [BigInt(activeDisputeModalOrder.contractOrderId)],
        });
      } else {
        throw new Error(language === 'en' ? 'Connect your wallet to send this on-chain transaction.' : 'Conecta tu wallet para enviar esta transacción on-chain.');
      }

      try {
        await openDisputeApi({
          orderId: activeDisputeModalOrder.id,
          reason: disputeReason.trim(),
          evidenceUrl: disputeEvidenceUrl.trim() || undefined,
          txHash: disputeTxHash,
        });
      } catch (err) {
        console.warn('Backend dispute record note:', err);
      }

      setOrders((prev) =>
        prev.map((o) =>
          o.id === activeDisputeModalOrder.id
            ? {
                ...o,
                status: 'DISPUTED',
                dispute: {
                  id: 'disp-' + Date.now(),
                  reason: disputeReason.trim(),
                  evidenceUrl: disputeEvidenceUrl.trim() || null,
                  status: 'OPEN',
                },
              }
            : o
        )
      );

      setActionNotice(`¡Disputa abierta con éxito para Orden #${activeDisputeModalOrder.contractOrderId}! Fondos congelados en escrow para arbitraje.`);
      setActiveDisputeModalOrder(null);
    } catch (err: any) {
      if (isUserRejection(err)) {
        setActionNotice(language === 'en' ? 'Operation cancelled in your wallet.' : 'Operación cancelada en tu wallet.');
      } else {
        console.error(err);
        setActionNotice(`Error: ${err?.shortMessage || err?.message || 'Error al abrir disputa'}`);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // Buyer Action: Claim timeout refund
  const handleClaimRefund = async (order: MockOrder) => {
    try {
      setIsProcessing(true);
      setActionNotice(`Reclamando reembolso por timeout para Orden #${order.contractOrderId}...`);

      if (isConnected && escrowAddress && escrowAddress !== '0x0000000000000000000000000000000000000000') {
        await writeContractAsync({
          address: escrowAddress,
          abi: MarketplaceEscrowAbi,
          dataSuffix: BUILDER_DATA_SUFFIX,
          functionName: 'claimTimeoutRefund',
          args: [BigInt(order.contractOrderId)],
        });
      } else {
        throw new Error(language === 'en' ? 'Connect your wallet to send this on-chain transaction.' : 'Conecta tu wallet para enviar esta transacción on-chain.');
      }

      try {
        await updateOrder(order.id, { status: 'REFUNDED' });
      } catch (err) {
        console.warn('Backend sync note:', err);
      }

      setOrders((prev) =>
        prev.map((o) => (o.id === order.id ? { ...o, status: 'REFUNDED' } : o))
      );
      setActionNotice(`100% de los fondos reembolsados directamente al comprador.`);
    } catch (err: any) {
      if (isUserRejection(err)) {
        setActionNotice(language === 'en' ? 'Operation cancelled in your wallet.' : 'Operación cancelada en tu wallet.');
      } else {
        console.error(err);
        setActionNotice(`Error: ${err?.shortMessage || err?.message || 'Error en transacción'}`);
      }
    } finally {
      setIsProcessing(false);
    }
  };


  const openDeliveryModal = (order: MockOrder) => {
    setActiveDeliveryModalOrder(order);
    setDeliveryInputUrl('');
    setDeliveryHash('');
    setUploadedFileMeta(null);
    setUploadError(null);
    setDeliveryMode('file');
    setCopiedHash(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsUploading(true);
      setUploadError(null);

      const formData = new FormData();
      formData.append('file', file);

      const res = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Error al subir el archivo');
      }

      setUploadedFileMeta({
        filename: data.filename,
        size: data.size,
        url: data.url,
        hash: data.hash,
      });
      setDeliveryInputUrl(data.url);
      setDeliveryHash(data.hash);
    } catch (err: any) {
      console.error('Error uploading file to Neon Object Storage:', err);
      setUploadError(err.message || 'Error al conectar con Neon Object Storage');
    } finally {
      setIsUploading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedHash(true);
    setTimeout(() => setCopiedHash(false), 2000);
  };

  // Seller Action: Submit delivery
  const handleSubmitDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeDeliveryModalOrder || !deliveryInputUrl) return;

    try {
      setIsProcessing(true);

      let finalHash = deliveryHash;
      if (!finalHash || !finalHash.startsWith('0x') || finalHash.length !== 66) {
        // Derive 32-byte sha256 hash from the URL
        const enc = new TextEncoder();
        const hashBuf = await crypto.subtle.digest('SHA-256', enc.encode(deliveryInputUrl));
        const hashArray = Array.from(new Uint8Array(hashBuf));
        finalHash = '0x' + hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
      }

      let txHash: `0x${string}`;

      if (isConnected && escrowAddress && escrowAddress !== '0x0000000000000000000000000000000000000000') {
        txHash = await writeContractAsync({
          address: escrowAddress,
          abi: MarketplaceEscrowAbi,
          dataSuffix: BUILDER_DATA_SUFFIX,
          functionName: 'submitDelivery',
          args: [BigInt(activeDeliveryModalOrder.contractOrderId), finalHash as `0x${string}`],
        });
      } else {
        throw new Error(language === 'en' ? 'Connect your wallet to send this on-chain transaction.' : 'Conecta tu wallet para enviar esta transacción on-chain.');
      }

      try {
        await updateOrder(activeDeliveryModalOrder.id, {
          status: 'DELIVERED',
          txHash,
          deliveryUrl: deliveryInputUrl,
          deliveryHash: finalHash,
        });
      } catch (err) {
        console.warn('Backend sync note:', err);
      }

      setOrders((prev) =>
        prev.map((o) =>
          o.id === activeDeliveryModalOrder.id
            ? {
                ...o,
                status: 'DELIVERED',
                deliveryUrl: deliveryInputUrl,
                deliveryHash: finalHash,
                autoReleaseDeadline: Math.floor(Date.now() / 1000) + 86400 * 5,
              }
            : o
        )
      );

      setActionNotice(`¡Entrega registrada con éxito! Hash criptográfico ${finalHash.slice(0, 10)}...${finalHash.slice(-6)} asentado en el contrato.`);
      setActiveDeliveryModalOrder(null);
      setDeliveryInputUrl('');
      setDeliveryHash('');
      setUploadedFileMeta(null);
    } catch (err: any) {
      if (isUserRejection(err)) {
        setActionNotice(language === 'en' ? 'Operation cancelled in your wallet.' : 'Operación cancelada en tu wallet.');
      } else {
        console.error(err);
        setActionNotice(`Error: ${err?.shortMessage || err?.message || 'Error en transacción'}`);
      }
    } finally {
      setIsProcessing(false);
    }

  };

  return (
    <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1 className="text-3xl font-extrabold text-white">{t('ordersTitle')}</h1>
          <p className="mt-1 text-sm text-slate-400">
            {t('ordersSubtitle')}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={() => loadOrders()}
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-surface-elevated hover:text-white"
            title="Actualizar listado de órdenes"
          >
            <RefreshCw className="h-4 w-4 text-primary-light" />
            <span className="hidden sm:inline">{t('refresh')}</span>
          </button>

          <button
            onClick={() => {
              if (typeof window !== 'undefined') {
                localStorage.removeItem('mercadopleis_custom_orders');
                loadOrders();
                setActionNotice(language === 'en' ? 'Local test orders cache cleared.' : 'Caché local de órdenes de prueba eliminada.');
              }
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-2 text-xs font-semibold text-slate-400 transition hover:bg-surface-elevated hover:text-white"
            title="Limpiar datos temporales de prueba en tu navegador"
          >
            <Trash2 className="h-3.5 w-3.5 text-slate-400" />
            <span className="hidden sm:inline">{t('clearCache')}</span>
          </button>

          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-surface-elevated"
          >
            <span>{t('exploreServices')}</span>
            <ArrowRight className="h-4 w-4 text-primary-light" />
          </Link>
        </div>
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
          {t('asBuyer')} ({orders.filter((o) => o.role === 'buyer').length})
        </button>
        <button
          onClick={() => setActiveTab('seller')}
          className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
            activeTab === 'seller'
              ? 'bg-primary text-white shadow-md shadow-primary/20'
              : 'text-slate-400 hover:bg-surface hover:text-white'
          }`}
        >
          {t('asSeller')} ({orders.filter((o) => o.role === 'seller').length})
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
                        <Clock className="h-3 w-3" /> {t('statusFunded')}
                      </span>
                    )}
                    {order.status === 'DELIVERED' && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-purple-500/10 px-2.5 py-0.5 text-xs font-medium text-purple-400">
                        <FileCheck className="h-3 w-3" /> {t('statusDelivered')}
                      </span>
                    )}
                    {order.status === 'RELEASED' && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-2.5 py-0.5 text-xs font-medium text-accent">
                        <CheckCircle className="h-3 w-3" /> {t('statusReleased')}
                      </span>
                    )}
                    {order.status === 'REFUNDED' && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 px-2.5 py-0.5 text-xs font-medium text-amber-400">
                        <RotateCcw className="h-3 w-3" /> {t('statusRefunded')}
                      </span>
                    )}
                    {order.status === 'DISPUTED' && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2.5 py-0.5 text-xs font-medium text-red-400">
                        <AlertTriangle className="h-3 w-3" /> {t('statusDisputed')}
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

              {/* Dispute Status Card (Strictly private: only buyer and seller of this order see it) */}
              {(order.status === 'DISPUTED' || order.dispute) && (
                <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/5 p-4 text-xs">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 font-bold text-red-400">
                      <AlertTriangle className="h-4 w-4 shrink-0" />
                      <span>
                        {order.dispute?.status === 'RESOLVED'
                          ? 'Fallo de Mediación y Arbitraje Emitido'
                          : 'Disputa en Curso — Fondos Congelados en Escrow'}
                      </span>
                    </div>
                    <span
                      className={`rounded px-2.5 py-0.5 text-[11px] font-bold ${
                        order.dispute?.status === 'RESOLVED'
                          ? 'bg-accent/20 text-accent'
                          : 'bg-red-500/20 text-red-300'
                      }`}
                    >
                      {order.dispute?.status === 'RESOLVED' ? 'RESUELTA' : 'EN MEDIACIÓN'}
                    </span>
                  </div>

                  {order.dispute?.reason && (
                    <div className="mt-2.5 text-slate-300">
                      <strong className="text-red-300">Motivo del reclamo: </strong>
                      <span>{order.dispute.reason}</span>
                    </div>
                  )}

                  {order.dispute?.evidenceUrl && (
                    <div className="mt-1.5 text-slate-400">
                      <span>Prueba aportada: </span>
                      <a
                        href={order.dispute.evidenceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="font-mono text-primary-light hover:underline inline-flex items-center gap-1"
                      >
                        {order.dispute.evidenceUrl}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}

                  {order.dispute?.status === 'RESOLVED' ? (
                    <div className="mt-3 rounded-lg border border-accent/30 bg-accent/10 p-3 text-accent">
                      <p className="font-bold">
                        Resolución de mediación ejecutada: {order.dispute.sellerAwardUsdc} USDC acreditados al prestador / {order.dispute.buyerRefundUsdc} USDC reembolsados al comprador.
                      </p>
                      {order.dispute.resolutionNotes && (
                        <p className="mt-1.5 text-xs text-slate-300">
                          <strong className="text-slate-400">Fundamentación de la resolución: </strong>
                          {order.dispute.resolutionNotes}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="mt-2 text-[11px] text-slate-400 leading-relaxed">
                      El proceso de mediación y arbitraje neutral está evaluando las pruebas del caso. Los fondos en USDC permanecen asegurados de forma non-custodial en el contrato de Escrow de Base Sepolia.
                    </p>
                  )}
                </div>
              )}

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
                      {t('approveAndRelease')}
                    </button>
                    <button
                      onClick={() => handleOpenDispute(order)}
                      disabled={isProcessing}
                      className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-500/20"
                    >
                      {t('openDispute')}
                    </button>
                    <span className="text-xs text-slate-400 ml-auto">
                      {t('autoReleaseNotice')}
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
                    onClick={() => openDeliveryModal(order)}
                    disabled={isProcessing}
                    className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-md shadow-primary/20 transition hover:bg-primary-hover active:scale-95"
                  >
                    {t('submitDelivery')}
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
                  <div className="flex flex-wrap items-center justify-between w-full gap-3">
                    <span className="text-xs text-accent font-semibold flex items-center gap-1.5">
                      <CheckCircle className="h-4 w-4" /> {language === 'en' ? 'Contract finalized and funds released.' : 'Contrato finalizado y fondos liberados.'}
                    </span>

                    {order.role === 'buyer' && (
                      (reviewedOrders[order.id] || order.review) ? (
                        <div className="flex flex-col items-end gap-1">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-300">
                            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                            {t('serviceRated')} ({reviewedOrders[order.id] || order.review?.rating || 5} / 5 ★)
                          </span>
                          {(order.review?.comment || (reviewedOrders[order.id] && reviewComment)) && (
                            <span className="text-[11px] text-slate-400 italic max-w-xs text-right truncate">
                              "{order.review?.comment || reviewComment}"
                            </span>
                          )}
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setActiveReviewModalOrder(order);
                            setReviewRating(5);
                            setReviewComment('');
                          }}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-amber-400/40 bg-amber-400/10 px-3.5 py-1.5 text-xs font-bold text-amber-300 transition hover:bg-amber-400/20 active:scale-95 shadow-sm shadow-amber-500/10"
                        >
                          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                          {t('rateService')}
                        </button>
                      )
                    )}

                    {order.role === 'seller' && (reviewedOrders[order.id] || order.review) && (
                      <div className="flex flex-col items-end gap-1">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                          {t('receivedReview')}: {order.review?.rating || reviewedOrders[order.id] || 5} / 5 ★
                        </span>
                        {order.review?.comment && (
                          <span className="text-[11px] text-slate-400 italic max-w-xs text-right truncate">
                            "{order.review.comment}"
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Toggle Timeline & Messages Button */}
              <div className="mt-5 pt-4 border-t border-border/60 flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setExpandedOrderId(expandedOrderId === order.id ? null : order.id)}
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span>
                    {expandedOrderId === order.id ? 'Ocultar Actividad & Mensajes' : 'Ver Línea de Tiempo & Mensajes'}
                  </span>
                  {expandedOrderId === order.id ? (
                    <ChevronUp className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                  )}
                </button>

                <span className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
                  {order.status === 'DELIVERED' ? (
                    <span className="text-amber-300">⏱️ Período de 5 días en curso</span>
                  ) : (
                    <span className="text-slate-400">🛡️ Smart Escrow Protegido</span>
                  )}
                </span>
              </div>

              {/* Collapsible Timeline and Chat */}
              {expandedOrderId === order.id && <OrderTimelineAndChat order={order} />}
            </div>
          );
        })}

        {filteredOrders.length === 0 && (
          <div className="rounded-2xl border border-dashed border-border/80 bg-surface-elevated/20 p-12 text-center text-slate-400">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-surface border border-border text-slate-400 mb-4">
              <ShoppingBag className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-bold text-white">
              {activeTab === 'buyer' ? t('noOrdersBuyer') : t('noOrdersSeller')}
            </h3>
            <p className="mt-1 text-sm text-slate-400 max-w-md mx-auto">
              {activeTab === 'buyer'
                ? t('noOrdersBuyerDesc')
                : t('noOrdersSellerDesc')}
            </p>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
              {activeTab === 'buyer' ? (
                <Link
                  href="/"
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary/20 transition hover:bg-primary-hover active:scale-95"
                >
                  Explorar Catálogo <ArrowRight className="h-4 w-4" />
                </Link>
              ) : (
                <Link
                  href="/services/new"
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary/20 transition hover:bg-primary-hover active:scale-95"
                >
                  Publicar Servicio <ArrowRight className="h-4 w-4" />
                </Link>
              )}

              <button
                type="button"
                onClick={() => setShowDemoOrders((prev) => !prev)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border/80 bg-surface px-4 py-2.5 text-xs font-semibold text-slate-400 hover:text-white transition"
              >
                <span>{showDemoOrders ? 'Ocultar datos de prueba' : 'Ver órdenes demo de prueba'}</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal for Seller Delivery Submission with Neon Object Storage */}
      {activeDeliveryModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md">
          <div className="w-full max-w-lg rounded-2xl border border-border bg-surface p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2.5">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  <UploadCloud className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Registrar Entrega de Trabajo</h3>
                  <p className="text-xs text-slate-400">Orden #{activeDeliveryModalOrder.contractOrderId} • {activeDeliveryModalOrder.serviceTitle}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveDeliveryModalOrder(null)}
                className="rounded-lg p-1 text-slate-400 hover:bg-surface-elevated hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Mode Selector Tabs */}
            <div className="mt-5 flex rounded-xl border border-border bg-surface-elevated/50 p-1">
              <button
                type="button"
                onClick={() => setDeliveryMode('file')}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-xs font-semibold transition ${
                  deliveryMode === 'file'
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <UploadCloud className="h-4 w-4" />
                Subir Archivo (Neon Storage)
              </button>
              <button
                type="button"
                onClick={() => setDeliveryMode('link')}
                className={`flex flex-1 items-center justify-center gap-2 rounded-lg py-2 text-xs font-semibold transition ${
                  deliveryMode === 'link'
                    ? 'bg-primary text-white shadow-sm'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                <LinkIcon className="h-4 w-4" />
                Enlace Externo (GitHub/Figma)
              </button>
            </div>

            <form onSubmit={handleSubmitDelivery} className="mt-4 space-y-4">
              {deliveryMode === 'file' ? (
                <div>
                  {!uploadedFileMeta ? (
                    <div>
                      <label className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-border/80 bg-background/50 p-6 text-center transition hover:border-primary/60 hover:bg-primary/5 cursor-pointer">
                        <input
                          type="file"
                          className="hidden"
                          onChange={handleFileUpload}
                          disabled={isUploading}
                        />
                        {isUploading ? (
                          <div className="flex flex-col items-center gap-2 text-purple-400">
                            <Loader2 className="h-8 w-8 animate-spin" />
                            <p className="text-xs font-semibold text-white">Subiendo a Neon Object Storage...</p>
                            <p className="text-[11px] text-slate-400">Calculando hash criptográfico SHA-256</p>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-2">
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-500/10 text-purple-400">
                              <Upload className="h-6 w-6" />
                            </div>
                            <p className="text-sm font-semibold text-white">
                              Haz clic o arrastra aquí tu archivo de entrega
                            </p>
                            <p className="text-xs text-slate-400">
                              Soporta .zip, .pdf, .sol, imágenes, videos o documentos (hasta 50MB)
                            </p>
                            <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-purple-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-purple-300">
                              ⚡ Alojado en Neon Object Storage (AWS S3)
                            </span>
                          </div>
                        )}
                      </label>
                      {uploadError && (
                        <div className="mt-2 rounded-lg border border-red-500/30 bg-red-500/10 p-2.5 text-xs text-red-400">
                          {uploadError}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-xl border border-purple-500/30 bg-purple-950/20 p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-2.5">
                          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-purple-500/20 text-purple-300">
                            <FileCheck className="h-5 w-5" />
                          </div>
                          <div>
                            <p className="text-sm font-semibold text-white truncate max-w-[260px]">
                              {uploadedFileMeta.filename}
                            </p>
                            <p className="text-xs text-slate-400">
                              {(uploadedFileMeta.size / 1024).toFixed(1)} KB • Neon Storage
                            </p>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            setUploadedFileMeta(null);
                            setDeliveryInputUrl('');
                            setDeliveryHash('');
                          }}
                          className="text-xs text-slate-400 hover:text-red-400"
                        >
                          Cambiar
                        </button>
                      </div>

                      {/* Hash Box */}
                      <div className="rounded-lg bg-black/40 p-2.5 font-mono text-[11px] border border-border/40">
                        <div className="flex items-center justify-between text-slate-400 text-[10px] uppercase font-bold mb-1">
                          <span className="flex items-center gap-1 text-purple-400">
                            <Hash className="h-3 w-3" /> Prueba Criptográfica SHA-256
                          </span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(uploadedFileMeta.hash)}
                            className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300"
                          >
                            {copiedHash ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                            {copiedHash ? 'Copiado' : 'Copiar'}
                          </button>
                        </div>
                        <p className="text-white font-mono break-all select-all">{uploadedFileMeta.hash}</p>
                      </div>

                      <a
                        href={uploadedFileMeta.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 hover:underline"
                      >
                        <span>Abrir archivo en el bucket público</span>
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-300">
                    Enlace al Entregable (GitHub, Drive, Figma, IPFS, etc.)
                  </label>
                  <input
                    type="url"
                    required
                    placeholder="https://github.com/..."
                    value={deliveryInputUrl}
                    onChange={(e) => setDeliveryInputUrl(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-primary focus:outline-none"
                  />
                  <p className="mt-1 text-[11px] text-slate-400">
                    Se generará un hash criptográfico a partir de este enlace para asentarlo en el smart contract.
                  </p>
                </div>
              )}

              <div className="rounded-xl bg-surface-elevated/70 border border-border/50 p-3 text-xs text-slate-300 space-y-1">
                <p className="font-semibold text-white flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-accent" /> Garantía de Escrow
                </p>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  Al confirmar, el contrato pasará a estado <strong>DELIVERED</strong> con el hash inmutable registrado en Base Sepolia. El comprador tendrá <strong>5 días</strong> para validar la entrega antes del auto-release de los fondos.
                </p>
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setActiveDeliveryModalOrder(null)}
                  className="flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isProcessing || isUploading || !deliveryInputUrl}
                  className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary/20 transition hover:bg-primary-hover active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>Registrando On-Chain...</span>
                    </>
                  ) : (
                    <span>Confirmar Entrega</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal for Buyer Review Submission */}
      {activeReviewModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-border bg-surface p-6 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center gap-2 text-amber-400">
              <Star className="h-5 w-5 fill-amber-400" />
              <h3 className="text-lg font-bold text-white">{t('modalReviewTitle')}</h3>
            </div>
            <p className="mt-1 text-xs text-slate-400">
              {t('modalReviewDesc')}
            </p>

            <form onSubmit={handleSubmitReview} className="mt-5 space-y-4">
              <div>
                <span className="text-xs text-slate-400">{t('modalReviewServiceLabel')}:</span>
                <p className="font-semibold text-white text-sm">{activeReviewModalOrder.serviceTitle}</p>
              </div>

              {/* Star Rating Selector */}
              <div>
                <label className="block text-xs font-semibold text-slate-300">
                  {t('modalReviewRatingLabel')}
                </label>
                <div className="mt-2 flex items-center gap-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onMouseEnter={() => setReviewHoverRating(star)}
                      onMouseLeave={() => setReviewHoverRating(0)}
                      onClick={() => setReviewRating(star)}
                      className="p-1 transition transform hover:scale-110"
                    >
                      <Star
                        className={`h-7 w-7 transition ${
                          (reviewHoverRating || reviewRating) >= star
                            ? 'fill-amber-400 text-amber-400'
                            : 'text-slate-600'
                        }`}
                      />
                    </button>
                  ))}
                  <span className="ml-2 text-xs font-semibold text-amber-300">
                    {reviewRating === 5 && t('ratingExcellent')}
                    {reviewRating === 4 && t('ratingVeryGood')}
                    {reviewRating === 3 && t('ratingAcceptable')}
                    {reviewRating === 2 && t('ratingFair')}
                    {reviewRating === 1 && t('ratingPoor')}
                  </span>
                </div>
              </div>

              {/* Review Comment */}
              <div>
                <label className="block text-xs font-semibold text-slate-300">
                  {t('modalReviewCommentLabel')}
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder={t('modalReviewCommentPlaceholder')}
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-border bg-background p-3 text-xs text-white placeholder-slate-500 focus:border-primary focus:outline-none"
                />
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveReviewModalOrder(null)}
                  className="flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold text-slate-400 hover:text-white"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isProcessing || !reviewComment.trim()}
                  className="flex-1 rounded-xl bg-amber-500 py-2.5 text-sm font-bold text-background shadow-lg shadow-amber-500/20 transition hover:bg-amber-400 active:scale-95 disabled:opacity-50"
                >
                  {isProcessing ? t('savingReview') : t('publishReview')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal for Buyer Opening a Dispute */}
      {activeDisputeModalOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-red-500/40 bg-surface p-6 shadow-2xl">
            <div className="flex items-center justify-between border-b border-border/80 pb-4">
              <div className="flex items-center gap-2 text-red-400">
                <AlertTriangle className="h-5 w-5" />
                <h3 className="text-lg font-bold text-white">
                  Abrir Disputa de Orden #{activeDisputeModalOrder.contractOrderId}
                </h3>
              </div>
              <button
                onClick={() => setActiveDisputeModalOrder(null)}
                className="text-xs text-slate-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <p className="mt-3 text-xs text-slate-400 leading-relaxed">
              Al abrir una disputa, el auto-release de fondos se congela de inmediato en el smart contract escrow. El servicio de mediación y arbitraje neutral evaluará el caso para determinar la distribución o reembolso justo de los fondos.
            </p>

            <form onSubmit={handleConfirmDispute} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300">
                  Motivo detallado del reclamo <span className="text-red-400">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder="Explica detalladamente por qué el trabajo no cumple con lo acordado (ej. fallos de compilación, requerimientos no incluidos, entregable erróneo)..."
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-border bg-background p-3 text-xs text-white placeholder-slate-500 focus:border-red-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300">
                  Enlace a pruebas / evidencia (URL pública, GitHub, Google Drive, etc.)
                </label>
                <input
                  type="url"
                  placeholder="https://github.com/... o https://drive.google.com/..."
                  value={disputeEvidenceUrl}
                  onChange={(e) => setDisputeEvidenceUrl(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-border bg-background p-2.5 text-xs text-white placeholder-slate-500 focus:border-red-400 focus:outline-none"
                />
              </div>

              <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-[11px] text-red-300">
                ⚠️ Las pruebas aportadas y los mensajes intercambiados en la orden serán evaluados para dictar la resolución final.
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveDisputeModalOrder(null)}
                  className="flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold text-slate-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isProcessing || !disputeReason.trim()}
                  className="flex-1 rounded-xl bg-red-500 py-2.5 text-sm font-bold text-white shadow-lg shadow-red-500/20 transition hover:bg-red-600 active:scale-95 disabled:opacity-50"
                >
                  {isProcessing ? 'Congelando Fondos en Escrow...' : 'Confirmar y Congelar Fondos'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
