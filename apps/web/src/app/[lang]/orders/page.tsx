'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from '@/components/LocaleLink';
import { useAccount, usePublicClient, useWriteContract } from 'wagmi';
// The v3 ABI is a superset of v2 (same functions, getters and events), so it serves orders in either escrow.
import { MarketplaceEscrowV3Abi as MarketplaceEscrowAbi } from '@mercadopleis/contracts-abi';
import { currentEscrow, isV3Escrow, orderEscrow } from '@/lib/networks';
import { WithdrawPanel } from '@/components/WithdrawPanel';
import { CONTRACT_CONFIG } from '@mercadopleis/types';
import { useAuth } from '@/lib/authContext';
import { useLanguage } from '@/lib/languageContext';
import { fetchMyOrders, updateOrder, submitReview, openDisputeApi, uploadDeliverable, syncChain, createOrder } from '@/lib/api';
import { confirmTx } from '@/lib/txConfirm';
import { clearPendingOrders, loadPendingOrders, removePendingOrder, type PendingOrder } from '@/lib/pendingOrders';
import {
  ShieldCheck,
  Clock,
  CheckCircle,
  AlertTriangle,
  RotateCcw,
  UploadCloud,
  FileCheck,
  ExternalLink,
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
} from 'lucide-react';
import { OrderTimelineAndChat } from '@/components/OrderTimelineAndChat';
import { DeliverableLink } from '@/components/DeliverableLink';
import { isUserRejection } from '@/lib/web3Errors';
import { decodeEscrowError, escrowErrorMessage, onchainStatusName } from '@/lib/escrowErrors';
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
  /** Escrow contract the order lives in (v2 or v3). */
  escrowAddress?: string | null;
  /** v3 only: when anyone can settle an open dispute with the default outcome (unix seconds). */
  disputeTimeoutAt?: number;
  txHashFunding?: string;
  txHashRelease?: string;
  deliveryHash?: string;
  deliveryUrl?: string;
  deadlineTimestamp: number;
  autoReleaseDeadline?: number;
  sellerAddress: string;
  buyerAddress: string;
  /** Funded on-chain but not yet registered with the API (see lib/pendingOrders). */
  pendingRegistration?: boolean;
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

