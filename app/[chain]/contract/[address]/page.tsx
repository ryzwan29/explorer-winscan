'use client';
import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Shield, CheckCircle, XCircle, Code, FileText, Activity, Copy, ExternalLink } from 'lucide-react';
import { ContractInfo, ContractSourceCode, ABIItem } from '@/types/contract';
import { ABIDecoder } from '@/lib/abiDecoder';

export default function ContractDetailPage() {
  const params = useParams();
  const address = params.address as string;
  const chain = params.chain as string;

  const [loading, setLoading] = useState(true);
  const [contractInfo, setContractInfo] = useState<ContractInfo | null>(null);
  const [sourceCode, setSourceCode] = useState<ContractSourceCode | null>(null);
  const [activeTab, setActiveTab] = useState<'code' | 'read' | 'write' | 'events'>('code');
  const [abiDecoder, setAbiDecoder] = useState<ABIDecoder | null>(null);

  useEffect(() => {
    loadContract();
  }, [address, chain]);

  const loadContract = async () => {
    try {
      setLoading(true);
      // TODO: Fetch from API
      const mockContract: ContractInfo = {
        address,
        name: 'USDC Token Contract',
        compiler: 'solc',
        compilerVersion: '0.8.20',
        optimization: true,
        optimizationRuns: 200,
        evmVersion: 'paris',
        verified: true,
        verifiedAt: '2024-01-15T10:30:00Z',
        license: 'MIT',
      };

      const mockSource: ContractSourceCode = {
        sourceCode: '// SPDX-License-Identifier: MIT\npragma solidity ^0.8.20;\n\ncontract Example {\n    // Contract code here\n}',
        abi: '[]',
        contractName: 'Example',
        language: 'Solidity',
      };

      setContractInfo(mockContract);
      setSourceCode(mockSource);
      
      if (mockSource.abi) {
        const decoder = new ABIDecoder(mockSource.abi);
        setAbiDecoder(decoder);
      }
    } catch (error) {
      console.error('Failed to load contract:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] pt-32 md:pt-16 pb-20">
        <div className="container mx-auto px-4">
          <div className="animate-pulse space-y-6">
            <div className="h-12 bg-gray-800 rounded"></div>
            <div className="h-64 bg-gray-800 rounded"></div>
          </div>
        </div>
      </div>
    );
  }

  if (!contractInfo) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] pt-32 md:pt-16 pb-20">
        <div className="container mx-auto px-4">
          <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6">
            <p className="text-red-400">Contract not found</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0a0a0a] pt-32 md:pt-16 pb-20">
      <div className="container mx-auto px-4">
        {/* Contract Header */}
        <div className="bg-[#111] border border-gray-800 rounded-lg p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-blue-500/10 rounded-lg flex items-center justify-center">
                <Code className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-xl md:text-2xl font-bold text-white">
                    {contractInfo.name || 'Smart Contract'}
                  </h1>
                  {contractInfo.verified && (
                    <div className="flex items-center gap-1 bg-green-500/10 px-2 py-1 rounded text-xs text-green-400 border border-green-500/30">
                      <CheckCircle className="w-3 h-3" />
                      Verified
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-1">
                  <span className="font-mono text-sm text-gray-400">{address}</span>
                  <button
                    onClick={() => copyToClipboard(address)}
                    className="text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    <Copy className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Contract Info Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
            {contractInfo.compiler && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Compiler</p>
                <p className="text-sm text-white font-medium">
                  {contractInfo.compiler} {contractInfo.compilerVersion}
                </p>
              </div>
            )}
            {contractInfo.optimization !== undefined && (
              <div>
                <p className="text-xs text-gray-500 mb-1">Optimization</p>
                <p className="text-sm text-white font-medium">
                  {contractInfo.optimization ? `Yes (${contractInfo.optimizationRuns} runs)` : 'No'}
                </p>
              </div>
            )}
            {contractInfo.evmVersion && (
              <div>
                <p className="text-xs text-gray-500 mb-1">EVM Version</p>
                <p className="text-sm text-white font-medium capitalize">{contractInfo.evmVersion}</p>
              </div>
            )}
            {contractInfo.license && (
              <div>
                <p className="text-xs text-gray-500 mb-1">License</p>
                <p className="text-sm text-white font-medium">{contractInfo.license}</p>
              </div>
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-[#111] border border-gray-800 rounded-lg overflow-hidden">
          <div className="flex border-b border-gray-800 overflow-x-auto">
            <button
              onClick={() => setActiveTab('code')}
              className={`px-6 py-4 text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === 'code'
                  ? 'bg-blue-500/10 text-blue-400 border-b-2 border-blue-500'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4" />
                Source Code
              </div>
            </button>
            <button
              onClick={() => setActiveTab('read')}
              className={`px-6 py-4 text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === 'read'
                  ? 'bg-blue-500/10 text-blue-400 border-b-2 border-blue-500'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Read Contract
              </div>
            </button>
            <button
              onClick={() => setActiveTab('write')}
              className={`px-6 py-4 text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === 'write'
                  ? 'bg-blue-500/10 text-blue-400 border-b-2 border-blue-500'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2">
                <Code className="w-4 h-4" />
                Write Contract
              </div>
            </button>
            <button
              onClick={() => setActiveTab('events')}
              className={`px-6 py-4 text-sm font-medium transition-colors whitespace-nowrap ${
                activeTab === 'events'
                  ? 'bg-blue-500/10 text-blue-400 border-b-2 border-blue-500'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <div className="flex items-center gap-2">
                <Activity className="w-4 h-4" />
                Events
              </div>
            </button>
          </div>

          <div className="p-6">
            {activeTab === 'code' && sourceCode && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold text-white">Contract Source Code</h3>
                  <button
                    onClick={() => copyToClipboard(sourceCode.sourceCode)}
                    className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors text-sm"
                  >
                    <Copy className="w-4 h-4" />
                    Copy
                  </button>
                </div>
                <div className="bg-black rounded-lg p-4 overflow-x-auto">
                  <pre className="text-sm text-gray-300 font-mono">
                    <code>{sourceCode.sourceCode}</code>
                  </pre>
                </div>

                {sourceCode.abi && (
                  <div className="mt-6">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="text-lg font-semibold text-white">Contract ABI</h3>
                      <button
                        onClick={() => copyToClipboard(sourceCode.abi)}
                        className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white rounded-lg transition-colors text-sm"
                      >
                        <Copy className="w-4 h-4" />
                        Copy ABI
                      </button>
                    </div>
                    <div className="bg-black rounded-lg p-4 overflow-x-auto">
                      <pre className="text-sm text-gray-300 font-mono">
                        <code>{JSON.stringify(JSON.parse(sourceCode.abi), null, 2)}</code>
                      </pre>
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === 'read' && (
              <div>
                <h3 className="text-lg font-semibold text-white mb-4">Read Contract Information</h3>
                <p className="text-gray-400">
                  Connect your wallet to read contract data or use public RPC endpoint.
                </p>
                {/* TODO: Implement read contract interface */}
              </div>
            )}

            {activeTab === 'write' && (
              <div>
                <h3 className="text-lg font-semibold text-white mb-4">Write Contract</h3>
                <p className="text-gray-400 mb-4">
                  Connect your wallet to interact with this contract.
                </p>
                {/* TODO: Implement write contract interface */}
              </div>
            )}

            {activeTab === 'events' && (
              <div>
                <h3 className="text-lg font-semibold text-white mb-4">Contract Events</h3>
                <p className="text-gray-400">Recent events emitted by this contract.</p>
                {/* TODO: Implement events list */}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
