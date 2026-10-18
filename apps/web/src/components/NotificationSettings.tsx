'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, BellOff, Send, CheckCircle2, AlertCircle } from 'lucide-react';
import { useLanguage } from '@/lib/languageContext';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

interface Status {
  push: { available: boolean; publicKey: string | null };
  telegram: { available: boolean; linked: boolean };
}

function urlBase64ToUint8Array(base64: string) {
  const padded = (base64 + '='.repeat((4 - (base64.length % 4)) % 4)).replace(/-/g, '+').replace(/_/g, '/');
  const raw = atob(padded);
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

const pushSupported = () =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

const isIosNotInstalled = () =>
  typeof window !== 'undefined' &&
  /iphone|ipad|ipod/i.test(navigator.userAgent) &&
  !window.matchMedia('(display-mode: standalone)').matches;

/** Browser push and Telegram notifications for the signed-in user (profile page). */
export function NotificationSettings({ token }: { token: string | null }) {
  const { L, language } = useLanguage();
  const [status, setStatus] = useState<Status | null>(null);
  const [subscribed, setSubscribed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ ok: boolean; text: string } | null>(null);
  const poll = useRef<ReturnType<typeof setInterval> | null>(null);

  const call = useCallback(
    async (path: string, method = 'GET', body?: unknown) => {
      const res = await fetch(`${API_URL}${path}`, {
        method,
        headers: { Authorization: `Bearer ${token}`, ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(json.error || `HTTP ${res.status}`);
      return json;
    },
    [token]
  );

  const refresh = useCallback(async () => {
    if (!token) return;
    try {
      setStatus(await call('/me/notifications'));
    } catch {
      setStatus(null);
    }
    if (pushSupported()) {
      const reg = await navigator.serviceWorker.getRegistration('/sw.js');
      setSubscribed(Boolean(await reg?.pushManager.getSubscription()));
    }
  }, [token, call]);

  useEffect(() => {
    refresh();
    return () => {
      if (poll.current) clearInterval(poll.current);
    };
  }, [refresh]);

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setNotice(null);
    try {
      await fn();
    } catch (err: any) {
      setNotice({ ok: false, text: err?.message || L('Algo salió mal.', 'Something went wrong.', 'Algo deu errado.') });
    } finally {
      setBusy(false);
    }
  };

  const enablePush = () =>
    run(async () => {
      if (!status?.push.publicKey) return;
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        throw new Error(
          L(
            'El navegador bloqueó los avisos. Actívalos en la configuración del sitio y vuelve a intentar.',
            'The browser blocked notifications. Allow them in the site settings and try again.',
            'O navegador bloqueou os avisos. Permita nas configurações do site e tente de novo.'
          )
        );
      }
      const reg = await navigator.serviceWorker.register('/sw.js');
      await navigator.serviceWorker.ready;
      const sub =
        (await reg.pushManager.getSubscription()) ||
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(status.push.publicKey) }));
      await call('/me/notifications/push', 'POST', { ...sub.toJSON(), lang: language });
      setSubscribed(true);
      setNotice({ ok: true, text: L('Avisos activados en este navegador.', 'Notifications enabled in this browser.', 'Avisos ativados neste navegador.') });
    });

  const disablePush = () =>
    run(async () => {
      const reg = await navigator.serviceWorker.getRegistration('/sw.js');
      const sub = await reg?.pushManager.getSubscription();
      if (sub) {
        await call('/me/notifications/push', 'DELETE', { endpoint: sub.endpoint }).catch(() => undefined);
        await sub.unsubscribe();
      }
      setSubscribed(false);
    });

  const linkTelegram = () =>
    run(async () => {
      const { url } = await call('/me/notifications/telegram', 'POST', { lang: language });
      window.open(url, '_blank', 'noopener');
      setNotice({
        ok: true,
        text: L(
          'Se abrió Telegram: pulsa "Iniciar" en el chat del bot. El enlace vence en 15 minutos.',
          'Telegram opened: press "Start" in the bot chat. The link expires in 15 minutes.',
          'O Telegram abriu: toque em "Iniciar" no chat do bot. O link expira em 15 minutos.'
        ),
      });
      // Wait for the bot to confirm the link.
      if (poll.current) clearInterval(poll.current);
      let tries = 0;
      poll.current = setInterval(async () => {
        tries += 1;
        const s: Status = await call('/me/notifications').catch(() => null);
        if (s) setStatus(s);
        if (s?.telegram.linked || tries > 60) {
          if (poll.current) clearInterval(poll.current);
          if (s?.telegram.linked) setNotice({ ok: true, text: L('Telegram vinculado.', 'Telegram linked.', 'Telegram vinculado.') });
        }
      }, 3000);
    });

  const unlinkTelegram = () =>
    run(async () => {
      await call('/me/notifications/telegram', 'DELETE');
      await refresh();
    });

  const sendTest = () =>
    run(async () => {
      await call('/me/notifications/test', 'POST');
      setNotice({ ok: true, text: L('Aviso de prueba enviado.', 'Test notification sent.', 'Aviso de teste enviado.') });
    });

  if (!token) return null;
  const nothingOffered = status && !status.push.available && !status.telegram.available;

  const btn = 'inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition disabled:opacity-50';
  return (
    <div className="mt-8 rounded-2xl border border-border bg-surface p-6 sm:p-8">
      <h2 className="flex items-center gap-2 text-lg font-bold text-white">
        <Bell className="h-5 w-5 text-primary-light" /> {L('Notificaciones', 'Notifications', 'Notificações')}
      </h2>
      <p className="mt-1 text-xs text-slate-400">
        {L(
          'Te avisamos cuando fondean, entregan o pagan una orden, cuando llega un mensaje o una propuesta y cuando se abre o resuelve una disputa. Los avisos no incluyen el contenido de los mensajes.',
          'We notify you when an order is funded, delivered or paid, when a message or proposal arrives and when a dispute is opened or resolved. Notifications never include message contents.',
          'Avisamos quando um pedido recebe depósito, é entregue ou pago, quando chega uma mensagem ou proposta e quando uma disputa é aberta ou resolvida. Os avisos não incluem o conteúdo das mensagens.'
        )}
      </p>

      {nothingOffered && (
        <p className="mt-4 text-sm text-slate-400">
          {L('Las notificaciones todavía no están activas en el sitio.', 'Notifications are not enabled on the site yet.', 'As notificações ainda não estão ativas no site.')}
        </p>
      )}

      <div className="mt-5 space-y-4">
        {status?.push.available && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/80 bg-background/50 p-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white">{L('Este navegador', 'This browser', 'Este navegador')}</p>
              <p className="text-xs text-slate-400">
                {!pushSupported()
                  ? L('Este navegador no admite avisos.', 'This browser does not support notifications.', 'Este navegador não suporta avisos.')
                  : isIosNotInstalled()
                    ? L(
                        'En iPhone, primero agrega el sitio a la pantalla de inicio (Compartir → Agregar a inicio) y ábrelo desde ahí.',
                        'On iPhone, first add the site to your Home Screen (Share → Add to Home Screen) and open it from there.',
                        'No iPhone, primeiro adicione o site à tela de início (Compartilhar → Adicionar à Tela de Início) e abra por lá.'
                      )
                    : subscribed
                      ? L('Activado: recibirás avisos aunque el sitio esté cerrado.', 'On: you get notifications even with the site closed.', 'Ativado: você recebe avisos mesmo com o site fechado.')
                      : L('Recibe avisos en esta computadora o celular.', 'Get notifications on this computer or phone.', 'Receba avisos neste computador ou celular.')}
              </p>
            </div>
            {pushSupported() && !isIosNotInstalled() &&
              (subscribed ? (
                <button onClick={disablePush} disabled={busy} className={`${btn} border border-border text-slate-300 hover:text-white`}>
                  <BellOff className="h-4 w-4" /> {L('Desactivar', 'Turn off', 'Desativar')}
                </button>
              ) : (
                <button onClick={enablePush} disabled={busy} className={`${btn} bg-primary text-white hover:bg-primary-hover`}>
                  <Bell className="h-4 w-4" /> {L('Activar', 'Turn on', 'Ativar')}
                </button>
              ))}
          </div>
        )}

        {status?.telegram.available && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border/80 bg-background/50 p-4">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white">Telegram</p>
              <p className="text-xs text-slate-400">
                {status.telegram.linked
                  ? L('Vinculado: los avisos llegan a tu chat con el bot.', 'Linked: notifications arrive in your chat with the bot.', 'Vinculado: os avisos chegam no seu chat com o bot.')
                  : L('Recibe los avisos en un chat privado con nuestro bot.', 'Get notifications in a private chat with our bot.', 'Receba os avisos em um chat privado com nosso bot.')}
              </p>
            </div>
            {status.telegram.linked ? (
              <button onClick={unlinkTelegram} disabled={busy} className={`${btn} border border-border text-slate-300 hover:text-white`}>
                {L('Desvincular', 'Unlink', 'Desvincular')}
              </button>
            ) : (
              <button onClick={linkTelegram} disabled={busy} className={`${btn} bg-[#229ED9] text-white hover:opacity-90`}>
                <Send className="h-4 w-4" /> {L('Vincular Telegram', 'Link Telegram', 'Vincular Telegram')}
              </button>
            )}
          </div>
        )}

        {(subscribed || status?.telegram.linked) && (
          <button onClick={sendTest} disabled={busy} className="text-xs font-semibold text-primary-light hover:underline disabled:opacity-50">
            {L('Enviar un aviso de prueba', 'Send a test notification', 'Enviar um aviso de teste')}
          </button>
        )}
      </div>

      {notice && (
        <div
          className={`mt-4 flex items-start gap-2 rounded-xl border p-3 text-xs ${
            notice.ok ? 'border-accent/30 bg-accent/10 text-accent' : 'border-red-500/30 bg-red-500/10 text-red-400'
          }`}
        >
          {notice.ok ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
          <span>{notice.text}</span>
        </div>
      )}
    </div>
  );
}
