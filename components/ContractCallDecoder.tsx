'use client';
import { useState, useEffect } from 'react';
import { Code, ChevronDown, ChevronUp, Copy } from 'lucide-react';
import { DecodedContractCall } from '@/types/contract';
import { ABIDecoder } from '@/lib/abiDecoder';

interface ContractCallDecoderProps {
  input: string;
  to?: string;
  abi?: string;
}

export default function ContractCallDecoder({ input, to, abi }: ContractCallDecoderProps) {
  const [decoded, setDecoded] = useState<DecodedContractCall | null>(null);
  const [expanded, setExpanded] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    decodeInput();
  }, [input, abi]);

  const decodeInput = async () => {
    if (!input || input === '0x') {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      
      if (abi) {
        // Use provided ABI
        const decoder = new ABIDecoder(abi);
        const result = decoder.decodeInput(input);
        setDecoded(result);
      } else {
        // Try to fetch ABI from contract address
        // TODO: Implement API call to get ABI
        const decoder = new ABIDecoder();
        const result = decoder.decodeInput(input);
        setDecoded(result);
      }
    } catch (error) {
      console.error('Failed to decode input:', error);
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  if (loading) {
    return (
      <div className="bg-[#111] border border-gray-800 rounded-lg p-4">
        <div className="flex items-center gap-2 text-gray-400">
          <Code className="w-4 h-4 animate-pulse" />
          <span className="text-sm">Decoding contract call...</span>
        </div>
      </div>
    );
  }

  if (!decoded) {
    return null;
  }

  return (
    <div className="bg-[#111] border border-gray-800 rounded-lg overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-4 hover:bg-gray-800/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-500/10 rounded-lg flex items-center justify-center">
            <Code className="w-4 h-4 text-blue-400" />
          </div>
          <div className="text-left">
            <div className="flex items-center gap-2">
              <span className="text-sm font-medium text-white">{decoded.methodName}</span>
              <span className="text-xs text-gray-500 font-mono">{decoded.methodId}</span>
            </div>
            <span className="text-xs text-gray-400">{decoded.functionSignature}</span>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="w-5 h-5 text-gray-400" />
        ) : (
          <ChevronDown className="w-5 h-5 text-gray-400" />
        )}
      </button>

      {/* Expanded Content */}
      {expanded && (
        <div className="border-t border-gray-800 p-4 space-y-4">
          {/* Parameters */}
          {decoded.params.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-white mb-3">Function Parameters</h4>
              <div className="space-y-3">
                {decoded.params.map((param, index) => (
                  <div key={index} className="bg-black rounded-lg p-3">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium text-blue-400">{param.name}</span>
                        <span className="text-xs text-gray-500 font-mono">({param.type})</span>
                      </div>
                      <button
                        onClick={() => copyToClipboard(param.displayValue)}
                        className="text-gray-500 hover:text-gray-300 transition-colors"
                        title="Copy value"
                      >
                        <Copy className="w-3 h-3" />
                      </button>
                    </div>
                    <div className="text-sm text-gray-300 font-mono break-all">
                      {param.displayValue}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Raw Input */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-white">Raw Input Data</h4>
              <button
                onClick={() => copyToClipboard(decoded.rawInput)}
                className="flex items-center gap-1 text-xs text-gray-400 hover:text-gray-300 transition-colors"
              >
                <Copy className="w-3 h-3" />
                Copy
              </button>
            </div>
            <div className="bg-black rounded-lg p-3">
              <pre className="text-xs text-gray-400 font-mono break-all whitespace-pre-wrap">
                {decoded.rawInput}
              </pre>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
