// Paxi Swap Module Types
// Based on https://mainnet-lcd.paxinet.io/swagger/

export interface MsgSwap {
  creator: string;
  prc20: string;
  offerDenom: string; // "upaxi" or PRC20 contract address
  offerAmount: string; // string to support big.Int
  minReceive: string; // slippage protection
}

export interface MsgProvideLiquidity {
  creator: string;
  prc20: string;
  paxiAmount: string;
  prc20Amount: string;
}

export interface MsgWithdrawLiquidity {
  creator: string;
  prc20: string;
  lpAmount: string;
}

// Type URLs for messages
export const PAXI_SWAP_TYPE_URL = '/x.swap.types.MsgSwap';
export const PAXI_PROVIDE_LIQUIDITY_TYPE_URL = '/x.swap.types.MsgProvideLiquidity';
export const PAXI_WITHDRAW_LIQUIDITY_TYPE_URL = '/x.swap.types.MsgWithdrawLiquidity';

// Helper function to create encoded message for Paxi swap
export function createSwapMessage(msg: MsgSwap) {
  return {
    typeUrl: PAXI_SWAP_TYPE_URL,
    value: msg,
  };
}

export function createProvideLiquidityMessage(msg: MsgProvideLiquidity) {
  return {
    typeUrl: PAXI_PROVIDE_LIQUIDITY_TYPE_URL,
    value: msg,
  };
}

export function createWithdrawLiquidityMessage(msg: MsgWithdrawLiquidity) {
  return {
    typeUrl: PAXI_WITHDRAW_LIQUIDITY_TYPE_URL,
    value: msg,
  };
}
