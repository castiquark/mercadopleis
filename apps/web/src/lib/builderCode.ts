import { Attribution } from 'ox/erc8021';
import type { Hex } from 'viem';

// Base Builder Code (ERC-8021): appended to escrow transaction calldata so Base can
// attribute onchain activity to mercadopleis. No contract changes required.
export const BUILDER_CODE = 'bc_dmphihka';

export const BUILDER_DATA_SUFFIX: Hex = Attribution.toDataSuffix({ codes: [BUILDER_CODE] });
