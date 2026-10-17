'use client';

import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { getAuthToken } from '@/lib/api';
import { useLanguage } from '@/lib/languageContext';
import { DeliverableLink } from '@/components/DeliverableLink';
import {
  CheckCircle2,
  ExternalLink,
  Send,
  MessageSquare,
  ShieldCheck,
  FileCheck,
  RotateCcw,
  Timer
} from 'lucide-react';

interface OrderTimelineAndChatProps {
  order: {
    id: string;
    contractOrderId: number;
    status: 'CREATED' | 'FUNDED' | 'DELIVERED' | 'RELEASED' | 'REFUNDED' | 'DISPUTED';
    chainId?: number;
    amountUsdc: number;
    sellerAmountUsdc: number;
    platformFeeUsdc: number;
    deliveryUrl?: string;
    deliveryHash?: string;
    autoReleaseDeadline?: number;
    txHashFunding?: string;
    txHashRelease?: string;
    sellerAddress: string;
    buyerAddress: string;
    role: 'buyer' | 'seller';
  };
}

interface Message {
  id: string;
  senderId: string;
  content: string;
  createdAt: string;
  sender?: {
    displayName?: string;
    username?: string;
    walletAddress?: string;
  };
}

export function OrderTimelineAndChat({ order }: OrderTimelineAndChatProps) {
  const { address } = useAccount();
  const { L } = useLanguage();
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [timeLeft, setTimeLeft] = useState<string>('');

  const isSepolia = order.chainId === 84532;
  const networkName = isSepolia ? 'Base Sepolia' : 'Base Mainnet';
  const explorerBaseUrl = isSepolia ? 'https://sepolia.basescan.org' : 'https://basescan.org';

  // Real on-chain transactions from the order record
  const fundingTx = order.txHashFunding || null;
  const releaseTx = order.txHashRelease || null;
  const isDelivered = order.status === 'DELIVERED' || order.status === 'RELEASED';

  // Countdown to the moment the seller can claim the payment (only when the contract time is known)
  useEffect(() => {
    if (order.status !== 'DELIVERED' || !order.autoReleaseDeadline) {
      setTimeLeft('');
      return;
    }

    const targetTimestamp = order.autoReleaseDeadline * 1000;

    const updateTimer = () => {
      const diff = targetTimestamp - Date.now();

      if (diff <= 0) {
        setTimeLeft(L('Revisión vencida: el vendedor ya puede cobrar', 'Review period over: the seller can claim the payment', 'Revisão encerrada: o vendedor já pode receber'));
        return;
      }

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      setTimeLeft(`${days}d ${hours}h ${minutes}m ${seconds}s`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [order.status, order.autoReleaseDeadline, L]);

  // Load order messages
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const token = getAuthToken();
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch(`/api/orders/${order.id}/messages`, { headers });
        if (res.ok) {
          const data = await res.json();
          setMessages(Array.isArray(data.messages) ? data.messages : []);
        }
      } catch (err) {
        console.warn('Could not fetch messages:', err);
      }
    };

    fetchMessages();
  }, [order.id]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || isSending) return;

    const messageText = newMessage.trim();
    setIsSending(true);
    setSendError(null);

    try {
      const token = getAuthToken();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch(`/api/orders/${order.id}/messages`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ content: messageText }),
      });

      if (!res.ok) {
        // Keep the text so the user can retry; never show a message the server did not store.
        setSendError(
          res.status === 401
            ? (L('Firma sesión con tu wallet para enviar mensajes.', 'Sign in with your wallet to send messages.', 'Entre com sua carteira para enviar mensagens.'))
            : (L('No se pudo enviar el mensaje. Inténtalo de nuevo.', 'The message could not be sent. Try again.', 'Não foi possível enviar a mensagem. Tente novamente.'))
        );
        return;
      }

      const data = await res.json();
      if (data.message) {
        setMessages((prev) => [...prev, data.message]);
      }
      setNewMessage('');
    } catch (err) {
      console.warn('Message send failed:', err);
      setSendError(L('No se pudo enviar el mensaje. Inténtalo de nuevo.', 'The message could not be sent. Try again.', 'Não foi possível enviar a mensagem. Tente novamente.'));
    } finally {
      setIsSending(false);
    }
  };

  const txLink = (hash: string) => (
    <a
      href={`${explorerBaseUrl}/tx/${hash}`}
      target="_blank"
      rel="noopener noreferrer"
      className="mt-0.5 inline-flex items-center gap-1 py-2 font-mono text-[10px] text-cyan-400 hover:text-cyan-300 sm:mt-1.5 sm:py-0"
    >
      <span>Tx: {hash.slice(0, 10)}...{hash.slice(-8)}</span>
      <ExternalLink className="h-2.5 w-2.5" />
    </a>
  );

  return (
    <div className="mt-6 border-t border-border/70 pt-6">
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column: Milestone On-chain Timeline (5 cols) */}
        <div className="min-w-0 lg:col-span-5 rounded-2xl border border-border/80 bg-surface-elevated/40 p-5 backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck className="h-4 w-4 text-accent" />
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">
              {L('Línea de tiempo on-chain', 'On-chain timeline', 'Linha do tempo on-chain')} ({networkName})
            </h4>
          </div>

          <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-border">
            {/* 1. Funded Step */}
            <div className="relative">
              <div className="absolute -left-6 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-blue-500/20 text-blue-400 border border-blue-500/40">
                <CheckCircle2 className="h-3.5 w-3.5" />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">{L('Fondos en escrow', 'Funds in escrow', 'Fundos no escrow')}</span>
                  <span className="text-[11px] text-blue-400 font-semibold">{order.amountUsdc} USDC</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  {L('El comprador bloqueó los fondos en el smart contract.', 'The buyer locked the funds in the smart contract.', 'O comprador bloqueou os fundos no smart contract.')}
                </p>
                {fundingTx && txLink(fundingTx)}
              </div>
            </div>

            {/* 2. Delivery Step */}
            <div className="relative">
              <div className={`absolute -left-6 top-0.5 flex h-5 w-5 items-center justify-center rounded-full border ${
                isDelivered
                  ? 'bg-purple-500/20 text-purple-400 border-purple-500/40'
                  : 'bg-surface text-slate-500 border-border'
              }`}>
                <FileCheck className="h-3.5 w-3.5" />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">{L('Entrega del trabajo', 'Delivery', 'Entrega do trabalho')}</span>
                  <span className={`text-[11px] font-semibold ${isDelivered ? 'text-purple-400' : 'text-slate-500'}`}>
                    {isDelivered ? (L('Entregado', 'Delivered', 'Entregue')) : (L('Pendiente', 'Pending', 'Pendente'))}
                  </span>
                </div>

                {order.deliveryUrl ? (
                  <div className="mt-1.5 rounded-lg border border-purple-500/30 bg-purple-950/20 p-2.5 text-xs space-y-1.5">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-purple-300">{L('Entregable:', 'Deliverable:', 'Entregável:')}</span>
                      <DeliverableLink
                        orderId={order.id}
                        reference={order.deliveryUrl}
                        className="mt-0.5 text-[11px] text-cyan-300 hover:underline"
                      />
                    </div>
                    {order.deliveryHash && (
                      <div className="rounded bg-black/40 px-2 py-1 border border-purple-500/20 font-mono text-[10px] text-slate-300">
                        <span className="text-purple-400 font-bold block text-[9px] uppercase tracking-wider">
                          {L('Hash SHA-256 registrado en el escrow:', 'SHA-256 hash recorded in the escrow:', 'Hash SHA-256 registrado no escrow:')}
                        </span>
                        <span className="break-all select-all text-slate-200">{order.deliveryHash}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    {isDelivered
                      ? (L('Entrega registrada en el contrato.', 'Delivery recorded in the contract.', 'Entrega registrada no contrato.'))
                      : (L('El vendedor está realizando el servicio.', 'The seller is working on the service.', 'O vendedor está realizando o serviço.'))}
                  </p>
                )}

                {/* Countdown to the end of the review period */}
                {order.status === 'DELIVERED' && timeLeft && (
                  <div className="mt-2.5 flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-300">
                    <Timer className="h-3.5 w-3.5 text-amber-400 animate-pulse" />
                    <div>
                      <span className="text-[10px] uppercase tracking-wider block font-semibold text-amber-400/90">
                        {L('La revisión termina en:', 'Review period ends in:', 'A revisão termina em:')}
                      </span>
                      <span className="font-mono font-bold text-white text-xs">{timeLeft}</span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 3. Release / Outcome Step */}
            <div className="relative">
              <div className={`absolute -left-6 top-0.5 flex h-5 w-5 items-center justify-center rounded-full border ${
                order.status === 'RELEASED'
                  ? 'bg-accent/20 text-accent border-accent/40'
                  : order.status === 'REFUNDED'
                  ? 'bg-amber-500/20 text-amber-400 border-amber-500/40'
                  : 'bg-surface text-slate-500 border-border'
              }`}>
                {order.status === 'REFUNDED' ? (
                  <RotateCcw className="h-3.5 w-3.5" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                )}
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">{L('Liquidación y cierre', 'Settlement', 'Liquidação e encerramento')}</span>
                  <span className={`text-[11px] font-semibold ${
                    order.status === 'RELEASED'
                      ? 'text-accent'
                      : order.status === 'REFUNDED'
                      ? 'text-amber-400'
                      : 'text-slate-500'
                  }`}>
                    {order.status === 'RELEASED'
                      ? (L('Liberado', 'Released', 'Liberado'))
                      : order.status === 'REFUNDED'
                      ? (L('Reembolsado', 'Refunded', 'Reembolsado'))
                      : order.status === 'DISPUTED'
                      ? (L('En disputa', 'In dispute', 'Em disputa'))
                      : (L('En espera', 'Pending', 'Aguardando'))}
                  </span>
                </div>

                {order.status === 'RELEASED' && (
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    {L('Fondos transferidos: ', 'Paid out: ', 'Fundos transferidos: ')}
                    <strong className="text-accent">{order.sellerAmountUsdc} USDC</strong>
                    {L(` al vendedor (+${order.platformFeeUsdc} USDC de comisión del 3%).`, ` to the seller (+${order.platformFeeUsdc} USDC 3% fee).`, ` para o vendedor (+${order.platformFeeUsdc} USDC de taxa de 3%).`)}
                  </p>
                )}

                {order.status === 'REFUNDED' && (
                  <p className="text-[11px] text-amber-300 mt-0.5">
                    {L(`Monto íntegro devuelto al comprador (${order.amountUsdc} USDC).`, `Full amount returned to the buyer (${order.amountUsdc} USDC).`, `Valor total devolvido ao comprador (${order.amountUsdc} USDC).`)}
                  </p>
                )}

                {releaseTx && txLink(releaseTx)}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: In-Order Communication Chat (7 cols) */}
        <div className="min-w-0 lg:col-span-7 flex flex-col rounded-2xl border border-border/80 bg-surface-elevated/40 p-5 backdrop-blur-sm">
          <div className="flex items-center justify-between border-b border-border/70 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-cyan-400" />
              <h4 className="text-sm font-bold text-white">{L('Mensajes de la orden', 'Order messages', 'Mensagens do pedido')}</h4>
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              {messages.length} {messages.length === 1 ? L('mensaje', 'message', 'mensagem') : L('mensajes', 'messages', 'mensagens')}
            </span>
          </div>

          {/* Messages list */}
          <div className="flex-1 space-y-3 overflow-y-auto max-h-60 pr-1">
            {messages.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                {L('No hay mensajes aún. Comienza la conversación con tu contraparte aquí.', 'No messages yet. Start the conversation with the other party here.', 'Ainda não há mensagens. Comece a conversa com a outra parte aqui.')}
              </div>
            ) : (
              messages.map((msg) => {
                const isMe = !!address && !!msg.sender?.walletAddress && address.toLowerCase() === msg.sender.walletAddress.toLowerCase();
                const wallet = msg.sender?.walletAddress;

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                  >
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mb-1">
                      <span className="font-semibold text-slate-300">
                        {isMe
                          ? (L('Tú', 'You', 'Você'))
                          : msg.sender?.displayName || msg.sender?.username || (wallet ? `${wallet.slice(0, 6)}...${wallet.slice(-4)}` : (L('Usuario', 'User', 'Usuário')))}
                      </span>
                      <span>•</span>
                      <span>
                        {new Date(msg.createdAt).toLocaleTimeString(L('es-ES', 'en-US', 'pt-BR'), {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs leading-relaxed ${
                        isMe
                          ? 'bg-primary text-white rounded-tr-none'
                          : 'bg-surface border border-border text-slate-200 rounded-tl-none'
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Message Input Form */}
          <form onSubmit={handleSendMessage} className="mt-4 flex items-center gap-2 pt-3 border-t border-border/60">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              placeholder={L('Escribe un mensaje o consulta sobre esta orden...', 'Write a message about this order...', 'Escreva uma mensagem sobre este pedido...')}
              aria-label={L('Mensaje', 'Message', 'Mensagem')}
              className="flex-1 rounded-xl border border-border bg-surface px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
            />
            <button
              type="submit"
              disabled={!newMessage.trim() || isSending}
              aria-label={L('Enviar mensaje', 'Send message', 'Enviar mensagem')}
              className="inline-flex items-center justify-center rounded-xl bg-cyan-500 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-cyan-500/20 transition hover:bg-cyan-400 active:scale-95 disabled:opacity-40"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </form>
          {sendError && <p className="mt-2 text-[11px] text-red-400">{sendError}</p>}
        </div>
      </div>
    </div>
  );
}
