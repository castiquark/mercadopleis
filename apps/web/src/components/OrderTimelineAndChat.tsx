'use client';

import React, { useState, useEffect } from 'react';
import { useAccount } from 'wagmi';
import { 
  CheckCircle2, 
  Clock, 
  ExternalLink, 
  Send, 
  MessageSquare, 
  ShieldCheck, 
  AlertCircle, 
  FileCheck, 
  RotateCcw,
  Sparkles,
  User,
  ArrowUpRight,
  Timer
} from 'lucide-react';

interface OrderTimelineAndChatProps {
  order: {
    id: string;
    contractOrderId: number;
    status: 'CREATED' | 'FUNDED' | 'DELIVERED' | 'RELEASED' | 'REFUNDED' | 'DISPUTED';
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
  const [messages, setMessages] = useState<Message[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [timeLeft, setTimeLeft] = useState<string>('');

  // Default tx hashes for demo / known on-chain order #1
  const fundingTx = order.txHashFunding || (order.contractOrderId === 1 ? '0x6919d937a92506ff945374ac84da036bd2f7e45f81d35b26c5e226d24884ca3a' : null);
  const deliveryTx = order.deliveryHash || (order.contractOrderId === 1 ? '0x80cc8ef3e440a41d2192463a5580f4cf2b11e23fa401beb0283a95ce02a6e0e4' : null);
  const releaseTx = order.txHashRelease || (order.contractOrderId === 1 ? '0x7680dba2bea156dedbdfdd95abfe2d138b0b18d833012cc8191d0b7c37712b14' : null);

  // Auto-release countdown logic
  useEffect(() => {
    if (order.status !== 'DELIVERED') {
      setTimeLeft('');
      return;
    }

    const targetTimestamp = (order.autoReleaseDeadline || Math.floor(Date.now() / 1000) + 86400 * 4) * 1000;

    const updateTimer = () => {
      const now = Date.now();
      const diff = targetTimestamp - now;

      if (diff <= 0) {
        setTimeLeft('Vencido (Listo para auto-liberar)');
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
  }, [order.status, order.autoReleaseDeadline]);

  // Load order messages
  useEffect(() => {
    const fetchMessages = async () => {
      try {
        const res = await fetch(`/api/orders/${order.id}/messages`);
        if (res.ok) {
          const data = await res.json();
          if (data.messages && data.messages.length > 0) {
            setMessages(data.messages);
          } else {
            // Seed initial mock communication if none exists
            setMessages([
              {
                id: 'm-1',
                senderId: 'buyer',
                content: `Hola! He depositado ${order.amountUsdc} USDC en el contrato de escrow para iniciar el servicio. Quedo atento a tus avances.`,
                createdAt: new Date(Date.now() - 3600 * 1000 * 24).toISOString(),
                sender: {
                  displayName: order.role === 'buyer' ? 'Tú (Comprador)' : 'Comprador',
                  walletAddress: order.buyerAddress,
                },
              },
              {
                id: 'm-2',
                senderId: 'seller',
                content: '¡Excelente! Fondos confirmados en el smart contract. Comenzando el desarrollo según los requerimientos acordados.',
                createdAt: new Date(Date.now() - 3600 * 1000 * 18).toISOString(),
                sender: {
                  displayName: order.role === 'seller' ? 'Tú (Prestador)' : 'Prestador',
                  walletAddress: order.sellerAddress,
                },
              },
            ]);
          }
        }
      } catch (err) {
        console.warn('Could not fetch messages:', err);
      }
    };

    fetchMessages();
  }, [order.id, order.amountUsdc, order.buyerAddress, order.sellerAddress, order.role]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || isSending) return;

    const messageText = newMessage.trim();
    setNewMessage('');
    setIsSending(true);

    try {
      const res = await fetch(`/api/orders/${order.id}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: messageText,
          senderWallet: address,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.message) {
          setMessages((prev) => [...prev, data.message]);
        }
      } else {
        // Optimistic local fallback for demo/unpersisted orders
        setMessages((prev) => [
          ...prev,
          {
            id: 'm-' + Date.now(),
            senderId: address || 'user',
            content: messageText,
            createdAt: new Date().toISOString(),
            sender: {
              displayName: 'Tú',
              walletAddress: address || undefined,
            },
          },
        ]);
      }
    } catch (err) {
      console.warn('Optimistic message send fallback:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: 'm-' + Date.now(),
          senderId: address || 'user',
          content: messageText,
          createdAt: new Date().toISOString(),
          sender: {
            displayName: 'Tú',
            walletAddress: address || undefined,
          },
        },
      ]);
    } finally {
      setIsSending(false);
    }
  };

  return (
    <div className="mt-6 border-t border-border/70 pt-6">
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column: Milestone On-chain Timeline (5 cols) */}
        <div className="lg:col-span-5 rounded-2xl border border-border/80 bg-surface-elevated/40 p-5 backdrop-blur-sm">
          <div className="flex items-center gap-2 mb-4">
            <ShieldCheck className="h-4 w-4 text-accent" />
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">
              Línea de Tiempo On-Chain (Base Sepolia)
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
                  <span className="text-xs font-bold text-white">Fondos en Escrow</span>
                  <span className="text-[11px] text-blue-400 font-semibold">{order.amountUsdc} USDC</span>
                </div>
                <p className="text-[11px] text-slate-400 mt-0.5">
                  El comprador bloqueó los fondos en el smart contract.
                </p>
                {fundingTx && (
                  <a
                    href={`https://sepolia.basescan.org/tx/${fundingTx}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1.5 inline-flex items-center gap-1 font-mono text-[10px] text-cyan-400 hover:text-cyan-300"
                  >
                    <span>Tx: {fundingTx.slice(0, 10)}...{fundingTx.slice(-8)}</span>
                    <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                )}
              </div>
            </div>

            {/* 2. Delivery Step */}
            <div className="relative">
              <div className={`absolute -left-6 top-0.5 flex h-5 w-5 items-center justify-center rounded-full border ${
                order.status === 'DELIVERED' || order.status === 'RELEASED'
                  ? 'bg-purple-500/20 text-purple-400 border-purple-500/40'
                  : 'bg-surface text-slate-500 border-border'
              }`}>
                <FileCheck className="h-3.5 w-3.5" />
              </div>
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-white">Entrega del Trabajo</span>
                  <span className={`text-[11px] font-semibold ${
                    order.status === 'DELIVERED' || order.status === 'RELEASED' ? 'text-purple-400' : 'text-slate-500'
                  }`}>
                    {order.status === 'DELIVERED' || order.status === 'RELEASED' ? 'Entregado' : 'Pendiente'}
                  </span>
                </div>

                {order.deliveryUrl ? (
                  <div className="mt-1.5 rounded-lg border border-purple-500/30 bg-purple-950/20 p-2.5 text-xs space-y-1.5">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-purple-300">Enlace de entrega:</span>
                      <a
                        href={order.deliveryUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-0.5 flex items-center gap-1 text-[11px] text-cyan-300 hover:underline truncate"
                      >
                        <span className="truncate">{order.deliveryUrl}</span>
                        <ExternalLink className="h-3 w-3 shrink-0" />
                      </a>
                    </div>
                    {order.deliveryHash && (
                      <div className="rounded bg-black/40 px-2 py-1 border border-purple-500/20 font-mono text-[10px] text-slate-300">
                        <span className="text-purple-400 font-bold block text-[9px] uppercase tracking-wider">Hash SHA-256 (Base Escrow):</span>
                        <span className="break-all select-all text-slate-200">{order.deliveryHash}</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <p className="text-[11px] text-slate-400 mt-0.5">
                    El prestador está ejecutando el servicio.
                  </p>
                )}

                {deliveryTx && (
                  <a
                    href={`https://sepolia.basescan.org/tx/${deliveryTx}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1.5 inline-flex items-center gap-1 font-mono text-[10px] text-cyan-400 hover:text-cyan-300"
                  >
                    <span>Tx: {deliveryTx.slice(0, 10)}...{deliveryTx.slice(-8)}</span>
                    <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                )}

                {/* 5-Day Auto-Release Countdown Badge */}
                {order.status === 'DELIVERED' && timeLeft && (
                  <div className="mt-2.5 flex items-center gap-2 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-300">
                    <Timer className="h-3.5 w-3.5 text-amber-400 animate-pulse" />
                    <div>
                      <span className="text-[10px] uppercase tracking-wider block font-semibold text-amber-400/90">
                        Auto-liberación en:
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
                  <span className="text-xs font-bold text-white">Liquidación & Cierre</span>
                  <span className={`text-[11px] font-semibold ${
                    order.status === 'RELEASED'
                      ? 'text-accent'
                      : order.status === 'REFUNDED'
                      ? 'text-amber-400'
                      : 'text-slate-500'
                  }`}>
                    {order.status === 'RELEASED'
                      ? 'Liberado'
                      : order.status === 'REFUNDED'
                      ? 'Reembolsado'
                      : 'En espera'}
                  </span>
                </div>

                {order.status === 'RELEASED' && (
                  <p className="text-[11px] text-slate-300 mt-0.5">
                    Fondos transferidos: <strong className="text-accent">{order.sellerAmountUsdc} USDC</strong> al prestador (+{order.platformFeeUsdc} USDC comisión 3%).
                  </p>
                )}

                {order.status === 'REFUNDED' && (
                  <p className="text-[11px] text-amber-300 mt-0.5">
                    100% devuelto al comprador ({order.amountUsdc} USDC).
                  </p>
                )}

                {releaseTx && (
                  <a
                    href={`https://sepolia.basescan.org/tx/${releaseTx}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1.5 inline-flex items-center gap-1 font-mono text-[10px] text-cyan-400 hover:text-cyan-300"
                  >
                    <span>Tx: {releaseTx.slice(0, 10)}...{releaseTx.slice(-8)}</span>
                    <ExternalLink className="h-2.5 w-2.5" />
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: In-Order Communication Chat (7 cols) */}
        <div className="lg:col-span-7 flex flex-col rounded-2xl border border-border/80 bg-surface-elevated/40 p-5 backdrop-blur-sm">
          <div className="flex items-center justify-between border-b border-border/70 pb-3 mb-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-cyan-400" />
              <h4 className="text-sm font-bold text-white">Canal de Comunicación de la Orden</h4>
            </div>
            <span className="text-[11px] font-mono text-slate-400">
              {messages.length} mensaje{messages.length !== 1 ? 's' : ''}
            </span>
          </div>

          {/* Messages list */}
          <div className="flex-1 space-y-3 overflow-y-auto max-h-60 pr-1">
            {messages.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                No hay mensajes aún. Comienza la conversación con tu contraparte aquí.
              </div>
            ) : (
              messages.map((msg) => {
                const isMe =
                  address && msg.sender?.walletAddress
                    ? address.toLowerCase() === msg.sender.walletAddress.toLowerCase()
                    : msg.sender?.displayName?.includes('Tú') || false;

                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isMe ? 'items-end' : 'items-start'}`}
                  >
                    <div className="flex items-center gap-1.5 text-[10px] text-slate-400 mb-1">
                      <span className="font-semibold text-slate-300">
                        {msg.sender?.displayName || msg.sender?.username || 'Usuario'}
                      </span>
                      <span>•</span>
                      <span>
                        {new Date(msg.createdAt).toLocaleTimeString([], {
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
              placeholder="Escribe un mensaje o consulta sobre esta orden..."
              className="flex-1 rounded-xl border border-border bg-surface px-4 py-2.5 text-xs text-white placeholder-slate-500 focus:border-cyan-400 focus:outline-none focus:ring-1 focus:ring-cyan-400"
            />
            <button
              type="submit"
              disabled={!newMessage.trim() || isSending}
              className="inline-flex items-center justify-center rounded-xl bg-cyan-500 px-4 py-2.5 text-xs font-bold text-white shadow-lg shadow-cyan-500/20 transition hover:bg-cyan-400 active:scale-95 disabled:opacity-40"
            >
              <Send className="h-3.5 w-3.5" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
