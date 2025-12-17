'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { ChainData } from '@/types/chain';
import { Rocket, Code, AlertCircle, CheckCircle, Copy } from 'lucide-react';

export default function CreatePRC20TokenPage() {
  const params = useParams();
  const [chains, setChains] = useState<ChainData[]>([]);
  const [selectedChain, setSelectedChain] = useState<ChainData | null>(null);
  const [loading, setLoading] = useState(false);
  const [deployed, setDeployed] = useState(false);
  const [contractAddress, setContractAddress] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    symbol: '',
    decimals: '18',
    initialSupply: '',
    maxSupply: '',
    mintable: false,
    burnable: false,
    pausable: false,
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

  const handleDeploy = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Simulate deployment
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Mock contract address
      setContractAddress('paxi1' + Math.random().toString(36).substring(2, 50));
      setDeployed(true);
    } catch (error) {
      alert('Deployment failed');
    } finally {
      setLoading(false);
    }
  };

  const copyAddress = () => {
    navigator.clipboard.writeText(contractAddress);
  };

  return (
    <div className="flex min-h-screen bg-[#0a0a0a]">
      {selectedChain && <Sidebar selectedChain={selectedChain} />}

      <div className="flex-1 flex flex-col">
        <Header chains={chains} selectedChain={selectedChain} onSelectChain={setSelectedChain} />

        <main className="flex-1 mt-32 lg:mt-16 p-4 md:p-6 overflow-auto">
          {/* Page Header */}
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-white mb-2">Create PRC20 Token</h1>
            <p className="text-gray-400">Deploy a new PRC20 token smart contract</p>
          </div>

          {deployed ? (
            /* Success Screen */
            <div className="max-w-2xl mx-auto">
              <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-8 text-center">
                <div className="inline-flex items-center justify-center w-20 h-20 bg-green-500/20 border-2 border-green-500 rounded-full mb-4">
                  <CheckCircle className="w-10 h-10 text-green-400" />
                </div>
                <h2 className="text-2xl font-bold text-white mb-2">Token Deployed Successfully!</h2>
                <p className="text-gray-400 mb-6">Your {formData.name} ({formData.symbol}) token is now live</p>

                <div className="bg-[#0f0f0f] border border-gray-700 rounded-lg p-4 mb-6">
                  <div className="text-sm text-gray-400 mb-2">Contract Address</div>
                  <div className="flex items-center justify-between gap-2">
                    <code className="text-white font-mono text-sm break-all">{contractAddress}</code>
                    <button
                      onClick={copyAddress}
                      className="p-2 hover:bg-gray-800 rounded-lg transition-colors flex-shrink-0"
                      title="Copy address"
                    >
                      <Copy className="w-4 h-4 text-gray-400" />
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mb-6">
                  <div className="bg-[#0f0f0f] border border-gray-700 rounded-lg p-4">
                    <div className="text-xs text-gray-400 mb-1">Name</div>
                    <div className="text-white font-semibold">{formData.name}</div>
                  </div>
                  <div className="bg-[#0f0f0f] border border-gray-700 rounded-lg p-4">
                    <div className="text-xs text-gray-400 mb-1">Symbol</div>
                    <div className="text-white font-semibold">{formData.symbol}</div>
                  </div>
                  <div className="bg-[#0f0f0f] border border-gray-700 rounded-lg p-4">
                    <div className="text-xs text-gray-400 mb-1">Decimals</div>
                    <div className="text-white font-semibold">{formData.decimals}</div>
                  </div>
                  <div className="bg-[#0f0f0f] border border-gray-700 rounded-lg p-4">
                    <div className="text-xs text-gray-400 mb-1">Initial Supply</div>
                    <div className="text-white font-semibold">{parseFloat(formData.initialSupply).toLocaleString()}</div>
                  </div>
                </div>

                <button
                  onClick={() => {
                    setDeployed(false);
                    setFormData({
                      name: '',
                      symbol: '',
                      decimals: '18',
                      initialSupply: '',
                      maxSupply: '',
                      mintable: false,
                      burnable: false,
                      pausable: false,
                    });
                  }}
                  className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white font-medium rounded-lg transition-colors"
                >
                  Deploy Another Token
                </button>
              </div>
            </div>
          ) : (
            /* Deployment Form */
            <div className="max-w-3xl">
              <form onSubmit={handleDeploy} className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6 space-y-6">
                {/* Info Banner */}
                <div className="flex items-start gap-3 p-4 bg-blue-500/10 border border-blue-500/30 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-blue-400 text-sm font-medium mb-1">Token Deployment</p>
                    <p className="text-blue-300/80 text-xs">
                      This will deploy a new PRC20 token contract. Make sure you have enough PAXI for gas fees.
                    </p>
                  </div>
                </div>

                {/* Basic Info */}
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4">Basic Information</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Token Name <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="text"
                        required
                        value={formData.name}
                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                        placeholder="My Awesome Token"
                        className="w-full px-4 py-2 bg-[#0f0f0f] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                    </div>

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
                          placeholder="MAT"
                          maxLength={10}
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
                  </div>
                </div>

                {/* Supply Settings */}
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4">Supply Settings</h3>
                  
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Initial Supply <span className="text-red-400">*</span>
                      </label>
                      <input
                        type="number"
                        required
                        min="1"
                        value={formData.initialSupply}
                        onChange={(e) => setFormData({ ...formData, initialSupply: e.target.value })}
                        placeholder="1000000"
                        className="w-full px-4 py-2 bg-[#0f0f0f] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">Tokens minted to your address on deployment</p>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-300 mb-2">
                        Maximum Supply
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={formData.maxSupply}
                        onChange={(e) => setFormData({ ...formData, maxSupply: e.target.value })}
                        placeholder="10000000 (optional)"
                        className="w-full px-4 py-2 bg-[#0f0f0f] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                      />
                      <p className="text-xs text-gray-500 mt-1">Leave empty for unlimited supply</p>
                    </div>
                  </div>
                </div>

                {/* Features */}
                <div>
                  <h3 className="text-lg font-semibold text-white mb-4">Token Features</h3>
                  
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-4 bg-[#0f0f0f] border border-gray-700 rounded-lg">
                      <input
                        type="checkbox"
                        id="mintable"
                        checked={formData.mintable}
                        onChange={(e) => setFormData({ ...formData, mintable: e.target.checked })}
                        className="w-4 h-4 text-blue-500 bg-gray-800 border-gray-600 rounded focus:ring-blue-500"
                      />
                      <div className="flex-1">
                        <label htmlFor="mintable" className="text-sm font-medium text-gray-300 cursor-pointer">
                          Mintable
                        </label>
                        <p className="text-xs text-gray-500">Allow creating new tokens after deployment</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-4 bg-[#0f0f0f] border border-gray-700 rounded-lg">
                      <input
                        type="checkbox"
                        id="burnable"
                        checked={formData.burnable}
                        onChange={(e) => setFormData({ ...formData, burnable: e.target.checked })}
                        className="w-4 h-4 text-blue-500 bg-gray-800 border-gray-600 rounded focus:ring-blue-500"
                      />
                      <div className="flex-1">
                        <label htmlFor="burnable" className="text-sm font-medium text-gray-300 cursor-pointer">
                          Burnable
                        </label>
                        <p className="text-xs text-gray-500">Allow token holders to burn their tokens</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3 p-4 bg-[#0f0f0f] border border-gray-700 rounded-lg">
                      <input
                        type="checkbox"
                        id="pausable"
                        checked={formData.pausable}
                        onChange={(e) => setFormData({ ...formData, pausable: e.target.checked })}
                        className="w-4 h-4 text-blue-500 bg-gray-800 border-gray-600 rounded focus:ring-blue-500"
                      />
                      <div className="flex-1">
                        <label htmlFor="pausable" className="text-sm font-medium text-gray-300 cursor-pointer">
                          Pausable
                        </label>
                        <p className="text-xs text-gray-500">Allow pausing token transfers in emergencies</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Deploy Button */}
                <div className="pt-4">
                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full flex items-center justify-center gap-2 px-6 py-4 bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white font-semibold rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <>
                        <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                        Deploying Contract...
                      </>
                    ) : (
                      <>
                        <Rocket className="w-5 h-5" />
                        Deploy Token
                      </>
                    )}
                  </button>
                  <p className="text-center text-xs text-gray-500 mt-2">
                    Estimated gas fee: ~0.5 PAXI
                  </p>
                </div>
              </form>
            </div>
          )}
        </main>
        <Footer />
      </div>
    </div>
  );
}
