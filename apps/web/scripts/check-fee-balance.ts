import { createPublicClient, http, defineChain, parseAbiItem } from 'viem';

const baseSepolia = defineChain({
  id: 84532,
  name: 'Base Sepolia',
  nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: ['https://sepolia.base.org'] } },
});

const client = createPublicClient({ chain: baseSepolia, transport: http('https://sepolia.base.org') });

async function main() {
  const escrowAbi = [
    parseAbiItem('function feeRecipient() external view returns (address)'),
    parseAbiItem('function feeBps() external view returns (uint256)'),
    parseAbiItem('function arbitrator() external view returns (address)'),
  ];
  const usdcAbi = [
    parseAbiItem('function balanceOf(address account) external view returns (uint256)'),
  ];

  const escrowAddress = '0x9E5b4C1112F026568233DC571Dd4120DbE9fBF48';
  const usdcAddress = '0x6Fa1279f6c760fA993B7f9aC75de5a141d7D2D8A';

  const feeRecipient = await client.readContract({
    address: escrowAddress,
    abi: escrowAbi,
    functionName: 'feeRecipient',
  });

  const feeBps = await client.readContract({
    address: escrowAddress,
    abi: escrowAbi,
    functionName: 'feeBps',
  });

  const arbitrator = await client.readContract({
    address: escrowAddress,
    abi: escrowAbi,
    functionName: 'arbitrator',
  });

  const usdcBalance = await client.readContract({
    address: usdcAddress,
    abi: usdcAbi,
    functionName: 'balanceOf',
    args: [feeRecipient],
  });

  console.log('Contract Fee Recipient:', feeRecipient);
  console.log('Contract Arbitrator:', arbitrator);
  console.log('Contract Fee BPS:', feeBps.toString(), `(${Number(feeBps) / 100}%)`);
  console.log('Fee Recipient USDC Balance:', Number(usdcBalance) / 1e6, 'USDC');
  process.exit(0);
}

main().catch(console.error);
