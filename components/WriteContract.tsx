'use client';
import { useState } from 'react';
import { Send, Wallet, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { ABIInput } from '@/types/contract';
import { ethers } from 'ethers';

interface WriteContractProps {
  contractAddress: string;
  abi: string;
}

export default function WriteContract({ contractAddress, abi }: WriteContractProps) {
  const [methods, setMethods] = useState<any[]>([]);
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [results, setResults] = useState<Record<string, any>>({});
  const [inputs, setInputs] = useState<Record<string, Record<string, string>>>({});
  const [connected, setConnected] = useState(false);
  const [account, setAccount] = useState<string>('');

  useState(() => {
    try {
      const parsedAbi = JSON.parse(abi);
      const writeMethods = parsedAbi.filter(
        (item: any) =>
          item.type === 'function' &&
          (item.stateMutability === 'nonpayable' || item.stateMutability === 'payable')
      );
      setMethods(writeMethods);
    } catch (error) {
      console.error('Failed to parse ABI:', error);
    }
  });

  const connectWallet = async () => {
    try {
      if (typeof window.ethereum === 'undefined') {
        alert('Please install MetaMask or another Web3 wallet');
        return;
      }

      const accounts = await window.ethereum.request({ 
        method: 'eth_requestAccounts' 
      });
      
      setAccount(accounts[0]);
      setConnected(true);
    } catch (error) {
      console.error('Failed to connect wallet:', error);
    }
  };

  const handleInputChange = (methodName: string, paramName: string, value: string) => {
    setInputs(prev => ({
      ...prev,
      [methodName]: {
        ...prev[methodName],
        [paramName]: value,
      },
    }));
  };

  const executeWriteMethod = async (method: any) => {
    if (!connected) {
      alert('Please connect your wallet first');
      return;
    }

    const methodName = method.name;
    setLoading(prev => ({ ...prev, [methodName]: true }));
    setResults(prev => ({ ...prev, [methodName]: null }));

    try {
      const provider = new ethers.BrowserProvider(window.ethereum);
      const signer = await provider.getSigner();
      const contract = new ethers.Contract(contractAddress, [method], signer);

      // Prepare params
      const params = method.inputs.map((input: ABIInput) => {
        const value = inputs[methodName]?.[input.name] || '';
        return value;
      });

      // Execute transaction
      const tx = await contract[methodName](...params);
      
      setResults(prev => ({
        ...prev,
        [methodName]: {
          status: 'pending',
          hash: tx.hash,
        },
      }));

      // Wait for confirmation
      const receipt = await tx.wait();

      setResults(prev => ({
        ...prev,
        [methodName]: {
          status: 'success',
          hash: tx.hash,
          receipt,
        },
      }));
    } catch (error: any) {
      setResults(prev => ({
        ...prev,
        [methodName]: {
          status: 'error',
          error: error.message || 'Transaction failed',
        },
      }));
    } finally {
      setLoading(prev => ({ ...prev, [methodName]: false }));
    }
  };

  if (!connected) {
    return (
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-blue-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <Wallet className="w-8 h-8 text-blue-400" />
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">Connect Your Wallet</h3>
        <p className="text-gray-400 mb-6">
          Connect your wallet to write to this contract
        </p>
        <button
          onClick={connectWallet}
          className="inline-flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg transition-colors font-medium"
        >
          <Wallet className="w-5 h-5" />
          Connect Wallet
        </button>
      </div>
    );
  }

  if (methods.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-400">No write methods available</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Connected Account */}
      <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-400" />
            <span className="text-sm text-green-400 font-medium">Wallet Connected</span>
          </div>
          <span className="text-xs text-gray-400 font-mono">
            {account.slice(0, 6)}...{account.slice(-4)}
          </span>
        </div>
      </div>

      {/* Write Methods */}
      {methods.map((method, index) => {
        const methodName = method.name;
        const isLoading = loading[methodName];
        const result = results[methodName];

        return (
          <div key={index} className="bg-black border border-gray-800 rounded-lg overflow-hidden">
            {/* Method Header */}
            <div className="bg-gray-900/50 px-4 py-3 border-b border-gray-800">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="text-sm font-medium text-white">{methodName}</h4>
                  {method.inputs.length > 0 && (
                    <p className="text-xs text-gray-500 mt-1">
                      {method.inputs.map((input: ABIInput) => `${input.type} ${input.name}`).join(', ')}
                    </p>
                  )}
                </div>
                <span className={`text-xs px-2 py-1 rounded ${
                  method.stateMutability === 'payable'
                    ? 'text-yellow-400 bg-yellow-500/10'
                    : 'text-orange-400 bg-orange-500/10'
                }`}>
                  {method.stateMutability}
                </span>
              </div>
            </div>

            {/* Method Body */}
            <div className="p-4 space-y-4">
              {/* Input Parameters */}
              {method.inputs.length > 0 && (
                <div className="space-y-3">
                  {method.inputs.map((input: ABIInput, inputIndex: number) => (
                    <div key={inputIndex}>
                      <label className="block text-xs font-medium text-gray-400 mb-2">
                        {input.name} ({input.type})
                      </label>
                      <input
                        type="text"
                        value={inputs[methodName]?.[input.name] || ''}
                        onChange={(e) => handleInputChange(methodName, input.name, e.target.value)}
                        placeholder={`Enter ${input.type}`}
                        className="w-full bg-gray-900 border border-gray-700 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>
                  ))}
                </div>
              )}

              {/* Write Button */}
              <button
                onClick={() => executeWriteMethod(method)}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 bg-orange-600 hover:bg-orange-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-lg transition-colors text-sm font-medium"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4" />
                    Write
                  </>
                )}
              </button>

              {/* Result */}
              {result && (
                <div className={`rounded-lg p-4 ${
                  result.status === 'success'
                    ? 'bg-green-500/10 border border-green-500/30'
                    : result.status === 'pending'
                    ? 'bg-yellow-500/10 border border-yellow-500/30'
                    : 'bg-red-500/10 border border-red-500/30'
                }`}>
                  {result.status === 'success' && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle className="w-4 h-4 text-green-400" />
                        <p className="text-xs text-green-400 font-medium">Transaction Successful</p>
                      </div>
                      <p className="text-xs text-gray-400 font-mono break-all">
                        Tx Hash: {result.hash}
                      </p>
                    </div>
                  )}
                  {result.status === 'pending' && (
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Loader2 className="w-4 h-4 text-yellow-400 animate-spin" />
                        <p className="text-xs text-yellow-400 font-medium">Transaction Pending</p>
                      </div>
                      <p className="text-xs text-gray-400 font-mono break-all">
                        Tx Hash: {result.hash}
                      </p>
                    </div>
                  )}
                  {result.status === 'error' && (
                    <div className="flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-red-400 flex-shrink-0 mt-0.5" />
                      <div>
                        <p className="text-xs text-red-400 font-medium mb-1">Error:</p>
                        <p className="text-sm text-red-300">{result.error}</p>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
