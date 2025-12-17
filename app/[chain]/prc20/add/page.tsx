'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { ChainData } from '@/types/chain';
import { Save, ArrowLeft, Upload, AlertCircle, CheckCircle } from 'lucide-react';
import Link from 'next/link';

export default function AddPRC20TokenPage() {
  const params = useParams();
  const router = useRouter();
  const [chains, setChains] = useState<ChainData[]>([]);
  const [selectedChain, setSelectedChain] = useState<ChainData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    address: '',
    name: '',
    symbol: '',
    decimals: '18',
    totalSupply: '',
    logo: '',
    description: '',
    website: '',
    verified: false,
  });

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      const response = await fetch('/api/prc20/add', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chain: selectedChain?.chain_name,
          ...formData,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setSuccess(true);
        setTimeout(() => {
          router.push(`/${params.chain}/prc20`);
        }, 1500);
      } else {
        setError(data.error || 'Failed to add token');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  const handleFetchFromContract = async () => {
    if (!formData.address) {
      setError('Please enter a contract address first');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const response = await fetch(
        `/api/prc20/token-detail?chain=${selectedChain?.chain_name}&address=${formData.address}`
      );
      const data = await response.json();

      if (response.ok && data.token) {
        setFormData({
          ...formData,
          name: data.token.name || formData.name,
          symbol: data.token.symbol || formData.symbol,
          decimals: data.token.decimals?.toString() || formData.decimals,
          totalSupply: data.token.totalSupply || formData.totalSupply,
        });
      } else {
        setError('Could not fetch token details. Please enter manually.');
      }
    } catch (err) {
      setError('Failed to fetch token details');
    } finally {
      setLoading(false);
    }
  };

  const chainPath = selectedChain?.chain_name.toLowerCase().replace(/\s+/g, '-') || '';

  return (
    <div className="flex min-h-screen bg-[#0a0a0a]">
      {selectedChain && <Sidebar selectedChain={selectedChain} />}

      <div className="flex-1 flex flex-col">
        <Header chains={chains} selectedChain={selectedChain} onSelectChain={setSelectedChain} />

        <main className="flex-1 mt-32 lg:mt-16 p-4 md:p-6 overflow-auto">
          {/* Page Header */}
          <div className="mb-6">
            <Link
              href={`/${chainPath}/prc20`}
              className="inline-flex items-center gap-2 text-gray-400 hover:text-white transition-colors mb-4"
            >
              <ArrowLeft className="w-4 h-4" />
              Back to Token List
            </Link>
            <h1 className="text-3xl font-bold text-white mb-2">Add PRC20 Token</h1>
            <p className="text-gray-400">Add an existing PRC20 token to the list</p>
          </div>

          {/* Form */}
          <div className="max-w-3xl">
            <form onSubmit={handleSubmit} className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6 space-y-6">
              {/* Alert Messages */}
              {error && (
                <div className="flex items-center gap-3 p-4 bg-red-500/10 border border-red-500/30 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              {success && (
                <div className="flex items-center gap-3 p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
                  <CheckCircle className="w-5 h-5 text-green-400 flex-shrink-0" />
                  <p className="text-green-400 text-sm">Token added successfully! Redirecting...</p>
                </div>
              )}

              {/* Contract Address */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Contract Address <span className="text-red-400">*</span>
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    placeholder="paxi1..."
                    className="flex-1 px-4 py-2 bg-[#0f0f0f] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                  <button
                    type="button"
                    onClick={handleFetchFromContract}
                    disabled={loading || !formData.address}
                    className="px-4 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 border border-blue-500/30 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Auto-Fill
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">Click Auto-Fill to fetch token details from contract</p>
              </div>

              {/* Token Name */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Token Name <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="My Token"
                  className="w-full px-4 py-2 bg-[#0f0f0f] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Symbol & Decimals */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Symbol <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="text"
                    required
                    value={formData.symbol}
                    onChange={(e) => setFormData({ ...formData, symbol: e.target.value.toUpperCase() })}
                    placeholder="MTK"
                    className="w-full px-4 py-2 bg-[#0f0f0f] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    Decimals <span className="text-red-400">*</span>
                  </label>
                  <input
                    type="number"
                    required
                    min="0"
                    max="18"
                    value={formData.decimals}
                    onChange={(e) => setFormData({ ...formData, decimals: e.target.value })}
                    className="w-full px-4 py-2 bg-[#0f0f0f] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* Total Supply */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Total Supply <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  required
                  value={formData.totalSupply}
                  onChange={(e) => setFormData({ ...formData, totalSupply: e.target.value })}
                  placeholder="1000000"
                  className="w-full px-4 py-2 bg-[#0f0f0f] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Logo URL */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Logo URL
                </label>
                <input
                  type="url"
                  value={formData.logo}
                  onChange={(e) => setFormData({ ...formData, logo: e.target.value })}
                  placeholder="https://..."
                  className="w-full px-4 py-2 bg-[#0f0f0f] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                {formData.logo && (
                  <div className="mt-2 flex items-center gap-2">
                    <img src={formData.logo} alt="Logo preview" className="w-10 h-10 rounded-full" />
                    <span className="text-xs text-gray-400">Logo preview</span>
                  </div>
                )}
              </div>

              {/* Website */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Website
                </label>
                <input
                  type="url"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                  placeholder="https://..."
                  className="w-full px-4 py-2 bg-[#0f0f0f] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Brief description of the token..."
                  rows={4}
                  className="w-full px-4 py-2 bg-[#0f0f0f] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Verified Checkbox */}
              <div className="flex items-center gap-3 p-4 bg-[#0f0f0f] border border-gray-700 rounded-lg">
                <input
                  type="checkbox"
                  id="verified"
                  checked={formData.verified}
                  onChange={(e) => setFormData({ ...formData, verified: e.target.checked })}
                  className="w-4 h-4 text-blue-500 bg-gray-800 border-gray-600 rounded focus:ring-blue-500"
                />
                <label htmlFor="verified" className="text-sm text-gray-300 cursor-pointer">
                  Mark as verified token
                </label>
              </div>

              {/* Actions */}
              <div className="flex gap-4 pt-4">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 flex items-center justify-center gap-2 px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Save className="w-5 h-5" />
                  {loading ? 'Saving...' : 'Save Token'}
                </button>
                <Link
                  href={`/${chainPath}/prc20`}
                  className="px-6 py-3 bg-gray-700 hover:bg-gray-600 text-white font-medium rounded-lg transition-colors"
                >
                  Cancel
                </Link>
              </div>
            </form>
          </div>
        </main>
        <Footer />
      </div>
    </div>
  );
}
