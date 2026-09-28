import React from 'react';
import Link from 'next/link';
import { Home, ShoppingBag } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 text-center sm:px-6">
      <div className="rounded-3xl border border-border/80 bg-surface/90 p-8 sm:p-12 backdrop-blur-md shadow-2xl max-w-lg">
        <span className="text-6xl font-extrabold tracking-tight text-primary-light">404</span>
        <h1 className="mt-4 text-2xl font-bold text-white sm:text-3xl">Página no encontrada</h1>
        <p className="mt-3 text-sm text-slate-400 leading-relaxed">
          La página que estás buscando no existe, ha sido movida o la dirección ingresada no es válida.
        </p>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary/20 transition hover:bg-primary-hover active:scale-95"
          >
            <Home className="h-4 w-4" />
            <span>Volver al Inicio</span>
          </Link>
          <Link
            href="/orders"
            className="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-5 py-2.5 text-sm font-semibold text-slate-300 transition hover:bg-surface-elevated hover:text-white"
          >
            <ShoppingBag className="h-4 w-4" />
            <span>Mis Órdenes</span>
          </Link>
        </div>
      </div>
    </div>
  );
}
