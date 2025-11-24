'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { ChainData } from '@/types/chain';
import { useLanguage } from '@/contexts/LanguageContext';
import { getTranslation } from '@/lib/i18n';
import { fetchChains } from '@/lib/apiCache';
import { FileText, Activity, Zap, Users } from 'lucide-react';

interface EVMTransaction {
  hash: string;
  blockNumber: number;
  from: string;
  to: string | null;
  value: string;
  gasPrice: string;
  gasUsed?: string;
  timestamp?: number;
}

export default function EVMTransactionsPage() {
  const params = useParams();
  const { language } = useLanguage();
  const t = (key: string) => getTranslation(language, key);
  const [chains, setChains] = useState<ChainData[]>([]);
  const [selectedChain, setSelectedChain] = useState<ChainData | null>(null);
  const [transactions, setTransactions] = useState<EVMTransaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const cachedChains = sessionStorage.getItem('chains');
    
    if (cachedChains) {
      const data = JSON.parse(cachedChains);
      setChains(data);
      const chainName = params?.chain as string;
      const chain = chainName 
        ? data.find((c: ChainData) => c.chain_name.toLowerCase().replace(/\s+/g, '-') === chainName.toLowerCase())
        : data[0];
      if (chain) setSelectedChain(chain);
    } else {
      fetchChains()
        .then(data => {
          sessionStorage.setItem('chains', JSON.stringify(data));
          setChains(data);
          const chainName = params?.chain as string;
          const chain = chainName 
            ? data.find((c: ChainData) => c.chain_name.toLowerCase().replace(/\s+/g, '-') === chainName.toLowerCase())
            : data[0];
          if (chain) setSelectedChain(chain);
        })
        .catch(err => console.error('Error loading chains:', err));
    }
  }, [params]);

  useEffect(() => {
    if (!selectedChain) return;

    const fetchTransactions = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const chainName = selectedChain.chain_name.toLowerCase().replace(/\s+/g, '-');
        const response = await fetch(`https://ssl.winsnip.xyz/api/evm/transactions?chain=${chainName}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch EVM transactions');
        }
        
        const data = await response.json();
        setTransactions(data.transactions || []);
      } catch (err) {
        console.error('Error fetching EVM transactions:', err);
        setError(err instanceof Error ? err.message : 'Failed to load EVM transactions');
      } finally {
        setLoading(false);
      }
    };

    fetchTransactions();
  }, [selectedChain]);

  const formatValue = (value: string) => {
    const ethValue = parseFloat(value) / 1e18;
    return ethValue.toFixed(6);
  };

  const truncateHash = (hash: string) => {
    return `${hash.substring(0, 10)}...${hash.substring(hash.length - 8)}`;
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex">
      <Sidebar 
        selectedChain={selectedChain}
      />
      
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header 
          chains={chains}
          selectedChain={selectedChain}
          onSelectChain={setSelectedChain}
        />
        
        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-[#0a0a0a]">
          <div className="container mx-auto px-6 py-8">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h1 className="text-3xl font-bold text-white mb-2">
                  {t('menu.evm.transactions')}
                </h1>
                <p className="text-gray-400">
                  EVM Transactions for {selectedChain?.chain_name || ''}
                </p>
              </div>
              
              <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${loading ? 'bg-blue-500 animate-pulse' : 'bg-green-500'}`}></div>
                <span className="text-xs text-gray-400">{loading ? 'Loading' : 'Live'}</span>
              </div>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-4 mb-6">
              <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400 text-sm">Total Transactions</span>
                  <FileText className="w-5 h-5 text-blue-500" />
                </div>
                <p className="text-2xl font-bold text-white">
                  {transactions.length.toLocaleString()}
                </p>
              </div>

              <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400 text-sm">Avg Value</span>
                  <Activity className="w-5 h-5 text-blue-500" />
                </div>
                <p className="text-2xl font-bold text-white">
                  {transactions.length > 0 
                    ? `${(transactions.reduce((sum, tx) => sum + parseFloat(tx.value), 0) / transactions.length / 1e18).toFixed(4)}`
                    : '-'
                  } ETH
                </p>
              </div>

              <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400 text-sm">Avg Gas Used</span>
                  <Zap className="w-5 h-5 text-blue-500" />
                </div>
                <p className="text-2xl font-bold text-white">
                  {transactions.filter(tx => tx.gasUsed).length > 0
                    ? (transactions.filter(tx => tx.gasUsed).reduce((sum, tx) => sum + parseInt(tx.gasUsed!), 0) / transactions.filter(tx => tx.gasUsed).length).toLocaleString(undefined, {maximumFractionDigits: 0})
                    : '-'
                  }
                </p>
              </div>

              <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-gray-400 text-sm">Unique Addresses</span>
                  <Users className="w-5 h-5 text-blue-500" />
                </div>
                <p className="text-2xl font-bold text-white">
                  {transactions.length > 0 
                    ? new Set([...transactions.map(tx => tx.from), ...transactions.filter(tx => tx.to).map(tx => tx.to!)]).size.toLocaleString()
                    : '-'
                  }
                </p>
              </div>
            </div>

            {loading ? (
              <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-8">
                <div className="animate-pulse space-y-4">
                  {[...Array(10)].map((_, i) => (
                    <div key={i} className="h-16 bg-gray-800 rounded"></div>
                  ))}
                </div>
              </div>
            ) : error ? (
              <div className="bg-red-900/20 border border-red-800 rounded-lg p-6">
                <p className="text-red-200">{error}</p>
              </div>
            ) : (
              <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-800">
                    <thead className="bg-[#0f0f0f]">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                          Tx Hash
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                          Block
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                          From
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                          To
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                          Value (ETH)
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-400 uppercase tracking-wider">
                          Gas Used
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-[#1a1a1a] divide-y divide-gray-800">
                      {transactions.length === 0 ? (
                        <tr>
                          <td colSpan={6} className="px-6 py-8 text-center text-gray-400">
                            No transactions found
                          </td>
                        </tr>
                      ) : (
                        transactions.map((tx) => (
                          <tr key={tx.hash} className="hover:bg-gray-800/50 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-blue-400 font-mono">
                              {truncateHash(tx.hash)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-100">
                              {tx.blockNumber}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400 font-mono">
                              {truncateHash(tx.from)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400 font-mono">
                              {tx.to ? truncateHash(tx.to) : 'Contract Creation'}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                              {formatValue(tx.value)}
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-400">
                              {tx.gasUsed ? parseInt(tx.gasUsed).toLocaleString() : '-'}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
