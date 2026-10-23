'use client';

// "Operation 100": public traction counter on Base Mainnet, with operator-funded orders shown apart.
// The numbers arrive server-rendered (props); the motion is an opening sequence played on top of them, built for
// screen recordings: title reveal, the escrow flow, a 100-slot ring that lights up order by order, and counters that
// run up to the real values. Pure SVG + CSS (+ a small requestAnimationFrame counter). prefers-reduced-motion shows the
// final frame with no motion.
import React, { useEffect, useState } from 'react';
import { ExternalLink, ShieldCheck } from 'lucide-react';
import { useLanguage } from '@/lib/languageContext';
import type { PublicStats } from '@/lib/publicStats';

const usdc = (n: number) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const CSS = `
.st-stage { position: relative; isolation: isolate; }
.st-glow { position: absolute; inset: -10% -20% auto; height: 520px; z-index: -1; pointer-events: none;
  background: radial-gradient(40% 50% at 50% 35%, rgba(0,82,255,.28), transparent 70%),
              radial-gradient(30% 35% at 70% 55%, rgba(0,211,149,.16), transparent 70%);
  animation: st-breathe 9s ease-in-out infinite; }
.st-letter { display: inline-block; }
.st-anim .st-letter { opacity: 0; filter: blur(14px); transform: translateY(18px) scale(1.08);
  animation: st-letter .9s cubic-bezier(.2,.8,.2,1) forwards; }
.st-kicker { letter-spacing: .2em; }
.st-anim .st-kicker { opacity: 0; letter-spacing: .6em; animation: st-kicker 1.4s cubic-bezier(.2,.8,.2,1) .1s forwards; }
.st-sweep { position: relative; display: inline-block; }
.st-sweep::after { content: ''; position: absolute; left: 0; right: 0; bottom: -10px; height: 2px;
  background: linear-gradient(90deg, transparent, #3375ff, #00D395, transparent); transform-origin: left; }
.st-anim .st-sweep::after { transform: scaleX(0);
  animation: st-line 1.2s cubic-bezier(.7,0,.2,1) 1.1s forwards; }
.st-anim .st-fade { opacity: 0; transform: translateY(14px); animation: st-up .9s cubic-bezier(.2,.8,.2,1) forwards; }
.st-tick { transition: none; }
.st-anim .st-tick-on { opacity: .12; animation: st-tick .5s cubic-bezier(.2,.8,.2,1) forwards; }
.st-tick-live { animation: st-live 2.4s ease-in-out infinite; }
.st-scan { transform-origin: 200px 200px; animation: st-spin 7s linear infinite; }
.st-orbit { transform-origin: 200px 200px; animation: st-spin 40s linear infinite reverse; }
.st-ring-draw { stroke-dasharray: 1068; }
.st-anim .st-ring-draw { stroke-dashoffset: 1068; animation: st-draw 2.2s cubic-bezier(.7,0,.2,1) .4s forwards; }
.st-vault-pulse { transform-box: fill-box; transform-origin: center; animation: st-pulse 3.2s ease-out infinite; }
.st-card { position: relative; overflow: hidden; }
.st-card::after { content: ''; position: absolute; inset: 0; transform: translateX(-120%); }
.st-anim .st-card::after {
  background: linear-gradient(105deg, transparent 35%, rgba(255,255,255,.07) 50%, transparent 65%);
  animation: st-shine 1.6s cubic-bezier(.4,0,.2,1) forwards; animation-delay: inherit; }
.st-num { font-variant-numeric: tabular-nums; }
.st-big { text-shadow: 0 0 28px rgba(0,211,149,.45), 0 0 2px rgba(255,255,255,.4); }
@keyframes st-letter { to { opacity: 1; filter: none; transform: none; } }
@keyframes st-kicker { to { opacity: 1; letter-spacing: .2em; } }
@keyframes st-line { to { transform: scaleX(1); } }
@keyframes st-up { to { opacity: 1; transform: none; } }
@keyframes st-tick { 0% { opacity: .12; } 60% { opacity: 1; filter: drop-shadow(0 0 6px #00D395); } 100% { opacity: 1; filter: drop-shadow(0 0 2px #00D395); } }
@keyframes st-live { 0%, 100% { opacity: .35; } 50% { opacity: 1; filter: drop-shadow(0 0 5px #fbbf24); } }
@keyframes st-spin { to { transform: rotate(360deg); } }
@keyframes st-draw { to { stroke-dashoffset: 0; } }
@keyframes st-pulse { 0% { transform: scale(1); opacity: .7; } 100% { transform: scale(2.4); opacity: 0; } }
@keyframes st-shine { to { transform: translateX(120%); } }
@keyframes st-breathe { 0%, 100% { opacity: .85; transform: scale(1); } 50% { opacity: 1; transform: scale(1.06); } }
/* Safety net: the final frame once the sequence should be over, even if the browser never ran the animations. */
.st-done .st-letter, .st-done .st-kicker, .st-done .st-fade { opacity: 1; filter: none; transform: none; animation: none; }
.st-done .st-sweep::after { transform: scaleX(1); animation: none; }
.st-done .st-tick-on { opacity: 1; animation: none; }
.st-done .st-ring-draw { stroke-dashoffset: 0; animation: none; }
@media (prefers-reduced-motion: reduce) {
  .st-letter, .st-kicker, .st-fade { opacity: 1 !important; filter: none !important; transform: none !important; animation: none !important; letter-spacing: .2em; }
  .st-letter, .st-fade { letter-spacing: normal; }
  .st-sweep::after { transform: scaleX(1); animation: none; }
  .st-tick-on { opacity: 1; animation: none; }
  .st-tick-live { opacity: .7; animation: none; }
  .st-scan, .st-particles { display: none; }
  .st-orbit, .st-vault-pulse, .st-glow { animation: none; }
  .st-ring-draw { stroke-dashoffset: 0; animation: none; }
  .st-card::after { display: none; }
}
`;

