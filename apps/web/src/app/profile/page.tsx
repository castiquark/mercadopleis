'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAccount } from 'wagmi';
import { useAuth } from '@/lib/authContext';
import { useLanguage } from '@/lib/languageContext';
import { fetchMyOrders } from '@/lib/api';
import { EMPTY_STATS, computeStats, type ReputationStats } from '@/lib/reputation';
import {
  UserCheck,
  Star,
  CheckCircle,
  Copy,
  ArrowLeft,
  Sparkles,
  Save,
  LogOut,
  AlertCircle,
} from 'lucide-react';

export default function ProfilePage() {
  const { t, L } = useLanguage();
  const { address, isConnected } = useAccount();
  const { user, token, isAuthenticated, isLoading, signIn, signOut } = useAuth();

  const [displayName, setDisplayName] = useState(user?.displayName || '');
  const [bio, setBio] = useState(user?.bio || '');
  const [country, setCountry] = useState(user?.country || '');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [stats, setStats] = useState<ReputationStats>(EMPTY_STATS);
  const [statsLoaded, setStatsLoaded] = useState(false);

  useEffect(() => {
    if (user) {
      setDisplayName(user.displayName || '');
      setBio(user.bio || '');
      setCountry(user.country || '');
    }
  }, [user]);

  useEffect(() => {
    let cancelled = false;
    if (!isAuthenticated || !user?.id) {
      setStats(EMPTY_STATS);
      setStatsLoaded(false);
      return;
    }
    fetchMyOrders().then((orders) => {
      if (cancelled) return;
      setStats(Array.isArray(orders) ? computeStats(orders, user.id) : EMPTY_STATS);
      setStatsLoaded(Array.isArray(orders));
    });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, user?.id]);

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
      setSaveError(null);
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
      } else {
        const data = await res.json().catch(() => ({}));
        setSaveError(data.error || (L('No se pudo guardar el perfil.', 'The profile could not be saved.', 'Não foi possível salvar o perfil.')));
      }
    } catch (err) {
      console.error('Error saving profile:', err);
      setSaveError(L('No se pudo guardar el perfil.', 'The profile could not be saved.', 'Não foi possível salvar o perfil.'));
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
        <span>{L('Volver al catálogo', 'Back to catalog', 'Voltar ao catálogo')}</span>
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
                  {displayName || user?.username || (L('Usuario Web3', 'Web3 user', 'Usuário Web3'))}
                </h1>
                {isAuthenticated && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 border border-accent/20 px-2.5 py-0.5 text-xs font-semibold text-accent">
                    <UserCheck className="h-3.5 w-3.5" /> {L('Sesión verificada', 'Signed in', 'Sessão verificada')}
                  </span>
                )}
              </div>

              {/* Wallet address & copy */}
              <div className="mt-1.5 flex items-center gap-2 text-xs font-mono text-slate-400">
                <span>
                  {address ? `${address.slice(0, 10)}...${address.slice(-8)}` : '—'}
                </span>
                <button
                  onClick={copyAddress}
                  className="-m-2 rounded-lg p-3 text-slate-400 hover:bg-surface-elevated hover:text-white"
                  title={L('Copiar dirección', 'Copy address', 'Copiar endereço')}
                  aria-label={L('Copiar dirección', 'Copy address', 'Copiar endereço')}
                >
                  <Copy className="h-3.5 w-3.5" />
                </button>
                {copied && <span className="text-[10px] text-accent font-sans">{L('¡Copiado!', 'Copied!', 'Copiado!')}</span>}
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
                <span>{L('Cerrar sesión', 'Sign out', 'Encerrar sessão')}</span>
              </button>
            ) : isConnected ? (
              <button
                onClick={() => signIn()}
                disabled={isLoading}
                className="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-xs font-semibold text-white hover:bg-primary-hover shadow-md shadow-primary/20 transition active:scale-95"
              >
                <Sparkles className="h-3.5 w-3.5" />
                <span>{isLoading ? t('signing') : t('signSession')}</span>
              </button>
            ) : (
              <span className="text-xs text-slate-500">{L('Conecta tu wallet para identificarte', 'Connect your wallet to sign in', 'Conecte sua carteira para se identificar')}</span>
            )}
          </div>
        </div>

        {/* Reputation stats: real Base Mainnet activity of the signed-in user only */}
        <div className="mt-8 grid grid-cols-2 gap-4 border-t border-border/80 pt-6 sm:grid-cols-4">
          <div className="rounded-xl border border-border/60 bg-background/50 p-4">
            <span className="text-xs text-slate-400">{L('Servicios completados', 'Completed services', 'Serviços concluídos')}</span>
            <p className="mt-1 text-2xl font-extrabold text-white">{statsLoaded ? stats.completed : '—'}</p>
            <span className="text-[11px] text-accent">
              {statsLoaded && stats.successRate !== null ? (L(`${stats.successRate}% tasa de éxito`, `${stats.successRate}% success rate`, `${stats.successRate}% de taxa de sucesso`)) : (L('Sin entregas liberadas aún', 'No released orders yet', 'Nenhuma entrega liberada ainda'))}
            </span>
          </div>

          <div className="rounded-xl border border-border/60 bg-background/50 p-4">
            <span className="text-xs text-slate-400">{L('Calificación promedio', 'Average rating', 'Avaliação média')}</span>
            <div className="mt-1 flex items-baseline gap-1.5">
              <span className="text-2xl font-extrabold text-white">
                {statsLoaded && stats.avgRating !== null ? stats.avgRating.toFixed(2) : '—'}
              </span>
              {stats.avgRating !== null && <Star className="h-4 w-4 fill-amber-400 text-amber-400" />}
            </div>
            <span className="text-[11px] text-slate-400">
              {statsLoaded && stats.reviewCount > 0
                ? (L(`Sobre ${stats.reviewCount} ${stats.reviewCount === 1 ? 'reseña' : 'reseñas'}`, `From ${stats.reviewCount} ${stats.reviewCount === 1 ? 'review' : 'reviews'}`, `De ${stats.reviewCount} ${stats.reviewCount === 1 ? 'avaliação' : 'avaliações'}`))
                : (L('Sin reseñas todavía', 'No reviews yet', 'Ainda sem avaliações'))}
            </span>
          </div>

          <div className="rounded-xl border border-border/60 bg-background/50 p-4">
            <span className="text-xs text-slate-400">{L('Disputas abiertas', 'Open disputes', 'Disputas abertas')}</span>
            <p className={`mt-1 text-2xl font-extrabold ${stats.openDisputes > 0 ? 'text-amber-400' : 'text-white'}`}>
              {statsLoaded ? stats.openDisputes : '—'}
            </p>
            <span className="text-[11px] text-slate-400">
              {statsLoaded
                ? (stats.openDisputes > 0 ? (L('En revisión', 'Under review', 'Em revisão')) : (L('Ninguna abierta', 'None open', 'Nenhuma aberta')))
                : (L('Inicia sesión para verlo', 'Sign in to see it', 'Entre para ver'))}
            </span>
          </div>

          <div className="rounded-xl border border-border/60 bg-background/50 p-4">
            <span className="text-xs text-slate-400">{L('Volumen transaccionado', 'Volume', 'Volume transacionado')}</span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-2xl font-extrabold text-white">
                {statsLoaded ? stats.volumeUsdc.toLocaleString('en-US', { maximumFractionDigits: 2 }) : '—'}
              </span>
              <span className="text-xs font-bold text-usdc">USDC</span>
            </div>
            <span className="text-[11px] text-slate-400">{L('Liquidado en Base Mainnet', 'Settled on Base Mainnet', 'Liquidado na Base Mainnet')}</span>
          </div>
        </div>
      </div>

      {/* Edit Profile Form */}
      <div className="mt-8 rounded-2xl border border-border bg-surface p-6 sm:p-8">
        <h2 className="text-lg font-bold text-white">{L('Editar perfil público', 'Edit public profile', 'Editar perfil público')}</h2>
        <p className="mt-1 text-xs text-slate-400">
          {L('Esta información será visible para compradores y vendedores en tus servicios publicados.', 'Buyers and sellers will see this information on the services you publish.', 'Compradores e vendedores verão estas informações nos serviços que você publicar.')}
        </p>

        {saveSuccess && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-accent/30 bg-accent/10 p-3 text-xs font-semibold text-accent">
            <CheckCircle className="h-4 w-4 shrink-0 text-accent" />
            <span>{L('Perfil actualizado.', 'Profile updated.', 'Perfil atualizado.')}</span>
          </div>
        )}

        {saveError && (
          <div className="mt-4 flex items-center gap-2 rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs font-semibold text-red-400">
            <AlertCircle className="h-4 w-4 shrink-0" />
            <span>{saveError}</span>
          </div>
        )}

        <form onSubmit={handleSaveProfile} className="mt-6 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-slate-300">
                {L('Nombre a mostrar', 'Display name', 'Nome de exibição')}
              </label>
              <input
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={L('ej. Carlos M.', 'e.g. Alex Rivera', 'ex. Ana S.')}
                className="mt-1.5 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-primary focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-medium uppercase tracking-wider text-slate-300">
                {L('País (código ISO de 2 letras)', 'Country (2-letter ISO code)', 'País (código ISO de 2 letras)')}
              </label>
              <input
                type="text"
                maxLength={2}
                value={country}
                onChange={(e) => setCountry(e.target.value.toUpperCase())}
                placeholder={L('ej. UY, AR, US', 'e.g. US, UY, AR', 'ex. BR, PT, UY')}
                className="mt-1.5 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-primary focus:outline-none uppercase"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium uppercase tracking-wider text-slate-300">
              {L('Biografía / presentación profesional', 'Bio', 'Bio / apresentação profissional')}
            </label>
            <textarea
              rows={3}
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              placeholder={
                L('Desarrollador fullstack con 5 años de experiencia en Solidity y Next.js...', 'Full-stack developer with 5 years of experience in Solidity and Next.js...', 'Desenvolvedor full-stack com 5 anos de experiência em Solidity e Next.js...')
              }
              className="mt-1.5 w-full rounded-xl border border-border bg-background px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:border-primary focus:outline-none"
            />
          </div>

          <button
            type="submit"
            disabled={isSaving || !isAuthenticated}
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-primary/20 transition hover:bg-primary-hover active:scale-95 disabled:opacity-50"
          >
            <Save className="h-4 w-4" />
            <span>{isSaving ? (L('Guardando...', 'Saving...', 'Salvando...')) : (L('Guardar cambios', 'Save changes', 'Salvar alterações'))}</span>
          </button>

          {!isAuthenticated && isConnected && (
            <p className="text-xs text-amber-400">
              {L('Debes firmar sesión con tu wallet para guardar cambios en tu perfil.', 'Sign in with your wallet to save changes to your profile.', 'Entre com sua carteira para salvar as alterações do perfil.')}
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
