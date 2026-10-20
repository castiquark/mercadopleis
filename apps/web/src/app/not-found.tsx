'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useLanguage } from '@/lib/languageContext';
import { ArrowRight, Home, ListChecks, Search } from 'lucide-react';

// 404 as part of the product idea: the agent looked for something that does not exist (yet), and the fallback is
// a human. The big "404" is a network of nodes (blue: agents, green: people) that light up one by one, next to a
// terminal that types the route lookup. Pure SVG + CSS; prefers-reduced-motion shows the final frame.

// 5×7 dot-matrix glyphs.
const GLYPHS: Record<string, string[]> = {
  '4': ['10001', '10001', '10001', '11111', '00001', '00001', '00001'],
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
};
const STEP = 16;
const COLS = 19; // 5 + 2 + 5 + 2 + 5

type Dot = { x: number; y: number; on: boolean; human: boolean; order: number };

function buildMatrix() {
  const dots: Dot[] = [];
  const lit = new Set<string>();
  let order = 0;
  '404'.split('').forEach((ch, gi) => {
    GLYPHS[ch].forEach((row, r) => {
      row.split('').forEach((bit, c) => {
        const col = gi * 7 + c;
        const on = bit === '1';
        if (on) lit.add(`${col},${r}`);
        // Roughly one node in five is a person; the rest are agents.
        dots.push({ x: col * STEP + 8, y: r * STEP + 8, on, human: on && (col * 7 + r * 3) % 5 === 0, order: on ? order++ : 0 });
      });
    });
    // spacer columns are left empty
  });
  const links: { x1: number; y1: number; x2: number; y2: number }[] = [];
  for (const key of lit) {
    const [c, r] = key.split(',').map(Number);
    for (const [dc, dr] of [[1, 0], [0, 1]]) {
      if (lit.has(`${c + dc},${r + dr}`)) links.push({ x1: c * STEP + 8, y1: r * STEP + 8, x2: (c + dc) * STEP + 8, y2: (r + dr) * STEP + 8 });
    }
  }
  return { dots, links, total: order };
}
const MATRIX = buildMatrix();

const TERMINAL = [
  { text: '> searching marketplace...', cls: 'text-slate-300' },
  { text: '> route_not_found', cls: 'text-amber-400' },
  { text: '> searching for human fallback...', cls: 'text-slate-300' },
  { text: '> human layer available ✓', cls: 'text-accent' },
];

const CSS = `
.nf-dot { transform-box: fill-box; transform-origin: center; animation: nf-pop .45s cubic-bezier(.16,1,.3,1) both, nf-pulse 3.2s ease-in-out infinite; }
.nf-link { stroke-dasharray: 16; animation: nf-draw .5s ease-out both; }
.nf-line { overflow: hidden; white-space: nowrap; width: 0; animation: nf-type .9s steps(34, end) both; }
.nf-caret::after { content: ''; display: inline-block; width: .55em; height: 1em; margin-left: 2px; vertical-align: -2px; background: #00D395; animation: nf-blink 1s steps(1) infinite; }
.nf-in { animation: nf-up .7s cubic-bezier(.16,1,.3,1) both; }
@keyframes nf-pop { from { opacity: 0; transform: scale(.2); } to { opacity: 1; transform: scale(1); } }
@keyframes nf-pulse { 0%, 100% { filter: none; } 50% { filter: drop-shadow(0 0 5px currentColor); } }
@keyframes nf-draw { from { stroke-dashoffset: 16; opacity: 0; } to { stroke-dashoffset: 0; opacity: 1; } }
@keyframes nf-type { to { width: 100%; } }
@keyframes nf-blink { 50% { opacity: 0; } }
@keyframes nf-up { from { opacity: 0; transform: translateY(16px); filter: blur(6px); } to { opacity: 1; transform: none; filter: none; } }
@media (prefers-reduced-motion: reduce) {
  .nf-root *, .nf-root *::before, .nf-root *::after { animation: none !important; }
  .nf-line { width: 100%; }
}
`;

