'use client';

// Escrow v3 pays by credit: releases, refunds, dispute settlements and fees go to a withdrawable balance in the
// contract, and each party withdraws it to their wallet. Shown to buyers, sellers and the fee recipient alike.
import { useCallback, useEffect, useState } from 'react';
import { formatUnits } from 'viem';
import { useAccount, usePublicClient, useWriteContract } from 'wagmi';
import { MarketplaceEscrowV3Abi, ESCROW_V3_ADDRESSES } from '@mercadopleis/contracts-abi';
import { useLanguage } from '@/lib/languageContext';
import { resolveNetwork } from '@/lib/networks';
import { decodeEscrowError, escrowErrorMessage } from '@/lib/escrowErrors';
import { isUserRejection } from '@/lib/web3Errors';
import { confirmTx } from '@/lib/txConfirm';
import { BUILDER_DATA_SUFFIX } from '@/lib/builderCode';

export function WithdrawPanel({ refreshKey = 0 }: { refreshKey?: number }) {
  const { address, chainId, isConnected } = useAccount();
  const network = resolveNetwork(chainId);
  const escrow = ESCROW_V3_ADDRESSES[network.isTestnet ? 84532 : 8453];
  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();
  const { L } = useLanguage();
  const [balance, setBalance] = useState<bigint | null>(null);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!publicClient || !escrow || !address || !network.supported) return setBalance(null);
    try {
      const b = (await publicClient.readContract({
        address: escrow,
        abi: MarketplaceEscrowV3Abi,
        functionName: 'withdrawable',
        args: [network.usdc, address],
      })) as bigint;
      setBalance(b);
    } catch {
      setBalance(null);
    }
  }, [publicClient, escrow, address, network.supported, network.usdc]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  if (!isConnected || !escrow || balance === null || balance === 0n) return null;
  const amount = formatUnits(balance, network.tokenDecimals);

  const withdraw = async () => {
    if (!publicClient || !address) return;
    const params = {
      address: escrow,
      abi: MarketplaceEscrowV3Abi,
      functionName: 'withdraw' as const,
      args: [network.usdc, address] as const,
    };
    try {
      setBusy(true);
      setNotice(null);
      try {
        await publicClient.simulateContract({ ...params, account: address });
      } catch (err) {
        const decoded = decodeEscrowError(err);
        throw decoded ? new Error(escrowErrorMessage(decoded, L)) : err;
      }
      const hash = await writeContractAsync({ ...params, dataSuffix: BUILDER_DATA_SUFFIX });
      await confirmTx(publicClient, hash);
      setNotice(L(`Retiraste ${amount} USDC a tu wallet.`, `You withdrew ${amount} USDC to your wallet.`, `Você sacou ${amount} USDC para sua carteira.`));
      await load();
    } catch (err: any) {
      setNotice(
        isUserRejection(err)
          ? L('Operación cancelada en tu wallet.', 'Operation cancelled in your wallet.', 'Operação cancelada na sua carteira.')
          : `Error: ${err?.shortMessage || err?.message || L('Error en la transacción', 'Transaction error', 'Erro na transação')}`
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-accent/30 bg-accent/10 p-4">
      <div>
        <p className="text-sm font-semibold text-white">
          {L('Saldo para retirar', 'Balance to withdraw', 'Saldo para sacar')}: {amount} USDC
        </p>
        <p className="mt-1 text-xs text-slate-400">
          {L(
            'Los pagos, reembolsos y resoluciones del escrow quedan acreditados en el contrato hasta que los retires a tu wallet.',
            'Escrow payouts, refunds and dispute settlements stay credited in the contract until you withdraw them to your wallet.',
            'Pagamentos, reembolsos e resoluções do escrow ficam creditados no contrato até você sacá-los para sua carteira.'
          )}{' '}
          {network.isTestnet ? '(Base Sepolia)' : ''}
        </p>
        {notice && <p className="mt-2 text-xs text-slate-200">{notice}</p>}
      </div>
      <button
        onClick={withdraw}
        disabled={busy}
        className="rounded-xl bg-accent px-4 py-2 text-sm font-semibold text-background transition hover:bg-accent/90 active:scale-95 disabled:opacity-50"
      >
        {busy ? L('Retirando…', 'Withdrawing…', 'Sacando…') : L('Retirar', 'Withdraw', 'Sacar')}
      </button>
    </div>
  );
}
