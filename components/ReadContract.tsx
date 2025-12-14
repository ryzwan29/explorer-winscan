'use client';
import { useState } from 'react';
import { Play, Loader2, AlertCircle } from 'lucide-react';
import { ABIInput, ContractReadResult } from '@/types/contract';
import { ethers } from 'ethers';

interface ReadContractProps {
  contractAddress: string;
  abi: string;
  rpcUrl: string;
}

export default function ReadContract({ contractAddress, abi, rpcUrl }: ReadContractProps) {
  const [methods, setMethods] = useState<any[]>([]);
  const [loading, setLoading] = useState<Record<string, boolean>>({});
  const [results, setResults] = useState<Record<string, ContractReadResult>>({});
  const [inputs, setInputs] = useState<Record<string, Record<string, string>>>({});

  useState(() => {
    try {
      const parsedAbi = JSON.parse(abi);
      const readMethods = parsedAbi.filter(
        (item: any) =>
          item.type === 'function' &&
          (item.stateMutability === 'view' || item.stateMutability === 'pure')
      );
      setMethods(readMethods);
    } catch (error) {
      console.error('Failed to parse ABI:', error);
    }
  });

  const handleInputChange = (methodName: string, paramName: string, value: string) => {
    setInputs(prev => ({
      ...prev,
      [methodName]: {
        ...prev[methodName],
        [paramName]: value,
      },
    }));
  };

  const executeReadMethod = async (method: any) => {
    const methodName = method.name;
    setLoading(prev => ({ ...prev, [methodName]: true }));

    try {
      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const contract = new ethers.Contract(contractAddress, [method], provider);

      // Prepare params
      const params = method.inputs.map((input: ABIInput) => {
        const value = inputs[methodName]?.[input.name] || '';
        return value;
      });

      // Call contract method
      const result = await contract[methodName](...params);

      // Format result
      let formattedResult = result;
      if (typeof result === 'bigint') {
        formattedResult = result.toString();
      } else if (Array.isArray(result)) {
        formattedResult = result.map(r => (typeof r === 'bigint' ? r.toString() : r));
      }

      setResults(prev => ({
        ...prev,
        [methodName]: {
          success: true,
          result: formattedResult,
        },
      }));
    } catch (error: any) {
      setResults(prev => ({
        ...prev,
        [methodName]: {
          success: false,
          error: error.message || 'Failed to execute method',
        },
      }));
    } finally {
      setLoading(prev => ({ ...prev, [methodName]: false }));
    }
  };

  if (methods.length === 0) {
    return (
      <div className="text-center py-8">
        <p className="text-gray-400">No read methods available</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
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
                <span className="text-xs text-blue-400 bg-blue-500/10 px-2 py-1 rounded">
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

              {/* Query Button */}
              <button
                onClick={() => executeReadMethod(method)}
                disabled={isLoading}
                className="w-full flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white px-4 py-2.5 rounded-lg transition-colors text-sm font-medium"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Querying...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4" />
                    Query
                  </>
                )}
              </button>

              {/* Result */}
              {result && (
                <div className={`rounded-lg p-4 ${result.success ? 'bg-green-500/10 border border-green-500/30' : 'bg-red-500/10 border border-red-500/30'}`}>
                  {result.success ? (
                    <div>
                      <p className="text-xs text-green-400 font-medium mb-2">Result:</p>
                      <pre className="text-sm text-white font-mono break-all whitespace-pre-wrap">
                        {typeof result.result === 'object'
                          ? JSON.stringify(result.result, null, 2)
                          : String(result.result)}
                      </pre>
                    </div>
                  ) : (
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