export default function OrdersDashboardPage() {
  const { isConnected, chainId, address } = useAccount();
  const { user, isAuthenticated } = useAuth();
  const { t, L } = useLanguage();
  const [activeTab, setActiveTab] = useState<'buyer' | 'seller'>('buyer');
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
  const escrowAddress = currentEscrow(activeChainId);
  const [withdrawRefresh, setWithdrawRefresh] = useState(0);
  const isV3 = (o: MockOrder) => isV3Escrow(o.chainId ?? activeChainId, o.escrowAddress);
  // v3 credits settled funds to a withdrawable balance instead of sending them.
  const creditNote = (o: MockOrder) =>
    isV3(o)
      ? ' ' + L('El monto queda en el saldo para retirar del escrow; retíralo desde el aviso de arriba.', 'The amount is credited to the escrow balance; withdraw it from the notice above.', 'O valor fica no saldo para sacar do escrow; saque-o pelo aviso acima.')
      : '';
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();

  // Simulate every escrow write first: a revert then shows the contract's reason
  // (e.g. the order was already refunded) instead of the wallet's gas-limit error.
  const escrowWrite = async (
    params: { address: `0x${string}`; abi: typeof MarketplaceEscrowAbi; dataSuffix?: `0x${string}`; functionName: string; args: readonly unknown[] },
    order: MockOrder
  ): Promise<`0x${string}`> => {
    // Every order is acted on in the escrow it was funded in (v2 orders keep working after v3 goes live).
    params = { ...params, address: orderEscrow(order.chainId ?? activeChainId, order.escrowAddress) };
    if (publicClient) {
      try {
        await publicClient.simulateContract({ ...(params as any), account: address });
      } catch (err) {
        const decoded = decodeEscrowError(err);
        if (!decoded) throw err;
        if (decoded.name === 'InvalidStatus') {
          try {
            const onchain = (await publicClient.readContract({
              address: params.address,
              abi: MarketplaceEscrowAbi,
              functionName: 'orders',
              args: [BigInt(order.contractOrderId)],
            })) as readonly unknown[];
            const s = onchainStatusName(onchain[7]);
            if (s && s !== 'NONE' && s !== 'RESOLVED') {
              setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: s } : o)));
              setActiveDeliveryModalOrder(null);
              setActiveDisputeModalOrder(null);
            }
          } catch (readErr) {
            console.warn('Could not read the on-chain order:', readErr);
          }
        }
        throw new Error(escrowErrorMessage(decoded, L));
      }
    }
    return writeContractAsync(params as any);
  };

  // v3 timers pause with the contract: show the effective deadline, review window and dispute timeout.
  const timersKey = orders.filter((o) => isV3(o) && ['FUNDED', 'DELIVERED', 'DISPUTED'].includes(o.status)).map((o) => o.id + o.status).join(',');
  useEffect(() => {
    if (!publicClient || !timersKey) return;
    let cancelled = false;
    (async () => {
      const targets = orders.filter((o) => isV3(o) && (o.chainId ?? activeChainId) === activeChainId && ['FUNDED', 'DELIVERED', 'DISPUTED'].includes(o.status) && o.contractOrderId);
      const updates: Record<string, Partial<MockOrder>> = {};
      for (const o of targets) {
        const address = orderEscrow(activeChainId, o.escrowAddress);
        const id = [BigInt(o.contractOrderId)] as const;
        try {
          const [deadline, autoRelease, disputeTimeout] = (await Promise.all([
            publicClient.readContract({ address, abi: MarketplaceEscrowAbi, functionName: 'effectiveDeadline', args: id }),
            publicClient.readContract({ address, abi: MarketplaceEscrowAbi, functionName: 'effectiveAutoReleaseTime', args: id }),
            publicClient.readContract({ address, abi: MarketplaceEscrowAbi, functionName: 'disputeTimeoutAt', args: id }),
          ])) as bigint[];
          updates[o.id] = {
            deadlineTimestamp: Number(deadline) || o.deadlineTimestamp,
            autoReleaseDeadline: Number(autoRelease) || o.autoReleaseDeadline,
            // Without an open dispute the contract returns only the duration (14 days), not a date.
            disputeTimeoutAt: Number(disputeTimeout) > 1_000_000_000 ? Number(disputeTimeout) : undefined,
          };
        } catch (err) {
          console.warn('Could not read v3 timers:', err);
        }
      }
      if (!cancelled && Object.keys(updates).length) {
        setOrders((prev) => prev.map((o) => (updates[o.id] ? { ...o, ...updates[o.id] } : o)));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [publicClient, timersKey, activeChainId]);

  const networkName = (id?: number) => (id === CONTRACT_CONFIG.BASE_SEPOLIA_CHAIN_ID ? 'Base Sepolia' : 'Base Mainnet');
  const formatDate = (unixSeconds?: number | null) =>
    unixSeconds
      ? new Date(unixSeconds * 1000).toLocaleString(L('es-ES', 'en-US', 'pt-BR'), { dateStyle: 'medium', timeStyle: 'short' })
      : null;
  const nowSeconds = Math.floor(Date.now() / 1000);

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
      setActionNotice(`Error: ${err?.message || (L('Error al guardar la reseña', 'Could not save the review', 'Não foi possível salvar a avaliação'))}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Load orders from API and local store
  const loadOrders = useCallback(async () => {
    try {
      let apiOrders = await fetchMyOrders(undefined, address);

      // Retry the registration of orders funded from this browser that the API has not accepted yet.
      const isRegistered = (p: PendingOrder) =>
        Array.isArray(apiOrders) &&
        apiOrders.some((o: any) => o.chainId === p.chainId && Number(o.contractOrderId) === p.contractOrderId);
      const mine = loadPendingOrders().filter((p) => !address || p.buyerWallet.toLowerCase() === address.toLowerCase());
      let newlyRegistered = false;
      for (const p of mine) {
        if (isRegistered(p)) {
          removePendingOrder(p);
          continue;
        }
        if (!isAuthenticated) continue;
        try {
          await createOrder({ serviceId: p.serviceId, contractOrderId: p.contractOrderId, txHashFunding: p.txHashFunding, buyerWallet: p.buyerWallet, chainId: p.chainId });
          removePendingOrder(p);
          newlyRegistered = true;
        } catch (e) {
          console.warn('Pending order registration retry:', e);
        }
      }
      if (newlyRegistered) apiOrders = await fetchMyOrders(undefined, address);
      const pendingOrders: MockOrder[] = loadPendingOrders()
        .filter((p) => !address || p.buyerWallet.toLowerCase() === address.toLowerCase())
        .filter((p) => !isRegistered(p))
        .map((p) => ({
          id: `pending-${p.chainId}-${p.contractOrderId}`,
          contractOrderId: p.contractOrderId,
          serviceTitle: p.serviceTitle,
          role: 'buyer',
          amountUsdc: p.amountUsdc,
          sellerAmountUsdc: Number((p.amountUsdc * 0.97).toFixed(2)),
          platformFeeUsdc: Number((p.amountUsdc * 0.03).toFixed(2)),
          status: 'FUNDED',
          chainId: p.chainId,
          // Saved by the checkout; pending orders from before v3 have none and live in v2.
          escrowAddress: p.escrowAddress ?? null,
          txHashFunding: p.txHashFunding,
          deadlineTimestamp: Math.floor(p.createdAt / 1000) + p.deliveryDays * 86400,
          sellerAddress: p.sellerWallet,
          buyerAddress: p.buyerWallet,
          pendingRegistration: true,
        }));

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
            serviceTitle: bo.service?.title || (L('Servicio contratado', 'Hired service', 'Serviço contratado')),
            role: (bo.buyer?.walletAddress?.toLowerCase() === address?.toLowerCase() || (user?.id && bo.buyerId === user.id)) ? 'buyer' : 'seller',
            amountUsdc: parseFloat(bo.grossAmountUsdc),
            sellerAmountUsdc: parseFloat(bo.sellerAmountUsdc),
            platformFeeUsdc: parseFloat(bo.platformFeeUsdc),
            status: bo.status,
            chainId: bo.chainId || activeChainId,
            escrowAddress: bo.escrowAddress ?? null,
            txHashFunding: bo.txHashFunding || undefined,
            txHashRelease: bo.txHashRelease || undefined,
            deliveryHash: bo.deliveryHash,
            deliveryUrl: bo.deliveryUrl || bo.deliveryReferenceUrl || undefined,
            deadlineTimestamp: bo.deadlineTimestamp,
            autoReleaseDeadline: bo.autoReleaseDeadline,
            sellerAddress: bo.seller?.walletAddress || '',
            buyerAddress: bo.buyer?.walletAddress || address || '',
            dispute: bo.dispute || null,
            review: bo.review || null,
          };
        });
        setReviewedOrders((prev) => ({ ...loadedReviews, ...prev }));
      }

      // API orders plus the ones from this browser still waiting for registration
      const baseList = [...dynamicOrders, ...pendingOrders];
      const ordersToDisplay = baseList;

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
  }, [user?.id, address, activeChainId, L, isAuthenticated]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  // Links from the activity menu (/orders?tab=seller&order=<id>) open the right tab and order.
  const [focusOrderId, setFocusOrderId] = useState<string | null>(null);
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tab = params.get('tab');
    if (tab === 'buyer' || tab === 'seller') setActiveTab(tab);
    setFocusOrderId(params.get('order'));
  }, []);
  useEffect(() => {
    if (!focusOrderId || !orders.some((o) => o.id === focusOrderId)) return;
    setExpandedOrderId(focusOrderId);
    document.getElementById(`order-${focusOrderId}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setFocusOrderId(null);
  }, [focusOrderId, orders]);

  const filteredOrders = orders.filter((o) => o.role === activeTab);

  // Each network has its own escrow, so acting on an order while the wallet is on another network would
  // target a different contract (or a different order with the same id). Refuse and tell the user which network to use.
  const assertOrderChain = (order: { chainId?: number }) => {
    if (order.chainId && order.chainId !== activeChainId) {
      const name = order.chainId === CONTRACT_CONFIG.BASE_SEPOLIA_CHAIN_ID ? 'Base Sepolia' : 'Base Mainnet';
      throw new Error(
        L(`Esta orden está en ${name}. Cambia tu wallet a ${name} e inténtalo de nuevo.`, `This order lives on ${name}. Switch your wallet to ${name} and try again.`, `Este pedido está na ${name}. Mude sua carteira para a ${name} e tente novamente.`)
      );
    }
  };

  // Buyer Action: Approve delivery and release funds
  const handleApproveDelivery = async (order: MockOrder) => {
    try {
      assertOrderChain(order);
      setIsProcessing(true);
      setActionNotice(L(`Aprobando la entrega de la orden #${order.contractOrderId}...`, `Approving delivery of order #${order.contractOrderId}...`, `Aprovando a entrega do pedido #${order.contractOrderId}...`));

      let txHash: `0x${string}`;

      if (isConnected && escrowAddress && escrowAddress !== '0x0000000000000000000000000000000000000000') {
        txHash = await escrowWrite({
          address: escrowAddress,
          abi: MarketplaceEscrowAbi,
          dataSuffix: BUILDER_DATA_SUFFIX,
          functionName: 'approveDelivery',
          args: [BigInt(order.contractOrderId)],
        }, order);
        txHash = await confirmTx(publicClient, txHash);
      } else {
        throw new Error(L('Conecta tu wallet para enviar esta transacción on-chain.', 'Connect your wallet to send this on-chain transaction.', 'Conecte sua carteira para enviar esta transação on-chain.'));
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
      setActionNotice(L(`¡Orden #${order.contractOrderId} aprobada! Fondos liberados al vendedor.`, `Order #${order.contractOrderId} approved. Funds released to the seller.`, `Pedido #${order.contractOrderId} aprovado! Fundos liberados para o vendedor.`));
      setWithdrawRefresh((n) => n + 1);
    } catch (err: any) {
      if (isUserRejection(err)) {
        setActionNotice(L('Operación cancelada en tu wallet.', 'Operation cancelled in your wallet.', 'Operação cancelada na sua carteira.'));
      } else {
        console.error(err);
        setActionNotice(`Error: ${err?.shortMessage || err?.message || (L('Error en la transacción', 'Transaction error', 'Erro na transação'))}`);
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
      assertOrderChain(activeDisputeModalOrder);
      setIsProcessing(true);
      setActionNotice(L(`Abriendo una disputa para la orden #${activeDisputeModalOrder.contractOrderId}...`, `Opening a dispute for order #${activeDisputeModalOrder.contractOrderId}...`, `Abrindo uma disputa para o pedido #${activeDisputeModalOrder.contractOrderId}...`));

      let disputeTxHash: `0x${string}`;

      if (isConnected && escrowAddress && escrowAddress !== '0x0000000000000000000000000000000000000000') {
        disputeTxHash = await escrowWrite({
          address: escrowAddress,
          abi: MarketplaceEscrowAbi,
          dataSuffix: BUILDER_DATA_SUFFIX,
          functionName: 'openDispute',
          args: [BigInt(activeDisputeModalOrder.contractOrderId)],
        }, activeDisputeModalOrder);
        disputeTxHash = await confirmTx(publicClient, disputeTxHash);
      } else {
        throw new Error(L('Conecta tu wallet para enviar esta transacción on-chain.', 'Connect your wallet to send this on-chain transaction.', 'Conecte sua carteira para enviar esta transação on-chain.'));
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

      setActionNotice(L(`Disputa abierta para la orden #${activeDisputeModalOrder.contractOrderId}. Los fondos quedan congelados en el escrow hasta que decida el árbitro.`, `Dispute opened for order #${activeDisputeModalOrder.contractOrderId}. The funds stay frozen in escrow until the arbitrator decides.`, `Disputa aberta para o pedido #${activeDisputeModalOrder.contractOrderId}. Os fundos ficam congelados no escrow até a decisão do árbitro.`));
      setActiveDisputeModalOrder(null);
    } catch (err: any) {
      if (isUserRejection(err)) {
        setActionNotice(L('Operación cancelada en tu wallet.', 'Operation cancelled in your wallet.', 'Operação cancelada na sua carteira.'));
      } else {
        console.error(err);
        setActionNotice(`Error: ${err?.shortMessage || err?.message || (L('Error al abrir la disputa', 'Could not open the dispute', 'Não foi possível abrir a disputa'))}`);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // Buyer Action: Claim timeout refund
  const handleClaimRefund = async (order: MockOrder) => {
    try {
      assertOrderChain(order);
      setIsProcessing(true);
      setActionNotice(L(`Reclamando el reembolso de la orden #${order.contractOrderId}...`, `Claiming the refund for order #${order.contractOrderId}...`, `Solicitando o reembolso do pedido #${order.contractOrderId}...`));

      let refundTx: `0x${string}`;
      if (isConnected && escrowAddress && escrowAddress !== '0x0000000000000000000000000000000000000000') {
        refundTx = await escrowWrite({
          address: escrowAddress,
          abi: MarketplaceEscrowAbi,
          dataSuffix: BUILDER_DATA_SUFFIX,
          functionName: 'claimTimeoutRefund',
          args: [BigInt(order.contractOrderId)],
        }, order);
      } else {
        throw new Error(L('Conecta tu wallet para enviar esta transacción on-chain.', 'Connect your wallet to send this on-chain transaction.', 'Conecte sua carteira para enviar esta transação on-chain.'));
      }

      // The API records the refund once the contract shows it; the indexer stays as a backup.
      await confirmTx(publicClient, refundTx);
      try {
        await updateOrder(order.id, { status: 'REFUNDED' });
      } catch (err) {
        console.warn('Backend sync note:', err);
        await syncChain(activeChainId);
      }

      setOrders((prev) =>
        prev.map((o) => (o.id === order.id ? { ...o, status: 'REFUNDED' } : o))
      );
      setActionNotice(
        isV3(order)
          ? L('El monto íntegro quedó acreditado a tu favor en el escrow.', 'The full amount was credited to you in the escrow.', 'O valor total foi creditado a você no escrow.') + creditNote(order)
          : L('El monto íntegro se reembolsó a tu wallet.', 'The full amount was refunded to your wallet.', 'O valor total foi reembolsado para sua carteira.')
      );
      setWithdrawRefresh((n) => n + 1);
    } catch (err: any) {
      if (isUserRejection(err)) {
        setActionNotice(L('Operación cancelada en tu wallet.', 'Operation cancelled in your wallet.', 'Operação cancelada na sua carteira.'));
      } else {
        console.error(err);
        setActionNotice(`Error: ${err?.shortMessage || err?.message || (L('Error en la transacción', 'Transaction error', 'Erro na transação'))}`);
      }
    } finally {
      setIsProcessing(false);
    }
  };


  // Seller Action: claim the payment once the review window has passed without approval or dispute
  const handleClaimPayment = async (order: MockOrder) => {
    try {
      assertOrderChain(order);
      setIsProcessing(true);
      setActionNotice(L(`Cobrando el pago de la orden #${order.contractOrderId}...`, `Claiming payment for order #${order.contractOrderId}...`, `Recebendo o pagamento do pedido #${order.contractOrderId}...`));

      if (!isConnected || !escrowAddress || escrowAddress === '0x0000000000000000000000000000000000000000') {
        throw new Error(L('Conecta tu wallet para enviar esta transacción on-chain.', 'Connect your wallet to send this on-chain transaction.', 'Conecte sua carteira para enviar esta transação on-chain.'));
      }
      const txHash = await escrowWrite({
        address: escrowAddress,
        abi: MarketplaceEscrowAbi,
        dataSuffix: BUILDER_DATA_SUFFIX,
        functionName: 'claimAutoRelease',
        args: [BigInt(order.contractOrderId)],
      }, order);

      const landedTx = await confirmTx(publicClient, txHash);
      try {
        await updateOrder(order.id, { status: 'RELEASED', txHashRelease: landedTx });
      } catch (err) {
        console.warn('Backend sync note:', err);
        await syncChain(activeChainId);
      }

      setOrders((prev) => prev.map((o) => (o.id === order.id ? { ...o, status: 'RELEASED' } : o)));
      setActionNotice(
        isV3(order)
          ? L(`Pago cobrado: ${order.sellerAmountUsdc} USDC acreditados a tu favor.`, `Payment claimed: ${order.sellerAmountUsdc} USDC credited to you.`, `Pagamento recebido: ${order.sellerAmountUsdc} USDC creditados a você.`) + creditNote(order)
          : L(`Pago cobrado: ${order.sellerAmountUsdc} USDC enviados a tu wallet.`, `Payment received: ${order.sellerAmountUsdc} USDC sent to your wallet.`, `Pagamento recebido: ${order.sellerAmountUsdc} USDC enviados para sua carteira.`)
      );
      setWithdrawRefresh((n) => n + 1);
    } catch (err: any) {
      if (isUserRejection(err)) {
        setActionNotice(L('Operación cancelada en tu wallet.', 'Operation cancelled in your wallet.', 'Operação cancelada na sua carteira.'));
      } else {
        console.error(err);
        setActionNotice(`Error: ${err?.shortMessage || err?.message || (L('Error en la transacción', 'Transaction error', 'Erro na transação'))}`);
      }
    } finally {
      setIsProcessing(false);
    }
  };

  // v3: anyone can settle a dispute the arbitrator left open for 14 days. Default outcome: seller paid if the
  // delivery was recorded, buyer refunded if not.
  const handleClaimDisputeTimeout = async (order: MockOrder) => {
    try {
      assertOrderChain(order);
      setIsProcessing(true);
      setActionNotice(L(`Cerrando la disputa de la orden #${order.contractOrderId}...`, `Closing the dispute of order #${order.contractOrderId}...`, `Encerrando a disputa do pedido #${order.contractOrderId}...`));
      const txHash = await escrowWrite(
        { address: escrowAddress, abi: MarketplaceEscrowAbi, dataSuffix: BUILDER_DATA_SUFFIX, functionName: 'claimDisputeTimeout', args: [BigInt(order.contractOrderId)] },
        order
      );
      await confirmTx(publicClient, txHash);
      try {
        await syncChain(order.chainId ?? activeChainId);
      } catch (err) {
        console.warn('Sync note:', err);
      }
      setActionNotice(
        L('Disputa cerrada con el resultado por defecto: cobra quien vende si registró la entrega; si no, se reembolsa a quien compra.', 'Dispute closed with the default outcome: the seller is paid if the delivery was recorded; otherwise the buyer is refunded.', 'Disputa encerrada com o resultado padrão: quem vende recebe se registrou a entrega; caso contrário, quem compra é reembolsado.') + creditNote(order)
      );
      setWithdrawRefresh((n) => n + 1);
      await loadOrders();
    } catch (err: any) {
      if (isUserRejection(err)) {
        setActionNotice(L('Operación cancelada en tu wallet.', 'Operation cancelled in your wallet.', 'Operação cancelada na sua carteira.'));
      } else {
        console.error(err);
        setActionNotice(`Error: ${err?.shortMessage || err?.message || (L('Error en la transacción', 'Transaction error', 'Erro na transação'))}`);
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
    if (file.size === 0) {
      setUploadError(L('El archivo está vacío. Elige el archivo con el trabajo entregado.', 'The file is empty. Choose the file with the delivered work.', 'O arquivo está vazio. Escolha o arquivo com o trabalho entregue.'));
      return;
    }

    try {
      setIsUploading(true);
      setUploadError(null);

      const data = await uploadDeliverable(file);

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
      setUploadError(err.message || (L('No se pudo subir el archivo', 'The file could not be uploaded', 'Não foi possível enviar o arquivo')));
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
      assertOrderChain(activeDeliveryModalOrder);
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
        txHash = await escrowWrite({
          address: escrowAddress,
          abi: MarketplaceEscrowAbi,
          dataSuffix: BUILDER_DATA_SUFFIX,
          functionName: 'submitDelivery',
          args: [BigInt(activeDeliveryModalOrder.contractOrderId), finalHash as `0x${string}`],
        }, activeDeliveryModalOrder);
        txHash = await confirmTx(publicClient, txHash);
      } else {
        throw new Error(L('Conecta tu wallet para enviar esta transacción on-chain.', 'Connect your wallet to send this on-chain transaction.', 'Conecte sua carteira para enviar esta transação on-chain.'));
      }

      const deliveredDuringDispute = activeDeliveryModalOrder.status === 'DISPUTED';
      try {
        // v3: a delivery during a dispute opened before delivery keeps the order in dispute; the indexer records it.
        if (deliveredDuringDispute) throw new Error('delivered during dispute');
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
                status: deliveredDuringDispute ? 'DISPUTED' : 'DELIVERED',
                deliveryUrl: deliveryInputUrl,
                deliveryHash: finalHash,
                autoReleaseDeadline: Math.floor(Date.now() / 1000) + 86400 * 5,
              }
            : o
        )
      );

      setActionNotice(L(`¡Entrega registrada! El hash ${finalHash.slice(0, 10)}...${finalHash.slice(-6)} quedó guardado en el contrato.`, `Delivery recorded. Hash ${finalHash.slice(0, 10)}...${finalHash.slice(-6)} is stored in the contract.`, `Entrega registrada! O hash ${finalHash.slice(0, 10)}...${finalHash.slice(-6)} ficou salvo no contrato.`));
      setActiveDeliveryModalOrder(null);
      setDeliveryInputUrl('');
      setDeliveryHash('');
      setUploadedFileMeta(null);
    } catch (err: any) {
      if (isUserRejection(err)) {
        setActionNotice(L('Operación cancelada en tu wallet.', 'Operation cancelled in your wallet.', 'Operação cancelada na sua carteira.'));
      } else {
        console.error(err);
        setActionNotice(`Error: ${err?.shortMessage || err?.message || (L('Error en la transacción', 'Transaction error', 'Erro na transação'))}`);
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
            title={L('Actualizar órdenes', 'Refresh orders', 'Atualizar pedidos')}
          >
            <RefreshCw className="h-4 w-4 text-primary-light" />
            <span className="hidden sm:inline">{t('refresh')}</span>
          </button>

          <button
            onClick={() => {
              if (typeof window !== 'undefined') {
                clearPendingOrders();
                loadOrders();
                setActionNotice(L('Caché local de órdenes eliminada.', 'Local orders cache cleared.', 'Cache local de pedidos apagado.'));
              }
            }}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3 py-2.5 text-xs font-semibold text-slate-400 transition hover:bg-surface-elevated hover:text-white sm:py-2"
            title={L('Limpiar la caché local de órdenes de este navegador', "Clear this browser's local order cache", 'Limpar o cache local de pedidos deste navegador')}
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
      {/* v3: settled funds wait in the escrow until withdrawn (buyers, sellers and the fee recipient) */}
      <WithdrawPanel refreshKey={withdrawRefresh} />

      {actionNotice && (
        <div className="mt-6 flex items-center justify-between rounded-xl border border-primary/30 bg-primary/10 p-4 text-sm text-primary-light">
          <span>{actionNotice}</span>
          <button
            onClick={() => setActionNotice(null)}
            className="text-xs font-semibold text-slate-400 hover:text-white"
          >
            {L('Cerrar', 'Close', 'Fechar')}
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
              id={`order-${order.id}`}
              className="scroll-mt-24 overflow-hidden rounded-2xl border border-border bg-surface p-6 transition hover:border-slate-600"
            >
              <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center">
                {/* Order info */}
                <div className="max-w-xl">
                  <div className="flex items-center gap-3">
                    <span className="rounded bg-surface-elevated px-2 py-0.5 text-xs font-mono text-slate-300">
                      {L('Orden', 'Order', 'Pedido')} #{order.contractOrderId} · {networkName(order.chainId)}
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
                      <span>{L('Entregable:', 'Deliverable:', 'Entregável:')} </span>
                      <DeliverableLink
                        orderId={order.id}
                        reference={order.deliveryUrl}
                        className="font-mono text-primary-light hover:underline"
                      />
                    </div>
                  )}

                  {order.deliveryHash && (
                    <p className="mt-1 text-xs font-mono text-slate-500 truncate max-w-md">
                      {L('Hash on-chain:', 'On-chain hash:', 'Hash on-chain:')} {order.deliveryHash}
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
                      ? (L(`Neto a recibir: ${order.sellerAmountUsdc} USDC (3% de comisión descontado)`, `Net to receive: ${order.sellerAmountUsdc} USDC (3% fee deducted)`, `Líquido a receber: ${order.sellerAmountUsdc} USDC (taxa de 3% descontada)`))
                      : (L('0% de comisión para el comprador', '0% fee for the buyer', '0% de taxa para quem compra'))}
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
                        {order.dispute?.status === 'RESOLVED' ? t('disputeTitleResolved') : t('disputeTitleOpen')}
                      </span>
                    </div>
                    <span
                      className={`rounded px-2.5 py-0.5 text-[11px] font-bold ${
                        order.dispute?.status === 'RESOLVED'
                          ? 'bg-accent/20 text-accent'
                          : 'bg-red-500/20 text-red-300'
                      }`}
                    >
                      {order.dispute?.status === 'RESOLVED' ? t('disputeBadgeResolved') : t('disputeBadgeOpen')}
                    </span>
                  </div>

                  {order.dispute?.reason && (
                    <div className="mt-2.5 text-slate-300">
                      <strong className="text-red-300">{t('disputeReasonLabel')}: </strong>
                      <span>{order.dispute.reason}</span>
                    </div>
                  )}

                  {order.dispute?.evidenceUrl && (
                    <div className="mt-1.5 text-slate-400">
                      <span>{t('disputeEvidenceLabel')}: </span>
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
                        {t('disputeResolvedNotice')}:{' '}
                        {L(`${order.dispute.sellerAwardUsdc} USDC asignados al vendedor / ${order.dispute.buyerRefundUsdc} USDC reembolsados al comprador.`, `${order.dispute.sellerAwardUsdc} USDC awarded to the seller / ${order.dispute.buyerRefundUsdc} USDC refunded to the buyer.`, `${order.dispute.sellerAwardUsdc} USDC para o vendedor / ${order.dispute.buyerRefundUsdc} USDC reembolsados ao comprador.`)}
                      </p>
                      {order.dispute.resolutionNotes && (
                        <p className="mt-1.5 text-xs text-slate-300">
                          <strong className="text-slate-400">{t('disputeArbitratorNotes')}: </strong>
                          {order.dispute.resolutionNotes}
                        </p>
                      )}
                    </div>
                  ) : (
                    <p className="mt-2 text-[11px] text-slate-400 leading-relaxed">
                      {t('disputeUnderReviewNotice').replace('{network}', networkName(order.chainId))}
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
                      {!order.autoReleaseDeadline
                        ? t('autoReleaseNoticeNoDate')
                        : nowSeconds >= order.autoReleaseDeadline
                        ? t('buyerReviewOver')
                        : t('autoReleaseNotice').replace('{date}', formatDate(order.autoReleaseDeadline)!)}
                    </span>
                  </>
                )}

                {order.role === 'buyer' && order.status === 'FUNDED' && (
                  <div className="flex w-full flex-wrap items-center justify-between gap-3">
                    <span className="text-xs text-slate-400">
                      {t('sellerWorkingNotice').replace('{date}', formatDate(order.deadlineTimestamp) || '—')}
                    </span>
                    <button
                      onClick={() => handleOpenDispute(order)}
                      disabled={isProcessing}
                      className="rounded-lg border border-red-500/30 px-3 py-2.5 text-xs font-semibold text-red-300 hover:bg-red-500/10 sm:py-1.5"
                    >
                      {t('openDispute')}
                    </button>
                    <button
                      onClick={() => handleClaimRefund(order)}
                      disabled={isProcessing || nowSeconds <= order.deadlineTimestamp}
                      title={nowSeconds <= order.deadlineTimestamp ? t('refundNotYet') : undefined}
                      className="rounded-lg border border-border px-3 py-2.5 text-xs font-semibold text-slate-400 hover:text-white disabled:cursor-not-allowed disabled:opacity-50 disabled:hover:text-slate-400 sm:py-1.5"
                    >
                      {t('claimRefund')}
                    </button>
                  </div>
                )}

                {/* Seller Controls */}
                {order.role === 'seller' &&
                  (order.status === 'FUNDED' || (order.status === 'DISPUTED' && isV3(order) && !order.deliveryHash)) &&
                  (isV3(order) && nowSeconds > order.deadlineTimestamp ? (
                    <span className="text-xs text-slate-400">
                      {L('El plazo de entrega venció: el contrato ya no acepta la entrega, salvo que quien compra extienda el plazo.', 'The delivery deadline has passed: the contract no longer accepts the delivery unless the buyer extends the deadline.', 'O prazo de entrega venceu: o contrato não aceita mais a entrega, a menos que quem compra estenda o prazo.')}
                    </span>
                  ) : (
                    <button
                      onClick={() => openDeliveryModal(order)}
                      disabled={isProcessing}
                      className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white shadow-md shadow-primary/20 transition hover:bg-primary-hover active:scale-95"
                    >
                      {t('submitDelivery')}
                    </button>
                  ))}

                {/* v3: an open dispute the arbitrator has not resolved can be closed with the default outcome after 14 days */}
                {order.status === 'DISPUTED' && isV3(order) && order.dispute?.status !== 'RESOLVED' && order.disputeTimeoutAt && (
                  <div className="flex w-full flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
                    <span>
                      {nowSeconds >= order.disputeTimeoutAt && !order.deliveryHash && nowSeconds <= order.deadlineTimestamp
                        ? L(`El árbitro no resolvió en 14 días. Como no hubo entrega, la disputa se podrá cerrar con reembolso a quien compra cuando venza el plazo de entrega (${formatDate(order.deadlineTimestamp)}).`, `The arbitrator did not rule within 14 days. As there was no delivery, the dispute can be closed with a refund to the buyer once the delivery deadline passes (${formatDate(order.deadlineTimestamp)}).`, `O árbitro não decidiu em 14 dias. Como não houve entrega, a disputa poderá ser encerrada com reembolso a quem compra quando o prazo de entrega vencer (${formatDate(order.deadlineTimestamp)}).`)
                        : nowSeconds >= order.disputeTimeoutAt
                        ? L('El árbitro no resolvió en 14 días: cualquiera de las partes puede cerrar la disputa con el resultado por defecto.', 'The arbitrator did not rule within 14 days: either party can close the dispute with the default outcome.', 'O árbitro não decidiu em 14 dias: qualquer parte pode encerrar a disputa com o resultado padrão.')
                        : L(`Si el árbitro no resuelve antes del ${formatDate(order.disputeTimeoutAt)}, la disputa se podrá cerrar con el resultado por defecto.`, `If the arbitrator has not ruled by ${formatDate(order.disputeTimeoutAt)}, the dispute can be closed with the default outcome.`, `Se o árbitro não decidir até ${formatDate(order.disputeTimeoutAt)}, a disputa poderá ser encerrada com o resultado padrão.`)}
                    </span>
                    {nowSeconds >= order.disputeTimeoutAt && (!!order.deliveryHash || nowSeconds > order.deadlineTimestamp) && (
                      <button
                        onClick={() => handleClaimDisputeTimeout(order)}
                        disabled={isProcessing}
                        className="rounded-xl border border-border px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-surface-elevated disabled:opacity-50"
                      >
                        {L('Cerrar la disputa', 'Close the dispute', 'Encerrar a disputa')}
                      </button>
                    )}
                  </div>
                )}

                {order.role === 'seller' && order.status === 'DELIVERED' && (
                  <div className="flex w-full flex-wrap items-center justify-between gap-3 text-xs text-slate-400">
                    <span>
                      {!order.autoReleaseDeadline
                        ? t('sellerDeliveredNoticeNoDate')
                        : nowSeconds >= order.autoReleaseDeadline
                        ? t('sellerCanClaimNow')
                        : t('sellerDeliveredNotice').replace('{date}', formatDate(order.autoReleaseDeadline)!)}
                    </span>
                    {(() => {
                      // Without a known release time the contract decides; it reverts if the window is still open.
                      const notYet = !!order.autoReleaseDeadline && nowSeconds < order.autoReleaseDeadline;
                      return (
                        <button
                          onClick={() => handleClaimPayment(order)}
                          disabled={isProcessing || notYet}
                          title={notYet ? t('paymentNotYet') : undefined}
                          className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-background transition hover:bg-accent/90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {t('claimPayment')}
                        </button>
                      );
                    })()}
                  </div>
                )}

                {order.status === 'RELEASED' && (
                  <div className="flex flex-wrap items-center justify-between w-full gap-3">
                    <span className="text-xs text-accent font-semibold flex items-center gap-1.5">
                      <CheckCircle className="h-4 w-4" /> {t('contractFinalized')}
                    </span>

                    {order.role === 'buyer' && (
                      (reviewedOrders[order.id] || order.review) ? (
                        <div className="flex min-w-0 max-w-full flex-col items-end gap-1">
                          <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-400/10 px-3 py-1 text-xs font-semibold text-amber-300">
                            <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                            {t('serviceRated')} ({reviewedOrders[order.id] || order.review?.rating || 5} / 5 ★)
                          </span>
                          {(order.review?.comment || (reviewedOrders[order.id] && reviewComment)) && (
                            <span className="block max-w-full text-[11px] text-slate-400 italic sm:max-w-xs text-right truncate">
                              &ldquo;{order.review?.comment || reviewComment}&rdquo;
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
                      <div className="flex min-w-0 max-w-full flex-col items-end gap-1">
                        <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-400/10 px-3 py-1 text-xs font-semibold text-emerald-300">
                          <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                          {t('receivedReview')}: {order.review?.rating || reviewedOrders[order.id] || 5} / 5 ★
                        </span>
                        {order.review?.comment && (
                          <span className="block max-w-full text-[11px] text-slate-400 italic sm:max-w-xs text-right truncate">
                            &ldquo;{order.review.comment}&rdquo;
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
                  className="inline-flex min-h-10 items-center gap-1.5 text-xs font-semibold text-cyan-400 hover:text-cyan-300 transition sm:min-h-0"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span>
                    {expandedOrderId === order.id ? t('hideTimelineAndChat') : t('viewTimelineAndChat')}
                  </span>
                  {expandedOrderId === order.id ? (
                    <ChevronUp className="h-3.5 w-3.5" />
                  ) : (
                    <ChevronDown className="h-3.5 w-3.5" />
                  )}
                </button>

                <span className="text-[11px] text-slate-400 font-mono flex items-center gap-1">
                  {order.status === 'DELIVERED' && !(order.autoReleaseDeadline && nowSeconds >= order.autoReleaseDeadline) ? (
                    <span className="text-amber-300">⏱️ {L('Período de revisión en curso', 'Review period running', 'Período de revisão em andamento')}</span>
                  ) : (
                    <span className="text-slate-400">🛡️ {L('Protegido por escrow', 'Protected by escrow', 'Protegido por escrow')}</span>
                  )}
                </span>
              </div>

              {/* Collapsible Timeline and Chat */}
              {order.pendingRegistration && (
                <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-200">
                  {L('Pago confirmado on-chain. Todavía estamos vinculando esta orden con su publicación; se reintenta sola cada vez que abres Mis Órdenes con la sesión iniciada. Los mensajes aparecen cuando quede vinculada. Tus fondos están seguros en el escrow.', 'Payment confirmed on-chain. We are still linking this order to its listing; it retries automatically each time you open My Orders while signed in. Messages appear once it is linked. Your funds are safe in the escrow.', 'Pagamento confirmado on-chain. Ainda estamos vinculando este pedido ao anúncio; isso é tentado de novo a cada vez que você abre Meus Pedidos com a sessão iniciada. As mensagens aparecem quando estiver vinculado. Seus fundos estão seguros no escrow.')}
                </p>
              )}
              {expandedOrderId === order.id && !order.pendingRegistration && <OrderTimelineAndChat order={order} />}
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
                  {t('exploreServices')} <ArrowRight className="h-4 w-4" />
                </Link>
              ) : (
                <Link
                  href="/services/new"
                  className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary/20 transition hover:bg-primary-hover active:scale-95"
                >
                  {t('postService')} <ArrowRight className="h-4 w-4" />
                </Link>
              )}
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
                  <h3 className="text-lg font-bold text-white">{t('submitDelivery')}</h3>
                  <p className="text-xs text-slate-400">{L('Orden', 'Order', 'Pedido')} #{activeDeliveryModalOrder.contractOrderId} • {activeDeliveryModalOrder.serviceTitle}</p>
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
                {L('Subir archivo', 'Upload file', 'Enviar arquivo')}
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
                {L('Enlace externo', 'External link', 'Link externo')}
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
                            <p className="text-xs font-semibold text-white">{L('Subiendo...', 'Uploading...', 'Enviando...')}</p>
                            <p className="text-[11px] text-slate-400">{L('Calculando el hash SHA-256', 'Computing the SHA-256 hash', 'Calculando o hash SHA-256')}</p>
                          </div>
                        ) : (
                          <div className="flex flex-col items-center gap-2">
                            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-purple-500/10 text-purple-400">
                              <Upload className="h-6 w-6" />
                            </div>
                            <p className="text-sm font-semibold text-white">
                              {L('Haz clic para elegir tu archivo de entrega', 'Click to choose your delivery file', 'Clique para escolher o arquivo da entrega')}
                            </p>
                            <p className="text-xs text-slate-400">
                              {L('.zip, .pdf, .sol, imágenes, videos o documentos (hasta 25 MB)', '.zip, .pdf, .sol, images, videos or documents (up to 25 MB)', '.zip, .pdf, .sol, imagens, vídeos ou documentos (até 25 MB)')}
                            </p>
                            <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-purple-500/10 px-2.5 py-0.5 text-[10px] font-semibold text-purple-300">
                              🔒 {L('Almacenamiento privado', 'Private storage', 'Armazenamento privado')}
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
                              {(uploadedFileMeta.size / 1024).toFixed(1)} KB • {L('Almacenamiento privado', 'Private storage', 'Armazenamento privado')}
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
                          {L('Cambiar', 'Change', 'Trocar')}
                        </button>
                      </div>

                      {/* Hash Box */}
                      <div className="rounded-lg bg-black/40 p-2.5 font-mono text-[11px] border border-border/40">
                        <div className="flex items-center justify-between text-slate-400 text-[10px] uppercase font-bold mb-1">
                          <span className="flex items-center gap-1 text-purple-400">
                            <Hash className="h-3 w-3" /> {L('Prueba criptográfica SHA-256', 'SHA-256 proof', 'Prova criptográfica SHA-256')}
                          </span>
                          <button
                            type="button"
                            onClick={() => copyToClipboard(uploadedFileMeta.hash)}
                            className="flex items-center gap-1 text-cyan-400 hover:text-cyan-300"
                          >
                            {copiedHash ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                            {copiedHash ? (L('Copiado', 'Copied', 'Copiado')) : (L('Copiar', 'Copy', 'Copiar'))}
                          </button>
                        </div>
                        <p className="text-white font-mono break-all select-all">{uploadedFileMeta.hash}</p>
                      </div>

                      <p className="text-[11px] text-slate-400">
                        {L('Archivo privado: solo el comprador, tú y el árbitro podrán descargarlo.', 'Private file: only the buyer, you and the arbitrator can download it.', 'Arquivo privado: só o comprador, você e o árbitro podem baixá-lo.')}
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-slate-300">
                    {L('Enlace al entregable (GitHub, Drive, Figma, IPFS, etc.)', 'Link to the deliverable (GitHub, Drive, Figma, IPFS, etc.)', 'Link para o entregável (GitHub, Drive, Figma, IPFS etc.)')}
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
                    {L('Se registrará en el smart contract un hash SHA-256 de este enlace (no de su contenido). Enlaza una versión fija, como un commit o release de Git o un CID de IPFS, para que el comprador sepa que no cambiará.', 'A SHA-256 hash of this link (not of its content) will be recorded in the smart contract. Link to a fixed version, such as a Git commit or release or an IPFS CID, so the buyer can trust it will not change.', 'Será registrado no smart contract um hash SHA-256 deste link (não do conteúdo). Use um link para uma versão fixa, como um commit ou release do Git ou um CID do IPFS, para que o comprador saiba que não vai mudar.')}
                  </p>
                </div>
              )}

              <div className="rounded-xl bg-surface-elevated/70 border border-border/50 p-3 text-xs text-slate-300 space-y-1">
                <p className="font-semibold text-white flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-accent" /> {L('Qué pasa después', 'What happens next', 'O que acontece depois')}
                </p>
                <p className="text-[11px] text-slate-400 leading-relaxed">
                  {L(`La orden pasará a ENTREGADA con el hash registrado en ${networkName(activeDeliveryModalOrder.chainId ?? activeChainId)}. El comprador tendrá 5 días para aprobarla o abrir una disputa; después podrás cobrar.`, `The order becomes DELIVERED with the hash recorded on ${networkName(activeDeliveryModalOrder.chainId ?? activeChainId)}. The buyer has 5 days to approve it or open a dispute; after that you can claim the payment.`, `O pedido passa para ENTREGUE com o hash registrado na ${networkName(activeDeliveryModalOrder.chainId ?? activeChainId)}. O comprador terá 5 dias para aprovar ou abrir uma disputa; depois disso você pode receber.`)}
                </p>
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => setActiveDeliveryModalOrder(null)}
                  className="flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold text-slate-400 hover:text-white"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isProcessing || isUploading || !deliveryInputUrl}
                  className="flex-1 rounded-xl bg-primary py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary/20 transition hover:bg-primary-hover active:scale-95 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      <span>{L('Registrando on-chain...', 'Recording on-chain...', 'Registrando on-chain...')}</span>
                    </>
                  ) : (
                    <span>{L('Confirmar entrega', 'Confirm delivery', 'Confirmar entrega')}</span>
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
                  {t('modalDisputeTitle')} #{activeDisputeModalOrder.contractOrderId}
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
              {t('modalDisputeDesc')}
            </p>

            <form onSubmit={handleConfirmDispute} className="mt-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-300">
                  {t('modalDisputeReasonLabel')} <span className="text-red-400">*</span>
                </label>
                <textarea
                  required
                  rows={3}
                  placeholder={t('modalDisputeReasonPlaceholder')}
                  value={disputeReason}
                  onChange={(e) => setDisputeReason(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-border bg-background p-3 text-xs text-white placeholder-slate-500 focus:border-red-400 focus:outline-none"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-300">
                  {t('modalDisputeEvidenceLabel')}
                </label>
                <input
                  type="url"
                  placeholder={L('https://github.com/... o https://drive.google.com/...', 'https://github.com/... or https://drive.google.com/...', 'https://github.com/... ou https://drive.google.com/...')}
                  value={disputeEvidenceUrl}
                  onChange={(e) => setDisputeEvidenceUrl(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-border bg-background p-2.5 text-xs text-white placeholder-slate-500 focus:border-red-400 focus:outline-none"
                />
              </div>

              <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3 text-[11px] text-red-300">
                {t('modalDisputeNotice')}
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setActiveDisputeModalOrder(null)}
                  className="flex-1 rounded-xl border border-border py-2.5 text-sm font-semibold text-slate-400 hover:text-white"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={isProcessing || !disputeReason.trim()}
                  className="flex-1 rounded-xl bg-red-500 py-2.5 text-sm font-bold text-white shadow-lg shadow-red-500/20 transition hover:bg-red-600 active:scale-95 disabled:opacity-50"
                >
                  {isProcessing ? t('freezingEscrow') : t('confirmAndFreeze')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
