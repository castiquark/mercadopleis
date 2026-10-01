'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAccount } from 'wagmi';
import { useAuth } from '@/lib/authContext';
import { useLanguage } from '@/lib/languageContext';
import {
  UserCheck,
  Shield,
  Star,
  DollarSign,
  CheckCircle,
  Copy,
  ExternalLink,
  ArrowLeft,
  Sparkles,
  Save,
  LogOut,
  AlertCircle,
} from 'lucide-react';

export default function ProfilePage() {
  const { language } = useLanguage();
  const { address, isConnected } = useAccount();
  const { user, token, isAuthenticated, isLoading, signIn, signOut } = useAuth();

  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [country, setCountry] = useState(user?.country || 'UY');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || '');
      setBio(user.bio || '');
      setCountry(user.country || 'UY');
    }
  }, [user]);

  const copyAddress = () => {
    if (!address) return;
    navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;

    try {
      setIsSaving(true);
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || '/api';
      const res = await fetch(`${apiUrl}/auth/me`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ displayName, bio, country }),
      });

      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
      }
    } catch (err) {
      console.error('Error saving profile:', err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Navigation */}
      <Link
        href="/"
        className="inline-flex min-h-10 items-center gap-2 text-sm text-slate-400 transition hover:text-white sm:min-h-0"
      >
        <ArrowLeft className="h-4 w-4" />
        <span>Volver al Catálogo</span>
      </Link>

      {/* Profile Header Card */}
      <div className="mt-6 overflow-hidden rounded-2xl border border-border bg-surface p-6 sm:p-8 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/20 text-2xl font-bold text-primary-light ring-2 ring-primary/30">
              {displayName?.[0] || user?.username?.[0] || 'U'}
            </div>
            <div>
              <div className="flex items-center gap-2.5">
                <h1 className="text-2xl font-bold text-white">
                  {displayName || user?.username || 'Usuario Web3'}
                </h1>
                <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 border border-accent/20 px-2.5 py-0.5 text-xs font-semibold text-accent">
                  <UserCheck className="h-3.5 w-3.5" /> Wallet Verificada
                </span>
              </div>

              {/* Wallet address & copy */}
              <div className="mt-1.5 flex items-center gap-2 text-xs font-mono text-slate-400">
                <span>
                  {address ? `${address.slice(0, 10)}...${address.slice(-8)}` : '—'}
                </span>
                <button
                  onClick={copyAddress}
                  className="-m-2 rounded-lg p-3 text-slate-400 hover:bg-surface-elevated hover:text-white"
                  title="Copiar dirección"
                  aria-label="Copiar dirección"
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
                {copied && <span className="text-[10px] text-accent font-sans">¡Copiado!</span>}
              </div>
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-3">
            {isAuthenticated ? (
              <button
                onClick={signOut}
                className="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface-elevated px-4 py-2 text-xs font-semibold text-slate-300 hover:text-white hover:border-slate-500 transition"
              >
                <LogOut className="h-3.5 w-3.5 text-red-400" />
                <span>Cerrar Sesión</span>
              </button>
            ) : isConnected ? (
              <button
                onClick={() => signIn()}
                disabled={isLoading}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-primary-hover shadow-md shadow-primary/20 transition active:scale-95"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>{isLoading ? 'Firmando...' : 'Firmar Sesión (SIWE)'}</span>
              </button>
            ) : (
              <span className="text-xs text-slate-500">Conecta tu wallet para identificarte</span>
            )}
          </div>
        </div>

        {/* Reputation Stats Grid (Section 18 & 19.3) */}
        <div className="mt-8 grid grid-cols-2 gap-4 border-t border-border/80 pt-6 sm:grid-cols-4">
          <div className="rounded-xl border border-border/60 bg-background/50 p-4">
            <span className="text-xs text-slate-400">Servicios completados</span>
            <p className="mt-1 text-2xl font-extrabold text-white">83</p>
            <span className="text-[11px] text-accent">98% tasa de éxito</span>
          </div>

          <div className="rounded-xl border border-border/60 bg-background/50 p-4">
            <span className="text-xs text-slate-400">Calificación promedio</span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-2xl font-extrabold text-white">4.98</span>
              <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
            </div>
            <span className="text-[11px] text-slate-400">Sobre 83 reseñas</span>
          </div>

          <div className="rounded-xl border border-border/60 bg-background/50 p-4">
            <span className="text-xs text-slate-400">Disputas abiertas</span>
            <p className="mt-1 text-2xl font-extrabold text-accent">0</p>
            <span className="text-[11px] text-slate-400">Historial limpio</span>
          </div>

          <div className="rounded-xl border border-border/60 bg-background/50 p-4">
            <span className="text-xs text-slate-400">Volumen transaccionado</span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-2xl font-extrabold text-white">12,430</span>
              <span className="text-xs font-bold text-usdc">USDC</span>
            </div>
            <span className="text-[11px] text-slate-400">Liquidado en Base</span>
          </div>
        </div>
      </div>

      {/* Edit Profile Form */}
      <div className="mt-8 rounded-2xl border border-border bg-surface p-6 sm:p-8">
        <h2 className="text-lg font-bold text-white">Editar Perfil Público</h2>
        <p className="mt-1 text-xs text-slate-400">
          Esta información será visible para compradores y prestadores en tus servicios publicados.
        </p>

        {saveSuccess && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/10 p-3 text-xs font-semibold text-accent">
            <CheckCircle className="h-4 w-4 shrink-0 text-accent" />
            <span>Perfil actualizado exitosamente en PostgreSQL.</span>
          </div>
        )}

        <form onSubmit={handleSaveProfile} className="mt-6 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-slate-300">
                Nombre a Mostrar
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={language === 'en' ? 'e.g. Alex Rivera' : 'ej. Carlos M.'}
                className="mt-1.5 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-slate-300">
                País (Código ISO 2 letras)
              </label>
              <input
                type="text"
                maxLength={2}
                value={country}
                onChange={(e) => setCountry(e.target.value.toUpperCase())}
                placeholder="UY"
                className="mt-1.5 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-primary focus:outline-none uppercase"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-slate-300">
              Biografía / Presentación Profesional
            </label>
            <textarea
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder="Desarrollador fullstack con 5 años de experiencia en Solidity, Next.js y contratos auditables..."
              className="mt-1.5 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-primary focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={isSaving || !isAuthenticated}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary/20 transition hover:bg-primary-hover active:scale-95 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            <span>{isSaving ? 'Guardando en Base de Datos...' : 'Guardar Cambios'}</span>
          </button>

          {!isAuthenticated && isConnected && (
            <p className="text-xs text-amber-400">
              Debes firmar sesión con tu wallet para guardar cambios en tu perfil.
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