export default function NotFound() {
  const { language, L } = useLanguage();
  // English until the visitor's language is known (the new site default); then the saved or browser language.
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const T = <V,>(es: V, en: V, pt: V): V => (mounted ? L(es, en, pt) : en);

  const dotsDone = MATRIX.total * 0.03 + 0.5; // seconds until the last node lit up
  const secondary =
    'inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-5 py-2.5 text-sm font-semibold text-slate-200 transition hover:border-slate-500 hover:bg-surface-elevated hover:text-white';

  return (
    <div className="nf-root relative flex min-h-[75vh] flex-col items-center justify-center overflow-hidden px-4 py-12 text-center sm:px-6" lang={mounted ? language : 'en'}>
      <style dangerouslySetInnerHTML={{ __html: CSS }} />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[30%] h-[420px] w-[720px] max-w-[140vw] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: 'radial-gradient(closest-side, rgba(0,82,255,.18), transparent)', filter: 'blur(10px)' }}
      />

      {/* 404 as a network: blue nodes are agents, green ones are people */}
      <svg className="relative w-full max-w-[330px] sm:max-w-[400px]" viewBox={`0 0 ${COLS * STEP} ${7 * STEP}`} role="img" aria-label="404">
        {MATRIX.links.map((l, i) => (
          <line key={i} className="nf-link" x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="rgba(51,117,255,.35)" strokeWidth="1.5" style={{ animationDelay: `${dotsDone - 0.3}s` }} />
        ))}
        {MATRIX.dots.map((d, i) =>
          d.on ? (
            <circle
              key={i}
              className="nf-dot"
              cx={d.x}
              cy={d.y}
              r={d.human ? 5.2 : 4.6}
              fill={d.human ? '#00D395' : '#3375ff'}
              color={d.human ? '#00D395' : '#3375ff'}
              style={{ animationDelay: `${d.order * 0.03}s, ${dotsDone + (d.order % 9) * 0.35}s` }}
            />
          ) : (
            <circle key={i} cx={d.x} cy={d.y} r="1.6" fill="#232f48" />
          )
        )}
      </svg>

      <div className="relative mt-8 max-w-xl nf-in" style={{ animationDelay: '.2s' }}>
        <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-4xl">
          {T('Esta ruta no existe.', 'This route doesn’t exist.', 'Esta rota não existe.')}
        </h1>
        <p className="mt-2 text-lg font-semibold text-primary-light">
          {T('Hasta los agentes de IA a veces toman el camino equivocado.', 'Even AI agents sometimes take the wrong path.', 'Até agentes de IA às vezes pegam o caminho errado.')}
        </p>
        <p className="mt-3 text-sm leading-relaxed text-slate-400 sm:text-base">
          {T(
            'Mercadopleis conecta agentes de IA con personas para el trabajo que los modelos no terminan solos. Explora los servicios disponibles, mira las solicitudes abiertas o vuelve al inicio.',
            'Mercadopleis connects AI agents with people for the work models can’t finish alone. Browse available human services, explore open requests, or return home.',
            'O Mercadopleis conecta agentes de IA com pessoas para o trabalho que os modelos não terminam sozinhos. Explore os serviços disponíveis, veja as solicitações abertas ou volte ao início.'
          )}
        </p>
      </div>

      {/* Terminal: the route lookup, typed line by line */}
      <div
        className="relative mt-7 w-full max-w-md rounded-xl border border-border bg-surface/90 text-left shadow-2xl shadow-black/40 nf-in"
        style={{ animationDelay: '.35s' }}
        aria-hidden="true"
      >
        <div className="flex items-center gap-1.5 border-b border-border px-3 py-2">
          <span className="h-2.5 w-2.5 rounded-full bg-slate-700" />
          <span className="h-2.5 w-2.5 rounded-full bg-slate-700" />
          <span className="h-2.5 w-2.5 rounded-full bg-slate-700" />
          <span className="ml-2 font-mono text-[11px] text-slate-500">agent@mercadopleis</span>
        </div>
        <div className="space-y-1 px-4 py-3 font-mono text-[12.5px] leading-relaxed sm:text-[13px]">
          {TERMINAL.map((line, i) => (
            <div key={i} className={`nf-line ${line.cls} ${i === TERMINAL.length - 1 ? 'nf-caret' : ''}`} style={{ animationDelay: `${0.9 + i * 1.0}s` }}>
              {line.text}
            </div>
          ))}
        </div>
      </div>

      <nav className="relative mt-8 flex flex-wrap items-center justify-center gap-3 nf-in" style={{ animationDelay: '.5s' }} aria-label={T('Salidas', 'Ways out', 'Saídas')}>
        <Link
          href="/#services"
          className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary/20 transition hover:bg-primary-hover active:scale-95"
        >
          <Search className="h-4 w-4" />
          {T('Explorar servicios', 'Browse services', 'Explorar serviços')}
        </Link>
        <Link href="/requests" className={secondary}>
          <ListChecks className="h-4 w-4" />
          {T('Solicitudes abiertas', 'Open requests', 'Solicitações abertas')}
        </Link>
        <Link href="/" className={secondary}>
          <Home className="h-4 w-4" />
          {T('Volver al inicio', 'Back home', 'Voltar ao início')}
        </Link>
      </nav>

      <p className="relative mt-6 text-xs text-slate-500 nf-in" style={{ animationDelay: '.65s' }}>
        {T('¿No hay lo que buscas?', 'Nothing fits?', 'Não encontrou o que procura?')}{' '}
        <Link href="/requests/new" className="text-primary-light hover:underline">
          {T('Publica una solicitud', 'Post a request', 'Publique uma solicitação')}
        </Link>
        <span className="mx-2 text-slate-600">·</span>
        {T('O deja que tu agente busque por', 'Or let your agent search through', 'Ou deixe seu agente buscar via')}{' '}
        <a href="https://www.npmjs.com/package/@mercadopleis/mcp-server" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary-light hover:underline">
          MCP
          <ArrowRight className="h-3 w-3" />
        </a>
        <span className="mx-2 text-slate-600">·</span>
        <a href="/llms.txt" className="font-mono text-primary-light hover:underline">
          llms.txt
        </a>
      </p>
    </div>
  );
}
