'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { ChainData } from '@/types/chain';
import { ArrowDownUp, Settings, Info, Zap, AlertCircle } from 'lucide-react';
import { calculateFee } from '@/lib/keplr';

interface Token {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  logo?: string;
  balance?: string;
}

export default function PRC20SwapPage() {
  const params = useParams();
  const [chains, setChains] = useState<ChainData[]>([]);
  const [selectedChain, setSelectedChain] = useState<ChainData | null>(null);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [fromToken, setFromToken] = useState<Token | null>(null);
  const [toToken, setToToken] = useState<Token | null>(null);
  const [fromAmount, setFromAmount] = useState('');
  const [toAmount, setToAmount] = useState('');
  const [slippage, setSlippage] = useState('0.5');
  const [loading, setLoading] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string>('');
  const [txResult, setTxResult] = useState<{ success: boolean; txHash?: string; error?: string } | null>(null);

  useEffect(() => {
    const loadChains = async () => {
      try {
        const response = await fetch('/api/chains');
        const data = await response.json();
        setChains(data);

        const chain = data.find(
          (c: ChainData) =>
            c.chain_name.toLowerCase().replace(/\s+/g, '-') === params.chain
        );
        setSelectedChain(chain || null);
      } catch (error) {
        console.error('Error loading chains:', error);
      }
    };

    loadChains();
  }, [params.chain]);

  useEffect(() => {
    if (selectedChain) {
      loadTokens();
      checkWalletConnection();
    }
  }, [selectedChain]);

  const checkWalletConnection = async () => {
    if (!selectedChain) return;
    
    try {
      if (typeof window !== 'undefined' && (window as any).keplr) {
        // Make sure chain is added to Keplr first
        await (window as any).keplr.enable(selectedChain.chain_id);
        const key = await (window as any).keplr.getKey(selectedChain.chain_id);
        setWalletAddress(key.bech32Address);
        console.log('✅ Connected wallet:', key.bech32Address);
        
        // Immediately load balances after connection
        if (tokens.length > 0) {
          console.log('🔄 Loading balances for connected wallet...');
          loadBalances(tokens, key.bech32Address);
        }
      }
    } catch (error) {
      console.log('⚠️ Wallet not connected:', error);
    }
  };

  const loadTokens = async () => {
    try {
      // Load PRC20 tokens
      const response = await fetch(`/api/prc20/tokens?chain=${selectedChain?.chain_name}`);
      const data = await response.json();
      
      // Add native PAXI token
      const nativeToken: Token = {
        address: 'upaxi',
        name: 'PAXI',
        symbol: 'PAXI',
        decimals: 6,
        balance: '0',
      };
      
      const allTokens = [nativeToken, ...(data.tokens || [])];
      setTokens(allTokens);
      
      // Set default tokens
      if (!fromToken) setFromToken(nativeToken);
      
      // Load balances if wallet connected
      if (walletAddress) {
        loadBalances(allTokens, walletAddress);
      }
    } catch (error) {
      console.error('Error loading tokens:', error);
    }
  };

  const loadBalances = async (tokenList: Token[], address: string) => {
    if (!selectedChain?.api?.[0]?.address || !address) {
      console.log('Missing chain API or address:', { api: selectedChain?.api?.[0]?.address, address });
      return;
    }
    
    try {
      console.log('Loading balances for:', address);
      console.log('API endpoint:', selectedChain.api[0].address);
      
      // Load native balance
      const balanceUrl = `${selectedChain.api[0].address}/cosmos/bank/v1beta1/balances/${address}`;
      console.log('Fetching from:', balanceUrl);
      
      const nativeBalanceRes = await fetch(balanceUrl);
      
      if (!nativeBalanceRes.ok) {
        console.error('Failed to fetch balance:', nativeBalanceRes.status, nativeBalanceRes.statusText);
        return;
      }
      
      const nativeData = await nativeBalanceRes.json();
      console.log('Balance response:', nativeData);
      
      const paxiBalance = nativeData.balances?.find((b: any) => b.denom === 'upaxi');
      
      console.log('Native PAXI Balance:', paxiBalance?.amount || '0', 'upaxi');
      
      // Load PRC20 balances
      const updatedTokens = await Promise.all(
        tokenList.map(async (token) => {
          if (token.address === 'upaxi') {
            return {
              ...token,
              balance: paxiBalance?.amount || '0',
            };
          }
          
          try {
            const balanceRes = await fetch(
              `/api/prc20-balance?contract=${token.address}&address=${address}`
            );
            const balanceData = await balanceRes.json();
            return {
              ...token,
              balance: balanceData.balance || '0',
            };
          } catch {
            return token;
          }
        })
      );
      
      setTokens(updatedTokens);
      
      // Update selected tokens if they exist
      if (fromToken) {
        const updatedFrom = updatedTokens.find(t => t.address === fromToken.address);
        if (updatedFrom) setFromToken(updatedFrom);
      }
      if (toToken) {
        const updatedTo = updatedTokens.find(t => t.address === toToken.address);
        if (updatedTo) setToToken(updatedTo);
      }
    } catch (error) {
      console.error('Error loading balances:', error);
    }
  };

  // Reload balances when wallet address changes
  useEffect(() => {
    if (walletAddress && tokens.length > 0) {
      loadBalances(tokens, walletAddress);
    }
  }, [walletAddress]);

  // Reload balance when tokens change (especially when selecting PAXI Native)
  useEffect(() => {
    if (walletAddress && tokens.length > 0) {
      // When fromToken or toToken changes, reload their balances
      if (fromToken || toToken) {
        console.log('🔄 Token changed, reloading balances...');
        loadBalances(tokens, walletAddress);
      }
    }
  }, [fromToken?.address, toToken?.address, walletAddress, tokens.length]);

  const handleSwap = async () => {
    if (!fromToken || !toToken || !fromAmount) {
      setTxResult({ success: false, error: 'Please fill all fields' });
      return;
    }

    if (!walletAddress) {
      setTxResult({ success: false, error: 'Please connect your wallet first' });
      return;
    }

    if (!selectedChain) {
      setTxResult({ success: false, error: 'Chain not loaded' });
      return;
    }

    setLoading(true);
    try {
      // Get Keplr
      if (!(window as any).keplr) {
        throw new Error('Keplr wallet not found. Please install Keplr extension.');
      }

      const keplr = (window as any).keplr;
      const chainId = selectedChain.chain_id || selectedChain.chain_name;
      
      console.log('🚀 Starting swap transaction:', {
        chain: chainId,
        from: fromToken.symbol,
        to: toToken.symbol,
        amount: fromAmount
      });

      // Enable chain
      await keplr.enable(chainId);
      console.log('✅ Chain enabled');
      
      // Get offline signer
      const offlineSigner = await keplr.getOfflineSignerAuto(chainId);
      const accounts = await offlineSigner.getAccounts();
      
      if (accounts.length === 0) {
        throw new Error('No accounts found in wallet');
      }
      
      console.log('✅ Signer obtained, account:', accounts[0].address);
      
      // Import required libs
      const { SigningStargateClient } = await import('@cosmjs/stargate');
      
      // Connect client
      const rpcEndpoint = selectedChain.rpc?.[0]?.address || '';
      if (!rpcEndpoint) {
        throw new Error('No RPC endpoint available for this chain');
      }
      
      console.log('📡 Connecting to RPC:', rpcEndpoint);
      
      // Client options (same as staking)
      const clientOptions: any = { 
        broadcastTimeoutMs: 30000, 
        broadcastPollIntervalMs: 3000,
      };
      
      const client = await SigningStargateClient.connectWithSigner(
        rpcEndpoint, 
        offlineSigner,
        clientOptions
      );
      
      console.log('✅ Client connected');
      
      // Prepare swap transaction
      const amountInBaseUnit = (parseFloat(fromAmount) * Math.pow(10, fromToken.decimals)).toString();
      
      let msg: any;
      
      if (fromToken.address === 'upaxi') {
        // Swap PAXI to PRC20 using native swap module
        msg = {
          typeUrl: '/paxi.swap.v1.MsgSwap',
          value: {
            creator: walletAddress,
            prc20: toToken.address,
            offerDenom: 'upaxi',
            offerAmount: amountInBaseUnit,
            minReceive: '1'
          }
        };
      } else if (toToken.address === 'upaxi') {
        // Swap PRC20 to PAXI using native swap module
        msg = {
          typeUrl: '/paxi.swap.v1.MsgSwap',
          value: {
            creator: walletAddress,
            prc20: fromToken.address,
            offerDenom: fromToken.address,
            offerAmount: amountInBaseUnit,
            minReceive: '1'
          }
        };
      } else {
        // PRC20 to PRC20 swap not directly supported
        throw new Error('Direct PRC20 to PRC20 swap not supported yet. Please swap to PAXI first, then to your target token.');
      }
      
      console.log('📝 Swap message prepared:', msg);
      
      // Calculate fee using same method as staking
      const fee = calculateFee(selectedChain, '300000');
      
      console.log('💰 Fee calculated:', fee);
      
      // Sign and broadcast
      const result = await client.signAndBroadcast(
        walletAddress,
        [msg],
        fee,
        'Swap ' + fromToken.symbol + ' to ' + toToken.symbol
      );
      
      console.log('📡 Broadcast result:', result);
      
      if (result.code === 0) {
        console.log('✅ Swap successful! TxHash:', result.transactionHash);
        setTxResult({ success: true, txHash: result.transactionHash });
        
        // Reload balances after 3 seconds
        setTimeout(() => {
          if (walletAddress) {
            console.log('🔄 Reloading balances...');
            loadBalances(tokens, walletAddress);
          }
        }, 3000);
      } else {
        console.error('❌ Transaction failed:', result.rawLog);
        throw new Error(result.rawLog || 'Transaction failed');
      }
      
    } catch (error: any) {
      console.error('❌ Swap failed:', error);
      setTxResult({ 
        success: false, 
        error: error.message || 'Swap failed. Please try again.' 
      });
    } finally {
      setLoading(false);
    }
  };

  const switchTokens = () => {
    const temp = fromToken;
    setFromToken(toToken);
    setToToken(temp);
    setFromAmount(toAmount);
    setToAmount(fromAmount);
  };

  const connectWallet = async () => {
    if (!selectedChain) return;
    
    try {
      if (!(window as any).keplr) {
        setTxResult({ 
          success: false, 
          error: 'Please install Keplr wallet extension from https://www.keplr.app/' 
        });
        return;
      }
      
      await (window as any).keplr.enable(selectedChain.chain_id);
      const key = await (window as any).keplr.getKey(selectedChain.chain_id);
      setWalletAddress(key.bech32Address);
      console.log('✅ Wallet connected:', key.bech32Address);
      
      // Immediately load balances after manual connection
      if (tokens.length > 0) {
        console.log('🔄 Loading balances after wallet connection...');
        setTimeout(() => {
          loadBalances(tokens, key.bech32Address);
        }, 500); // Small delay to ensure token list is ready
      }
    } catch (error: any) {
      console.error('❌ Error connecting wallet:', error);
      setTxResult({ 
        success: false, 
        error: error.message || 'Failed to connect wallet. Please try again.' 
      });
    }
  };

  const formatBalance = (balance: string, decimals: number = 6): string => {
    if (!balance || balance === '0') return '0.0000';
    
    const num = Number(balance) / Math.pow(10, decimals);
    return num.toFixed(4);
  };

  return (
    <div className="flex min-h-screen bg-[#0a0a0a]">
      {selectedChain && <Sidebar selectedChain={selectedChain} />}

      <div className="flex-1 flex flex-col">
        <Header chains={chains} selectedChain={selectedChain} onSelectChain={setSelectedChain} />

        <main className="flex-1 mt-32 lg:mt-16 p-4 md:p-6 overflow-auto">
          {/* Page Header */}
          <div className="mb-6 text-center">
            <h1 className="text-3xl font-bold text-white mb-2">PRC20 Token Swap</h1>
            <p className="text-gray-400">Swap between PRC20 tokens instantly</p>
            
            {/* Wallet Connection */}
            {!walletAddress ? (
              <button
                onClick={connectWallet}
                className="mt-4 px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
              >
                Connect Wallet
              </button>
            ) : (
              <div className="mt-2 text-sm text-green-400">
                Connected: {walletAddress.slice(0, 10)}...{walletAddress.slice(-6)}
              </div>
            )}
          </div>

          {/* Swap Container */}
          <div className="max-w-lg mx-auto">
            <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6">
              {/* Settings Button */}
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-white">Swap</h2>
                <button
                  onClick={() => setShowSettings(!showSettings)}
                  className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
                >
                  <Settings className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              {/* Settings Panel */}
              {showSettings && (
                <div className="mb-4 p-4 bg-[#0f0f0f] border border-gray-700 rounded-lg">
                  <div className="mb-2">
                    <label className="block text-sm text-gray-400 mb-2">Slippage Tolerance</label>
                    <div className="flex gap-2">
                      {['0.1', '0.5', '1.0'].map((value) => (
                        <button
                          key={value}
                          onClick={() => setSlippage(value)}
                          className={`flex-1 px-3 py-2 rounded-lg text-sm transition-colors ${
                            slippage === value
                              ? 'bg-blue-500 text-white'
                              : 'bg-gray-800 text-gray-400 hover:bg-gray-700'
                          }`}
                        >
                          {value}%
                        </button>
                      ))}
                      <input
                        type="number"
                        value={slippage}
                        onChange={(e) => setSlippage(e.target.value)}
                        placeholder="Custom"
                        className="w-20 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* From Token */}
              <div className="mb-2">
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm text-gray-400">From</label>
                  {walletAddress && fromToken && (
                    <button
                      onClick={() => {
                        const maxAmount = formatBalance(fromToken.balance || '0', fromToken.decimals);
                        setFromAmount(maxAmount);
                      }}
                      className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                    >
                      MAX
                    </button>
                  )}
                </div>
                <div className="bg-[#0f0f0f] border border-gray-700 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <input
                      type="number"
                      value={fromAmount}
                      onChange={(e) => setFromAmount(e.target.value)}
                      placeholder="0.0"
                      className="bg-transparent text-2xl text-white font-semibold focus:outline-none w-full"
                    />
                    <select
                      value={fromToken?.address || ''}
                      onChange={(e) => {
                        const token = tokens.find(t => t.address === e.target.value);
                        setFromToken(token || null);
                      }}
                      className="ml-4 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select token</option>
                      {tokens.map((token) => (
                        <option key={token.address} value={token.address}>
                          {token.symbol}
                        </option>
                      ))}
                    </select>
                  </div>
                  {fromToken && (
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 text-gray-500">
                        {fromToken.logo && <img src={fromToken.logo} alt={fromToken.name} className="w-4 h-4 rounded-full" />}
                        <span>{fromToken.name}</span>
                      </div>
                      {walletAddress && (
                        <div className="text-gray-400">
                          Balance: <span className="text-white font-medium">{formatBalance(fromToken.balance || '0', fromToken.decimals)}</span> {fromToken.symbol}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Switch Button */}
              <div className="flex justify-center -my-2 relative z-10">
                <button
                  onClick={switchTokens}
                  className="p-2 bg-[#1a1a1a] border-2 border-gray-800 hover:border-blue-500 rounded-xl transition-colors"
                >
                  <ArrowDownUp className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              {/* To Token */}
              <div className="mb-4">
                <label className="block text-sm text-gray-400 mb-2">To</label>
                <div className="bg-[#0f0f0f] border border-gray-700 rounded-lg p-4">
                  <div className="flex justify-between items-center mb-2">
                    <input
                      type="number"
                      value={toAmount}
                      onChange={(e) => setToAmount(e.target.value)}
                      placeholder="0.0"
                      className="bg-transparent text-2xl text-white font-semibold focus:outline-none w-full"
                      readOnly
                    />
                    <select
                      value={toToken?.address || ''}
                      onChange={(e) => {
                        const token = tokens.find(t => t.address === e.target.value);
                        setToToken(token || null);
                      }}
                      className="ml-4 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select token</option>
                      {tokens.map((token) => (
                        <option key={token.address} value={token.address}>
                          {token.symbol}
                        </option>
                      ))}
                    </select>
                  </div>
                  {toToken && (
                    <div className="flex items-center justify-between text-xs">
                      <div className="flex items-center gap-2 text-gray-500">
                        {toToken.logo && <img src={toToken.logo} alt={toToken.name} className="w-4 h-4 rounded-full" />}
                        <span>{toToken.name}</span>
                      </div>
                      {walletAddress && (
                        <div className="text-gray-400">
                          Balance: <span className="text-white font-medium">{formatBalance(toToken.balance || '0', toToken.decimals)}</span> {toToken.symbol}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Swap Details */}
              {fromToken && toToken && fromAmount && (
                <div className="mb-4 p-4 bg-[#0f0f0f] border border-gray-700 rounded-lg space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Rate</span>
                    <span className="text-white">1 {fromToken.symbol} = 1.5 {toToken.symbol}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Price Impact</span>
                    <span className="text-green-400">&lt; 0.01%</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Minimum Received</span>
                    <span className="text-white">{(parseFloat(toAmount) * 0.995).toFixed(4)} {toToken.symbol}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-400">Network Fee</span>
                    <span className="text-white">~0.001 PAXI</span>
                  </div>
                </div>
              )}

              {/* Warning */}
              <div className="mb-4 flex items-start gap-2 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                <AlertCircle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-yellow-400">
                  Please review all swap details carefully. Ensure you have enough balance for network fees.
                </p>
              </div>

              {/* Swap Button */}
              {!walletAddress ? (
                <button
                  onClick={connectWallet}
                  className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-blue-500 hover:bg-blue-600 text-white font-semibold rounded-lg transition-colors"
                >
                  Connect Wallet to Swap
                </button>
              ) : (
                <button
                  onClick={handleSwap}
                  disabled={loading || !fromToken || !toToken || !fromAmount}
                  className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-700 disabled:cursor-not-allowed text-white font-semibold rounded-lg transition-colors"
                >
                  {loading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      Swapping...
                    </>
                  ) : (
                    <>
                      <Zap className="w-5 h-5" />
                      Swap
                    </>
                  )}
                </button>
              )}
            </div>

            {/* Info Cards */}
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="p-4 bg-[#1a1a1a] border border-gray-800 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Info className="w-4 h-4 text-blue-400" />
                  <h3 className="text-sm font-semibold text-white">Low Fees</h3>
                </div>
                <p className="text-xs text-gray-400">Trade with minimal network fees on PAXI</p>
              </div>
              <div className="p-4 bg-[#1a1a1a] border border-gray-800 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <Zap className="w-4 h-4 text-yellow-400" />
                  <h3 className="text-sm font-semibold text-white">Instant Swaps</h3>
                </div>
                <p className="text-xs text-gray-400">Execute swaps instantly with best rates</p>
              </div>
            </div>
          </div>
        </main>
        <Footer />
      </div>

      {/* Transaction Result Modal */}
      {txResult && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-[60] px-4">
          <div className="bg-gradient-to-br from-[#1a1a1a] to-[#0a0a0a] border border-gray-800 rounded-2xl p-8 max-w-md w-full shadow-2xl animate-scale-in">
            <div className="flex flex-col items-center text-center space-y-6">
              {txResult.success ? (
                <>
                  {/* Success Icon */}
                  <div className="relative">
                    <div className="absolute inset-0 bg-green-500/20 rounded-full blur-2xl animate-pulse"></div>
                    <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center shadow-lg shadow-green-500/50">
                      <svg className="w-10 h-10 text-white animate-bounce-slow" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  </div>
                  
                  {/* Success Message */}
                  <div className="space-y-2">
                    <h3 className="text-2xl font-bold text-white">Swap Successful!</h3>
                    <p className="text-gray-400">Your swap has been broadcast to the network</p>
                  </div>
                  
                  {/* Transaction Hash */}
                  {txResult.txHash && (
                    <div className="w-full bg-[#0a0a0a] border border-gray-800 rounded-xl p-4 space-y-2">
                      <p className="text-xs text-gray-500 uppercase tracking-wider font-medium">Transaction Hash</p>
                      <div className="flex items-center gap-2">
                        <code className="text-xs text-green-400 font-mono break-all flex-1">
                          {txResult.txHash}
                        </code>
                        <button
                          onClick={() => {
                            navigator.clipboard.writeText(txResult.txHash || '');
                          }}
                          className="p-2 hover:bg-gray-800 rounded-lg transition-colors flex-shrink-0"
                          title="Copy to clipboard"
                        >
                          <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  )}
                  
                  {/* Action Buttons */}
                  <div className="flex gap-3 w-full pt-2">
                    <button
                      onClick={() => {
                        const chainPath = selectedChain?.chain_name.toLowerCase().replace(/\s+/g, '-') || '';
                        window.open(`/${chainPath}/transactions/${txResult.txHash}`, '_blank');
                      }}
                      className="flex-1 px-4 py-3 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-medium rounded-lg transition-all hover:scale-105 active:scale-95 shadow-lg shadow-blue-500/30"
                    >
                      View Transaction
                    </button>
                    <button
                      onClick={() => setTxResult(null)}
                      className="flex-1 px-4 py-3 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-lg transition-all hover:scale-105 active:scale-95"
                    >
                      Close
                    </button>
                  </div>
                </>
              ) : (
                <>
                  {/* Error Icon */}
                  <div className="relative">
                    <div className="absolute inset-0 bg-red-500/20 rounded-full blur-2xl animate-pulse"></div>
                    <div className="relative w-20 h-20 rounded-full bg-gradient-to-br from-red-500 to-rose-600 flex items-center justify-center shadow-lg shadow-red-500/50">
                      <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </div>
                  </div>
                  
                  {/* Error Message */}
                  <div className="space-y-2">
                    <h3 className="text-2xl font-bold text-white">Swap Failed</h3>
                    <p className="text-gray-400 text-sm">{txResult.error || 'Transaction failed. Please try again.'}</p>
                  </div>
                  
                  {/* Close Button */}
                  <button
                    onClick={() => setTxResult(null)}
                    className="w-full px-4 py-3 bg-gray-800 hover:bg-gray-700 text-white font-medium rounded-lg transition-all hover:scale-105 active:scale-95"
                  >
                    Close
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
