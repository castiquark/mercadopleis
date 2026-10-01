// Pure EIP-4361 (SIWE) message parsing and validation, kept free of I/O so it can be unit tested.

export interface ParsedSiweMessage {
  domain: string;
  address: string;
  uri: string;
  version: string;
  chainId: number;
  nonce: string;
  issuedAt: string;
  expirationTime?: string;
}

export const ALLOWED_PRODUCTION_DOMAINS = ['mercadopleis.club', 'www.mercadopleis.club'];
const LOCAL_DOMAINS = ['localhost', '127.0.0.1'];
const SUPPORTED_CHAIN_IDS = [8453, 84532];

export function parseSiweMessage(message: string): ParsedSiweMessage | null {
  try {
    const headerMatch = message.match(/^([^\n]+) wants you to sign in with your Ethereum account:\n(0x[a-fA-F0-9]{40})/);
    if (!headerMatch) return null;

    const uriMatch = message.match(/\nURI:\s*([^\n]+)/);
    const versionMatch = message.match(/\nVersion:\s*([^\n]+)/);
    const chainIdMatch = message.match(/\nChain ID:\s*([^\n]+)/);
    const nonceMatch = message.match(/\nNonce:\s*([^\n]+)/);
    const issuedAtMatch = message.match(/\nIssued At:\s*([^\n]+)/);
    const expirationMatch = message.match(/\nExpiration Time:\s*([^\n]+)/);

    if (!uriMatch || !versionMatch || !chainIdMatch || !nonceMatch || !issuedAtMatch) return null;

    return {
      domain: headerMatch[1].trim(),
      address: headerMatch[2].trim(),
      uri: uriMatch[1].trim(),
      version: versionMatch[1].trim(),
      chainId: parseInt(chainIdMatch[1].trim(), 10),
      nonce: nonceMatch[1].trim(),
      issuedAt: issuedAtMatch[1].trim(),
      expirationTime: expirationMatch ? expirationMatch[1].trim() : undefined,
    };
  } catch {
    return null;
  }
}

export type SiweValidation = { ok: true } | { ok: false; error: string };

/**
 * Validates version, domain, URI authority, chain id and freshness.
 * `reqHost` is the host the request arrived on; localhost domains are only accepted outside production.
 */
export function validateSiweMessage(
  parsed: ParsedSiweMessage,
  opts: { reqHost: string; now?: number; isProduction: boolean }
): SiweValidation {
  const now = opts.now ?? Date.now();

  if (parsed.version !== '1') {
    return { ok: false, error: `Unsupported SIWE version: ${parsed.version}. Expected version 1.` };
  }

  const reqHost = opts.reqHost.toLowerCase().trim();
  const reqHostNoPort = reqHost.split(':')[0];
  const domain = parsed.domain.toLowerCase().trim();
  const domainNoPort = domain.split(':')[0];

  const allowed = opts.isProduction ? ALLOWED_PRODUCTION_DOMAINS : [...ALLOWED_PRODUCTION_DOMAINS, ...LOCAL_DOMAINS];
  const isDomainAllowed = domain === reqHost || domainNoPort === reqHostNoPort || allowed.includes(domainNoPort);
  if (!isDomainAllowed) {
    return { ok: false, error: `Invalid SIWE domain: ${parsed.domain}. Expected Mercadopleis domain or active host.` };
  }

  let uri: URL;
  try {
    uri = new URL(parsed.uri);
  } catch {
    return { ok: false, error: `Invalid SIWE URI: ${parsed.uri}. Must be a valid URI.` };
  }
  if (uri.host.toLowerCase() !== domain) {
    return { ok: false, error: `SIWE URI authority (${uri.host}) does not match domain (${parsed.domain})` };
  }

  if (!SUPPORTED_CHAIN_IDS.includes(parsed.chainId)) {
    return { ok: false, error: `Unsupported SIWE chainId: ${parsed.chainId}. Expected 8453 or 84532.` };
  }

  const issuedAtMs = Date.parse(parsed.issuedAt);
  if (isNaN(issuedAtMs)) return { ok: false, error: 'Invalid SIWE issuedAt timestamp' };
  if (issuedAtMs > now + 60 * 1000) return { ok: false, error: 'SIWE message issuedAt timestamp is in the future' };
  if (now - issuedAtMs > 10 * 60 * 1000) return { ok: false, error: 'SIWE message has expired (>10 minutes old)' };

  if (parsed.expirationTime) {
    const expMs = Date.parse(parsed.expirationTime);
    if (isNaN(expMs) || now > expMs) return { ok: false, error: 'SIWE message expirationTime has passed' };
  }

  return { ok: true };
}
