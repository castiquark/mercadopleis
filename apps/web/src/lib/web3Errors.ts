/**
 * Detects if an error thrown during a Web3 wallet transaction or signature
 * was caused by the user rejecting/cancelling the request in their wallet.
 */
export function isUserRejection(err: any): boolean {
  if (!err) return false;

  // 1. Viem's BaseError.walk allows traversing nested error causes
  // (e.g. ContractFunctionExecutionError -> TransactionExecutionError -> UserRejectedRequestError)
  if (typeof err.walk === 'function') {
    const walked = err.walk((e: any) => {
      if (!e) return false;
      const code = e.code ?? e.cause?.code;
      const name = e.name || e.constructor?.name;
      const msg = typeof e.message === 'string' ? e.message.toLowerCase() : '';
      const shortMsg = typeof e.shortMessage === 'string' ? e.shortMessage.toLowerCase() : '';
      const details = typeof e.details === 'string' ? e.details.toLowerCase() : '';

      return (
        code === 4001 ||
        code === 'ACTION_REJECTED' ||
        name === 'UserRejectedRequestError' ||
        msg.includes('user rejected') ||
        msg.includes('user denied') ||
        msg.includes('rejected the request') ||
        msg.includes('denied transaction') ||
        shortMsg.includes('user rejected') ||
        shortMsg.includes('user denied') ||
        details.includes('user denied') ||
        details.includes('user rejected')
      );
    });
    if (walked) return true;
  }

  // 2. Direct error codes and names including nested causes
  if (
    err.code === 4001 ||
    err.code === 'ACTION_REJECTED' ||
    err.name === 'UserRejectedRequestError' ||
    err.cause?.code === 4001 ||
    err.cause?.name === 'UserRejectedRequestError' ||
    err.cause?.cause?.code === 4001 ||
    err.cause?.cause?.name === 'UserRejectedRequestError'
  ) {
    return true;
  }

  // 3. String inspections across error fields (covers MetaMask, Coinbase, Rainbow, Rabby, etc.)
  const fullText = (
    (err.name || '') + ' ' +
    (err.message || '') + ' ' +
    (err.shortMessage || '') + ' ' +
    (err.details || '') + ' ' +
    (err.cause?.message || '') + ' ' +
    (err.cause?.details || '') + ' ' +
    String(err)
  ).toLowerCase();

  return (
    fullText.includes('user rejected') ||
    fullText.includes('user denied') ||
    fullText.includes('rejected the request') ||
    fullText.includes('denied transaction') ||
    fullText.includes('transaction was rejected') ||
    fullText.includes('cancelada por el usuario') ||
    fullText.includes('denegó la firma') ||
    fullText.includes('denegada') ||
    fullText.includes('4001') ||
    fullText.includes('action_rejected')
  );
}