/** Counts from 0 to the real value after `delay` ms, unless motion is off. Server HTML always has the real value. */
function useCountUp(target: number, delay: number, motion: boolean) {
  const [value, setValue] = useState(target);
  useEffect(() => {
    if (!motion) {
      setValue(target);
      return;
    }
    let raf = 0;
    const start = performance.now() + delay;
    setValue(0);
    const tick = (t: number) => {
      const p = Math.min(1, Math.max(0, (t - start) / 1600));
      setValue(p >= 1 ? target : target * (1 - Math.pow(2, -10 * p)));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, delay, motion]);
  return value;
}

function Title({ text, delay = 0.25 }: { text: string; delay?: number }) {
  return (
    <span className="st-sweep" aria-label={text}>
      {Array.from(text).map((ch, i) => (
        <span key={i} aria-hidden className="st-letter" style={{ animationDelay: `${delay + i * 0.045}s` }}>
          {ch === ' ' ? ' ' : ch}
        </span>
      ))}
    </span>
  );
}

/** 100 slots around a ring: completed orders lit green one by one, orders in escrow pulse amber. */
function Ring({ completed, inEscrow, goal, motion }: { completed: number; inEscrow: number; goal: number; motion: boolean }) {
  const shown = useCountUp(completed, 1100, motion);
  const ticks = Array.from({ length: goal }, (_, i) => i);
  return (
    <svg viewBox="0 0 400 400" className="w-full max-w-[380px]" role="img" aria-label={`${completed} / ${goal}`}>
      <defs>
        <linearGradient id="st-arc" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3375ff" />
          <stop offset="1" stopColor="#00D395" />
        </linearGradient>
        <radialGradient id="st-core">
          <stop offset="0" stopColor="#0052FF" stopOpacity=".35" />
          <stop offset="1" stopColor="#0052FF" stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle cx="200" cy="200" r="150" fill="url(#st-core)" />
      <circle cx="200" cy="200" r="170" fill="none" stroke="url(#st-arc)" strokeWidth="1.5" strokeOpacity=".55" className="st-ring-draw" />
      <g className="st-orbit">
        {[0, 120, 240].map((a) => (
          <circle key={a} cx={200 + 186 * Math.cos((a * Math.PI) / 180)} cy={200 + 186 * Math.sin((a * Math.PI) / 180)} r="2.2" fill="#3375ff" opacity=".8" />
        ))}
      </g>
      <g className="st-scan">
        <path d="M200 30 A170 170 0 0 1 320 80" fill="none" stroke="#00D395" strokeWidth="3" strokeLinecap="round" opacity=".55" />
      </g>
      {ticks.map((i) => {
        const angle = (i / goal) * 360 - 90;
        const rad = (angle * Math.PI) / 180;
        const [r1, r2] = [140, 158];
        const state = i < completed ? 'on' : i < completed + inEscrow ? 'live' : 'off';
        return (
          <line
            key={i}
            x1={200 + r1 * Math.cos(rad)}
            y1={200 + r1 * Math.sin(rad)}
            x2={200 + r2 * Math.cos(rad)}
            y2={200 + r2 * Math.sin(rad)}
            strokeWidth={i % 10 === 0 ? 3 : 2}
            strokeLinecap="round"
            stroke={state === 'on' ? '#00D395' : state === 'live' ? '#fbbf24' : '#1b2438'}
            className={state === 'on' ? 'st-tick st-tick-on' : state === 'live' ? 'st-tick st-tick-live' : 'st-tick'}
            style={state === 'on' ? { animationDelay: `${1.1 + i * Math.min(0.06, 3 / Math.max(completed, 1))}s` } : undefined}
          />
        );
      })}
      <text x="200" y="212" textAnchor="middle" className="st-num st-big" fill="#fff" fontSize="84" fontWeight="800">
        {Math.round(shown)}
      </text>
      <text x="200" y="250" textAnchor="middle" fill="#64748b" fontSize="18" fontWeight="700" letterSpacing="4">
        / {goal}
      </text>
    </svg>
  );
}

/** Payments flowing from buyers (agents and people) into the escrow vault on Base, and out to the people paid. */
function Flow({ labels }: { labels: [string, string, string] }) {
  const ys = [44, 110, 176];
  const inPaths = ys.map((y) => `M70 ${y} C 220 ${y}, 260 110, 384 110`);
  const outPaths = ys.map((y) => `M416 110 C 540 110, 580 ${y}, 730 ${y}`);
  return (
    <svg viewBox="0 0 800 220" className="w-full" role="img" aria-label={labels.join(' → ')}>
      {inPaths.map((d, i) => <path key={`i${i}`} d={d} fill="none" stroke="#3375ff" strokeOpacity=".22" strokeWidth="1.5" />)}
      {outPaths.map((d, i) => <path key={`o${i}`} d={d} fill="none" stroke="#00D395" strokeOpacity=".22" strokeWidth="1.5" />)}
      <g className="st-particles">
        {inPaths.map((d, i) => (
          <circle key={`pi${i}`} r="3.5" fill="#6d9bff">
            <animateMotion dur="2.6s" begin={`${1.6 + i * 0.85}s`} repeatCount="indefinite" path={d} keyPoints="0;1" keyTimes="0;1" calcMode="spline" keySplines=".5 0 .3 1" />
          </circle>
        ))}
        {outPaths.map((d, i) => (
          <circle key={`po${i}`} r="3.5" fill="#00D395">
            <animateMotion dur="2.6s" begin={`${2.9 + i * 0.85}s`} repeatCount="indefinite" path={d} keyPoints="0;1" keyTimes="0;1" calcMode="spline" keySplines=".5 0 .3 1" />
          </circle>
        ))}
      </g>
      {ys.map((y) => <circle key={`l${y}`} cx="62" cy={y} r="7" fill="#111726" stroke="#3375ff" strokeWidth="2" />)}
      {ys.map((y) => <circle key={`r${y}`} cx="738" cy={y} r="7" fill="#111726" stroke="#00D395" strokeWidth="2" />)}
      <circle cx="400" cy="110" r="26" fill="none" stroke="#3375ff" strokeWidth="1.5" className="st-vault-pulse" />
      <circle cx="400" cy="110" r="26" fill="none" stroke="#00D395" strokeWidth="1.5" className="st-vault-pulse" style={{ animationDelay: '1.6s' }} />
      <rect x="378" y="88" width="44" height="44" rx="12" fill="#111726" stroke="#3375ff" strokeWidth="2" />
      <path d="M392 108 v-4 a8 8 0 0 1 16 0 v4 M389 108 h22 v14 h-22 z" fill="none" stroke="#fff" strokeWidth="2" strokeLinejoin="round" />
      <text x="50" y="212" textAnchor="start" fill="#94a3b8" fontSize="13" fontWeight="600">{labels[0]}</text>
      <text x="400" y="160" textAnchor="middle" fill="#cbd5e1" fontSize="13" fontWeight="700">{labels[1]}</text>
      <text x="750" y="212" textAnchor="end" fill="#94a3b8" fontSize="13" fontWeight="600">{labels[2]}</text>
    </svg>
  );
}

function Stat({ label, value, delay, motion, format, suffix, tone = 'text-white' }: {
  label: string; value: number; delay: number; motion: boolean; format?: (n: number) => string; suffix?: React.ReactNode; tone?: string;
}) {
  const v = useCountUp(value, delay * 1000 + 200, motion);
  return (
    <div className="st-card st-fade rounded-2xl border border-border bg-surface/80 p-5 backdrop-blur" style={{ animationDelay: `${delay}s` }}>
      <p className="text-xs uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`st-num mt-2 text-3xl font-extrabold ${tone}`}>
        {format ? format(v) : Math.round(v)}
        {suffix}
      </p>
    </div>
  );
}

export function StatsView({ stats }: { stats: PublicStats | null }) {
  const { L, language } = useLanguage();
  const [motion, setMotion] = useState(false);
  const [done, setDone] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setMotion(!mq.matches);
    const t = setTimeout(() => setDone(true), 6500);
    return () => clearTimeout(t);
  }, []);

  const card = 'rounded-2xl border border-border bg-surface p-5';
  const inEscrow = stats ? Math.max(0, stats.orders.funded - stats.orders.completed - stats.orders.refunded) : 0;

  return (
    <div className={`st-stage mx-auto max-w-5xl px-4 py-10 sm:px-6 lg:px-8 ${motion ? 'st-anim' : ''} ${done ? 'st-done' : ''}`}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div className="st-glow" />

      <p className="st-kicker text-center text-xs font-semibold uppercase text-primary-light">
        {L('Tracción pública · Base Mainnet', 'Public traction · Base Mainnet', 'Tração pública · Base Mainnet')}
      </p>
      <h1 className="mt-4 text-center text-4xl font-extrabold tracking-tight text-white sm:text-6xl">
        <Title text={L('Operación 100', 'Operation 100', 'Operação 100')} />
      </h1>
      <p className="st-fade mx-auto mt-6 max-w-2xl text-center text-sm leading-relaxed text-slate-400" style={{ animationDelay: '1.4s' }}>
        {L(
          'Nuestra meta: las primeras 100 órdenes completadas por personas y agentes. Cada número sale de órdenes en el contrato de escrow en Base Mainnet, que cualquiera puede verificar.',
          'Our goal: the first 100 orders completed by people and agents. Every number comes from orders on the escrow contract on Base Mainnet, which anyone can verify.',
          'Nossa meta: os primeiros 100 pedidos concluídos por pessoas e agentes. Cada número vem de pedidos no contrato de escrow na Base Mainnet, que qualquer pessoa pode verificar.'
        )}
      </p>

      {!stats && (
        <p className="mt-10 text-center text-sm text-red-400">{L('No se pudieron cargar las cifras.', 'The numbers could not be loaded.', 'Não foi possível carregar os números.')}</p>
      )}

      {stats && (
        <>
          <div className="mt-8 grid items-center gap-6 md:grid-cols-[minmax(0,380px)_1fr]">
            <div className="st-fade flex justify-center" style={{ animationDelay: '.6s' }}>
              <Ring completed={stats.orders.completed} inEscrow={inEscrow} goal={stats.goal} motion={motion} />
            </div>
            <div className="space-y-4">
              <div className="st-fade" style={{ animationDelay: '1.2s' }}>
                <p className="text-lg font-bold text-white">{L('Órdenes completadas', 'Completed orders', 'Pedidos concluídos')}</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500">
                  {L(
                    'Completada: el pago se liberó al vendedor (aprobación, cobro tras la revisión o resolución de una disputa).',
                    'Completed: the payment was released to the seller (approval, claim after the review window or a dispute resolution).',
                    'Concluído: o pagamento foi liberado ao vendedor (aprovação, recebimento após a revisão ou resolução de uma disputa).'
                  )}
                </p>
                <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-400">
                  <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-accent" /> {L('completada', 'completed', 'concluído')}</span>
                  <span className="inline-flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-400" /> {L('en escrow ahora', 'in escrow now', 'no escrow agora')}</span>
                </div>
              </div>
              <div className="st-fade" style={{ animationDelay: '1.5s' }}>
                <Flow labels={[L('Agentes y personas pagan', 'Agents and people pay', 'Agentes e pessoas pagam'), L('Escrow en Base', 'Escrow on Base', 'Escrow na Base'), L('Personas cobran', 'People get paid', 'Pessoas recebem')]} />
              </div>
            </div>
          </div>

          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-3">
            <Stat label={L('Volumen completado', 'Completed volume', 'Volume concluído')} value={stats.orders.volumeUsdc} delay={1.8} motion={motion} format={usdc} suffix={<span className="ml-1 text-xs font-bold text-usdc">USDC</span>} />
            <Stat label={L('Órdenes fondeadas', 'Funded orders', 'Pedidos com depósito')} value={stats.orders.funded} delay={1.95} motion={motion} />
            <Stat label={L('Reembolsadas', 'Refunded', 'Reembolsados')} value={stats.orders.refunded} delay={2.1} motion={motion} />
            <Stat label={L('Servicios publicados', 'Listed services', 'Serviços publicados')} value={stats.catalog.services} delay={2.25} motion={motion} />
            <Stat label={L('Vendedores con servicios', 'Sellers with services', 'Vendedores com serviços')} value={stats.catalog.sellers} delay={2.4} motion={motion} />
            <Stat label="Founding Sellers" value={stats.catalog.foundingSellers} delay={2.55} motion={motion} tone="text-amber-300" suffix={<span className="ml-1 text-base text-slate-500">/ 25</span>} />
          </div>

          <div className={`st-fade mt-4 ${card} bg-background/50 text-sm text-slate-300`} style={{ animationDelay: '2.8s' }}>
            <p className="font-semibold text-white">{L('Órdenes financiadas por el operador', 'Orders funded by the operator', 'Pedidos financiados pelo operador')}</p>
            <p className="mt-1 text-slate-400">
              {L(
                `Cuando el operador de Mercadopleis contrata (por ejemplo, para probar el sitio o pagar tareas propias), la orden no suma a los números de arriba. Hasta ahora: ${stats.operator.completed} completadas de ${stats.operator.funded}, ${usdc(stats.operator.volumeUsdc)} USDC.`,
                `When the Mercadopleis operator hires someone (for example, to test the site or pay for its own tasks), the order does not count above. So far: ${stats.operator.completed} completed of ${stats.operator.funded}, ${usdc(stats.operator.volumeUsdc)} USDC.`,
                `Quando o operador do Mercadopleis contrata (por exemplo, para testar o site ou pagar tarefas próprias), o pedido não entra nos números acima. Até agora: ${stats.operator.completed} concluídos de ${stats.operator.funded}, ${usdc(stats.operator.volumeUsdc)} USDC.`
              )}
            </p>
          </div>

          <div className="st-fade mt-6 flex flex-wrap items-center justify-between gap-3 text-xs text-slate-500" style={{ animationDelay: '3s' }}>
            <a href={stats.verifyUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-semibold text-primary-light hover:underline">
              <ShieldCheck className="h-4 w-4" />
              {L('Verificar en BaseScan (eventos del contrato)', 'Verify on BaseScan (contract events)', 'Verificar no BaseScan (eventos do contrato)')}
              <ExternalLink className="h-3.5 w-3.5" />
            </a>
            <span>
              {L('Solo Base Mainnet; las pruebas en Base Sepolia no cuentan.', 'Base Mainnet only; tests on Base Sepolia do not count.', 'Só Base Mainnet; testes na Base Sepolia não contam.')}{' '}
              {L('Actualizado', 'Updated', 'Atualizado')}: {new Date(stats.updatedAt).toLocaleString(language === 'pt' ? 'pt-BR' : language, { timeZone: 'UTC' })} UTC
            </span>
          </div>
        </>
      )}
    </div>
  );
}
