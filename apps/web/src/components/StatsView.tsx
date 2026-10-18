'use client';

import React, { useEffect, useState } from 'react';
import { ExternalLink, Loader2, ShieldCheck } from 'lucide-react';
import { useLanguage } from '@/lib/languageContext';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

interface Stats {
  goal: number;
  escrowContract: string;
  verifyUrl: string;
  orders: { funded: number; completed: number; refunded: number; volumeUsdc: number };
  operator: { funded: number; completed: number; volumeUsdc: number };
  catalog: { services: number; sellers: number; foundingSellers: number };
  updatedAt: string;
}

const usdc = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** "Operation 100": public traction counter on Base Mainnet, with operator-funded orders shown apart. */
export function StatsView() {
  const { L, language } = useLanguage();
  const [stats, setStats] = useState<Stats | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    fetch(`${API_URL}/stats`)
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then(setStats)
      .catch(() => setFailed(true));
  }, []);

  const pct = stats ? Math.min(100, (stats.orders.completed / stats.goal) * 100) : 0;
  const card = 'rounded-2xl border border-border bg-surface p-5';

  return (
    <div className="mx-auto max-w-4xl px-4 py-10 sm:px-6 lg:px-8">
      <p className="text-xs font-semibold uppercase tracking-wider text-primary-light">{L('Tracción pública', 'Public traction', 'Tração pública')}</p>
      <h1 className="mt-1 text-3xl font-extrabold text-white sm:text-4xl">{L('Operación 100', 'Operation 100', 'Operação 100')}</h1>
      <p className="mt-2 max-w-2xl text-sm text-slate-400">
        {L(
          'Nuestra meta: las primeras 100 órdenes completadas por personas y agentes. Cada número sale de órdenes en el contrato de escrow en Base Mainnet, que cualquiera puede verificar.',
          'Our goal: the first 100 orders completed by people and agents. Every number comes from orders on the escrow contract on Base Mainnet, which anyone can verify.',
          'Nossa meta: os primeiros 100 pedidos concluídos por pessoas e agentes. Cada número vem de pedidos no contrato de escrow na Base Mainnet, que qualquer pessoa pode verificar.'
        )}
      </p>

      {!stats && !failed && (
        <div className="mt-16 flex justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-slate-500" />
        </div>
      )}
      {failed && (
        <p className="mt-10 text-sm text-red-400">{L('No se pudieron cargar las cifras.', 'The numbers could not be loaded.', 'Não foi possível carregar os números.')}</p>
      )}

      {stats && (
        <>
          <div className={`mt-8 ${card}`}>
            <div className="flex items-baseline justify-between gap-3">
              <span className="text-sm font-semibold text-slate-300">{L('Órdenes completadas', 'Completed orders', 'Pedidos concluídos')}</span>
              <span className="text-4xl font-extrabold text-white">
                {stats.orders.completed}
                <span className="text-xl text-slate-500"> / {stats.goal}</span>
              </span>
            </div>
            <div className="mt-4 h-3 overflow-hidden rounded-full bg-background">
              <div
                className="h-full rounded-full bg-accent shadow-[0_0_16px_rgba(0,211,149,0.6)] transition-all"
                style={{ width: `${Math.max(pct, stats.orders.completed > 0 ? 2 : 0)}%` }}
              />
            </div>
            <p className="mt-3 text-xs text-slate-500">
              {L(
                'Completada: el pago se liberó al vendedor (aprobación, cobro tras la revisión o resolución de una disputa).',
                'Completed: the payment was released to the seller (approval, claim after the review window or a dispute resolution).',
                'Concluído: o pagamento foi liberado ao vendedor (aprovação, recebimento após a revisão ou resolução de uma disputa).'
              )}
            </p>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-3">
            <div className={card}>
              <p className="text-xs text-slate-400">{L('Volumen completado', 'Completed volume', 'Volume concluído')}</p>
              <p className="mt-1 text-2xl font-extrabold text-white">
                {usdc(stats.orders.volumeUsdc)} <span className="text-xs font-bold text-usdc">USDC</span>
              </p>
            </div>
            <div className={card}>
              <p className="text-xs text-slate-400">{L('Órdenes fondeadas', 'Funded orders', 'Pedidos com depósito')}</p>
              <p className="mt-1 text-2xl font-extrabold text-white">{stats.orders.funded}</p>
              {stats.orders.refunded > 0 && (
                <p className="text-[11px] text-slate-500">
                  {stats.orders.refunded} {L('reembolsadas', 'refunded', 'reembolsados')}
                </p>
              )}
            </div>
            <div className={card}>
              <p className="text-xs text-slate-400">{L('Servicios publicados', 'Listed services', 'Serviços publicados')}</p>
              <p className="mt-1 text-2xl font-extrabold text-white">{stats.catalog.services}</p>
            </div>
            <div className={card}>
              <p className="text-xs text-slate-400">{L('Vendedores con servicios', 'Sellers with services', 'Vendedores com serviços')}</p>
              <p className="mt-1 text-2xl font-extrabold text-white">{stats.catalog.sellers}</p>
            </div>
            <div className={card}>
              <p className="text-xs text-slate-400">Founding Sellers</p>
              <p className="mt-1 text-2xl font-extrabold text-amber-300">
                {stats.catalog.foundingSellers} <span className="text-base text-slate-500">/ 25</span>
              </p>
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-border/80 bg-background/50 p-5 text-sm text-slate-300">
            <p className="font-semibold text-white">{L('Órdenes financiadas por el operador', 'Orders funded by the operator', 'Pedidos financiados pelo operador')}</p>
            <p className="mt-1 text-slate-400">
              {L(
                `Cuando el operador de Mercadopleis contrata (por ejemplo, para probar el sitio o pagar tareas propias), la orden no suma a los números de arriba. Hasta ahora: ${stats.operator.completed} completadas de ${stats.operator.funded}, ${usdc(stats.operator.volumeUsdc)} USDC.`,
                `When the Mercadopleis operator hires someone (for example, to test the site or pay for its own tasks), the order does not count above. So far: ${stats.operator.completed} completed of ${stats.operator.funded}, ${usdc(stats.operator.volumeUsdc)} USDC.`,
                `Quando o operador do Mercadopleis contrata (por exemplo, para testar o site ou pagar tarefas próprias), o pedido não entra nos números acima. Até agora: ${stats.operator.completed} concluídos de ${stats.operator.funded}, ${usdc(stats.operator.volumeUsdc)} USDC.`
              )}
            </p>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500">
            <a href={stats.verifyUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-semibold text-primary-light hover:underline">
              <ShieldCheck className="h-4 w-4" />
              {L('Verificar en BaseScan (eventos del contrato)', 'Verify on BaseScan (contract events)', 'Verificar no BaseScan (eventos do contrato)')}
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <span>
              {L('Solo Base Mainnet; las pruebas en Base Sepolia no cuentan.', 'Base Mainnet only; tests on Base Sepolia do not count.', 'Só Base Mainnet; testes na Base Sepolia não contam.')}{' '}
              {L('Actualizado', 'Updated', 'Atualizado')}: {new Date(stats.updatedAt).toLocaleString(language === 'pt' ? 'pt-BR' : language)}
            </span>
          </div>
        </>
      )}
    </div>
  );
}
