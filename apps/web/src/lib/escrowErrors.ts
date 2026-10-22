/**
 * Decodes MarketplaceEscrow custom errors from a viem error (usually thrown by
 * simulateContract) so the orders page can show the real reason instead of the
 * wallet's generic "exceeds max transaction gas limit".
 */

export type EscrowErrorName =
  | 'InvalidStatus'
  | 'Unauthorized'
  | 'DeadlineNotPassed'
  | 'AutoReleaseNotReady'
  | 'EnforcedPause'
  // escrow v3
  | 'DeadlinePassed'
  | 'DisputeTimeoutNotReached'
  | 'NothingToWithdraw'
  | 'InvalidRuling'
  | 'TokenNotAccepted';

export interface DecodedEscrowError {
  name: EscrowErrorName;
  args: readonly unknown[];
}

const KNOWN = new Set<string>([
  'InvalidStatus', 'Unauthorized', 'DeadlineNotPassed', 'AutoReleaseNotReady', 'EnforcedPause',
  'DeadlinePassed', 'DisputeTimeoutNotReached', 'NothingToWithdraw', 'InvalidRuling', 'TokenNotAccepted',
]);

// Order of MarketplaceEscrow.OrderStatus.
const ONCHAIN_STATUS = ['NONE', 'FUNDED', 'DELIVERED', 'RELEASED', 'REFUNDED', 'DISPUTED', 'RESOLVED'] as const;
export type OnchainStatus = (typeof ONCHAIN_STATUS)[number];

export function onchainStatusName(value: unknown): OnchainStatus | null {
  const i = Number(value);
  return Number.isInteger(i) && i >= 0 && i < ONCHAIN_STATUS.length ? ONCHAIN_STATUS[i] : null;
}

export function decodeEscrowError(err: any): DecodedEscrowError | null {
  if (!err) return null;
  const pick = (e: any): DecodedEscrowError | null => {
    const data = e?.data;
    const name = data?.errorName ?? e?.errorName;
    if (typeof name === 'string' && KNOWN.has(name)) return { name: name as EscrowErrorName, args: data?.args ?? e?.args ?? [] };
    return null;
  };
  if (typeof err.walk === 'function') {
    let found: DecodedEscrowError | null = null;
    err.walk((e: any) => {
      found = found ?? pick(e);
      return !!found;
    });
    if (found) return found;
  }
  let e = err;
  for (let depth = 0; e && depth < 6; depth++, e = e.cause) {
    const found = pick(e);
    if (found) return found;
  }
  return null;
}

type Lfn = (es: string, en: string, pt: string) => string;

const STATUS_LABEL: Record<OnchainStatus, [string, string, string]> = {
  NONE: ['inexistente', 'not found', 'inexistente'],
  FUNDED: ['financiada', 'funded', 'financiado'],
  DELIVERED: ['entregada', 'delivered', 'entregue'],
  RELEASED: ['liberada', 'released', 'liberado'],
  REFUNDED: ['reembolsada', 'refunded', 'reembolsado'],
  DISPUTED: ['en disputa', 'disputed', 'em disputa'],
  RESOLVED: ['resuelta', 'resolved', 'resolvido'],
};

export function escrowErrorMessage(decoded: DecodedEscrowError, L: Lfn): string {
  switch (decoded.name) {
    case 'InvalidStatus': {
      const s = onchainStatusName(decoded.args[0]);
      const label = s ? L(...STATUS_LABEL[s]) : '?';
      return L(
        `Esta acción ya no es posible: en el contrato la orden está ${label}. Actualizamos la lista.`,
        `This action is no longer possible: on-chain the order is ${label}. The list has been refreshed.`,
        `Esta ação não é mais possível: no contrato o pedido está ${label}. A lista foi atualizada.`
      );
    }
    case 'Unauthorized':
      return L(
        'Tu wallet conectada no es la parte de esta orden que puede hacer esta acción. Cambia a la wallet correcta.',
        'Your connected wallet is not the party of this order allowed to do this. Switch to the right wallet.',
        'Sua carteira conectada não é a parte deste pedido que pode fazer esta ação. Mude para a carteira correta.'
      );
    case 'DeadlineNotPassed':
      return L(
        'Todavía no venció el plazo de entrega; el reembolso estará disponible después.',
        'The delivery deadline has not passed yet; the refund becomes available afterwards.',
        'O prazo de entrega ainda não venceu; o reembolso ficará disponível depois.'
      );
    case 'AutoReleaseNotReady':
      return L(
        'El período de revisión del comprador todavía no terminó; podrás cobrar cuando termine.',
        "The buyer's review period has not ended yet; you can claim once it does.",
        'O período de revisão do comprador ainda não terminou; você poderá receber quando terminar.'
      );
    case 'EnforcedPause':
      return L(
        'El escrow está pausado temporalmente. Inténtalo más tarde.',
        'The escrow is temporarily paused. Try again later.',
        'O escrow está pausado temporariamente. Tente novamente mais tarde.'
      );
    case 'DeadlinePassed':
      return L(
        'El plazo de entrega ya venció: el contrato no acepta entregas fuera de plazo. Si quien compra acepta otra fecha, puede extender el plazo.',
        'The delivery deadline has passed: the contract does not accept late deliveries. The buyer can extend the deadline if they agree to a new date.',
        'O prazo de entrega já venceu: o contrato não aceita entregas fora do prazo. Se quem compra aceitar outra data, pode estender o prazo.'
      );
    case 'DisputeTimeoutNotReached':
      return L(
        'La disputa todavía está dentro de los 14 días que tiene el árbitro para decidir.',
        'The dispute is still within the 14 days the arbitrator has to decide.',
        'A disputa ainda está dentro dos 14 dias que o árbitro tem para decidir.'
      );
    case 'NothingToWithdraw':
      return L(
        'No tienes saldo para retirar en este escrow.',
        'You have no balance to withdraw from this escrow.',
        'Você não tem saldo para sacar neste escrow.'
      );
    case 'InvalidRuling':
      return L('Decisión no válida para esta disputa.', 'Invalid ruling for this dispute.', 'Decisão inválida para esta disputa.');
    case 'TokenNotAccepted':
      return L(
        'El escrow no acepta este token.',
        'The escrow does not accept this token.',
        'O escrow não aceita este token.'
      );
  }
}
