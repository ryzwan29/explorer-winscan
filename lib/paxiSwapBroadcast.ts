// Helper function to broadcast Paxi swap transaction
// Uses Keplr signing + direct broadcast to RPC

import { coins } from '@cosmjs/stargate';

export interface SwapParams {
  creator: string;
  prc20: string;
  offerDenom: string;
  offerAmount: string;
  minReceive: string;
}

export async function broadcastPaxiSwap(
  chainId: string,
  rpcEndpoint: string,
  swapParams: SwapParams,
  gasLimit: number = 250000
): Promise<string> {
  if (typeof window === 'undefined' || !window.keplr) {
    throw new Error('Keplr not found');
  }

  // Enable chain
  await window.keplr.enable(chainId);

  // Get account
  const key = await window.keplr.getKey(chainId);
  const signerAddress = key.bech32Address;

  if (signerAddress !== swapParams.creator) {
    throw new Error('Signer address mismatch');
  }

  // Import required modules
  const { SigningStargateClient } = await import('@cosmjs/stargate');
  const offlineSigner = window.keplr.getOfflineSigner(chainId);

  // Connect client
  const client = await SigningStargateClient.connectWithSigner(
    rpcEndpoint,
    offlineSigner
  );

  // Create message - Paxi module accepts this format
  const msg = {
    typeUrl: '/x.swap.types.MsgSwap',
    value: {
      creator: swapParams.creator,
      prc20: swapParams.prc20,
      offerDenom: swapParams.offerDenom,
      offerAmount: swapParams.offerAmount,
      minReceive: swapParams.minReceive,
    },
  };

  // Calculate fee
  const feeAmount = Math.ceil(gasLimit * 0.025);
  const fee = {
    amount: coins(feeAmount, 'upaxi'),
    gas: gasLimit.toString(),
  };

  try {
    // Broadcast using sendEncoded - bypasses type registration
    const result = await (client as any).signAndBroadcast(
      signerAddress,
      [msg],
      fee,
      'Paxi Swap'
    );

    if (result.code !== 0) {
      throw new Error(`Transaction failed: ${result.rawLog}`);
    }

    return result.transactionHash;
  } catch (error) {
    console.error('Swap broadcast error:', error);
    throw error;
  }
}
