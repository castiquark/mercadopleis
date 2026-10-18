// Texts of the browser push and Telegram notifications, in the three site languages.
// They never include message contents or deliverables: only what happened and where to look.

export type NotifyLang = 'es' | 'en' | 'pt';

export type NotifyEvent =
  | { type: 'order_funded' | 'order_delivered' | 'order_released' | 'order_refunded' | 'dispute_opened' | 'dispute_resolved' | 'message';
      orderId: string; contractOrderId: number | null; chainId: number | null; title: string; role: 'buyer' | 'seller' | 'admin' }
  | { type: 'proposal_received' | 'proposal_accepted'; slug: string; title: string }
  | { type: 'test' };

export interface NotifyText {
  title: string;
  body: string;
  /** Path on the site, e.g. /orders?tab=buyer&order=<id> */
  path: string;
}

export const SITE_URL = 'https://mercadopleis.club';
const SEPOLIA = 84532;

const T = {
  order_funded: {
    es: ['Nueva orden fondeada', 'La orden {n} "{t}" ya tiene el pago en el escrow. Puedes empezar.'],
    en: ['New funded order', 'Order {n} "{t}" has its payment in escrow. You can start.'],
    pt: ['Novo pedido com depósito', 'O pedido {n} "{t}" já tem o pagamento no escrow. Você pode começar.'],
  },
  order_delivered: {
    es: ['Entrega recibida', 'La orden {n} "{t}" fue entregada. Tienes 5 días para revisarla.'],
    en: ['Delivery received', 'Order {n} "{t}" was delivered. You have 5 days to review it.'],
    pt: ['Entrega recebida', 'O pedido {n} "{t}" foi entregue. Você tem 5 dias para revisar.'],
  },
  order_released: {
    es: ['Pago liberado', 'El pago de la orden {n} "{t}" fue liberado a tu wallet.'],
    en: ['Payment released', 'The payment for order {n} "{t}" was released to your wallet.'],
    pt: ['Pagamento liberado', 'O pagamento do pedido {n} "{t}" foi liberado para sua carteira.'],
  },
  order_refunded: {
    es: ['Orden reembolsada', 'La orden {n} "{t}" fue reembolsada al comprador.'],
    en: ['Order refunded', 'Order {n} "{t}" was refunded to the buyer.'],
    pt: ['Pedido reembolsado', 'O pedido {n} "{t}" foi reembolsado ao comprador.'],
  },
  dispute_opened: {
    es: ['Disputa abierta', 'Se abrió una disputa en la orden {n} "{t}". Los fondos quedan bloqueados hasta que decida el árbitro.'],
    en: ['Dispute opened', 'A dispute was opened on order {n} "{t}". The funds stay locked until the arbitrator decides.'],
    pt: ['Disputa aberta', 'Foi aberta uma disputa no pedido {n} "{t}". Os fundos ficam bloqueados até a decisão do árbitro.'],
  },
  dispute_resolved: {
    es: ['Disputa resuelta', 'El árbitro resolvió la disputa de la orden {n} "{t}".'],
    en: ['Dispute resolved', 'The arbitrator resolved the dispute on order {n} "{t}".'],
    pt: ['Disputa resolvida', 'O árbitro resolveu a disputa do pedido {n} "{t}".'],
  },
  message: {
    es: ['Mensaje nuevo', 'Tienes un mensaje nuevo en la orden {n} "{t}".'],
    en: ['New message', 'You have a new message on order {n} "{t}".'],
    pt: ['Nova mensagem', 'Você tem uma nova mensagem no pedido {n} "{t}".'],
  },
  proposal_received: {
    es: ['Propuesta nueva', 'Recibiste una propuesta para tu solicitud "{t}".'],
    en: ['New proposal', 'You received a proposal for your request "{t}".'],
    pt: ['Nova proposta', 'Você recebeu uma proposta para sua solicitação "{t}".'],
  },
  test: {
    es: ['Avisos activados', 'Así te avisaremos de entregas, pagos, mensajes y disputas.'],
    en: ['Notifications on', 'This is how we will tell you about deliveries, payments, messages and disputes.'],
    pt: ['Avisos ativados', 'É assim que vamos avisar sobre entregas, pagamentos, mensagens e disputas.'],
  },
  proposal_accepted: {
    es: ['Propuesta aceptada', 'Aceptaron tu propuesta para "{t}". Empieza cada fase cuando figure como fondeada.'],
    en: ['Proposal accepted', 'Your proposal for "{t}" was accepted. Start each phase once it shows as funded.'],
    pt: ['Proposta aceita', 'Sua proposta para "{t}" foi aceita. Comece cada etapa quando ela aparecer com depósito feito.'],
  },
} as const;

const clip = (s: string, max = 80) => (s.length > max ? `${s.slice(0, max - 1)}…` : s);

export function notifyText(event: NotifyEvent, lang: NotifyLang): NotifyText {
  const [title, body] = T[event.type][lang];
  if (event.type === 'test') return { title, body, path: '/profile' };
  if ('slug' in event) {
    return { title, body: body.replace('{t}', clip(event.title)), path: `/requests/${event.slug}` };
  }
  const n = event.contractOrderId != null ? `#${event.contractOrderId}` : '';
  const testnet = event.chainId === SEPOLIA ? ' (testnet)' : '';
  return {
    title: title + testnet,
    body: body.replace('{n} ', n ? `${n} ` : '').replace('{t}', clip(event.title)),
    path: event.role === 'admin' ? '/admin/disputes' : `/orders?tab=${event.role}&order=${event.orderId}`,
  };
}

export const asLang = (value: unknown): NotifyLang => (value === 'en' || value === 'pt' ? value : 'es');
