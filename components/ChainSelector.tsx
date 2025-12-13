'use client';
import { ChainData } from '@/types/chain';
import { ChevronDown } from 'lucide-react';
import { useState, useMemo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { clearChainCache } from '@/lib/apiCache';
import { clearLoadBalancer } from '@/lib/loadBalancer';
import { useWallet } from '@/contexts/WalletContext';
import { disconnectKeplr } from '@/lib/keplr';
import { disconnectMetaMask } from '@/lib/metamask';
import LazyImage from './LazyImage';
interface ChainSelectorProps {
  chains: ChainData[];
  selectedChain: ChainData | null;
  onSelectChain: (chain: ChainData) => void;
}
export default function ChainSelector({ chains, selectedChain, onSelectChain }: ChainSelectorProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [switching, setSwitching] = useState(false);
  const router = useRouter();
  const pathname = usePathname();
  const { setAccount } = useWallet();
  const handleChainSelect = async (chain: ChainData) => {
    if (switching) return;
    setSwitching(true);
    if (selectedChain && selectedChain.chain_name !== chain.chain_name) {
      // Disconnect wallet when switching chains
      disconnectKeplr();
      disconnectMetaMask();
      setAccount(null);
      window.dispatchEvent(new CustomEvent('keplr_wallet_changed'));
      
      // Clear cache
      const oldChainPath = selectedChain.chain_name.toLowerCase().replace(/\s+/g, '-');
      clearChainCache(oldChainPath);
      clearLoadBalancer(oldChainPath);    }
    onSelectChain(chain);
    setIsOpen(false);
    const newChainPath = chain.chain_name.toLowerCase().replace(/\s+/g, '-');
    const pathParts = pathname.split('/').filter(Boolean);
    const currentPage = pathParts.length > 1 ? pathParts.slice(1).join('/') : '';
    if (currentPage) {
      router.push(`/${newChainPath}/${currentPage}`);
    } else {
      router.push(`/${newChainPath}`);
    }
    setTimeout(() => setSwitching(false), 1000);
  };
  const getPrettyName = (chainName: string) => {
    return chainName.replace(/-mainnet$/i, '').replace(/-testnet$/i, '').replace(/-test$/i, '');
  };

  const isTestnet = (chainName: string) => {
    return chainName.toLowerCase().includes('testnet') || chainName.toLowerCase().includes('test');
  };

  // Memoize filtered chains to avoid recalculating on every render
  const mainnetChains = useMemo(() => chains.filter(chain => !isTestnet(chain.chain_name)), [chains]);
  const testnetChains = useMemo(() => chains.filter(chain => isTestnet(chain.chain_name)), [chains]);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        disabled={switching}
        className="flex items-center gap-2 bg-[#1a1a1a] border border-gray-700 rounded-lg px-3 py-2 hover:border-blue-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed h-[40px]"
      >
        {selectedChain && (
          <>
            <img src={selectedChain.logo} alt={selectedChain.chain_name} className="w-5 h-5 rounded-full flex-shrink-0" />
            <span className="text-white text-sm hidden sm:inline">{getPrettyName(selectedChain.chain_name)}</span>
          </>
        )}
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
        {switching && <span className="absolute -top-6 left-0 text-xs text-blue-500 whitespace-nowrap">Switching...</span>}
      </button>
      {isOpen && (
        <>
          {/* Backdrop */}
          <div 
            className="fixed inset-0 bg-black/50 z-40" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Popup Modal */}
          <div className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[90vw] sm:w-[600px] max-h-[80vh] bg-[#0f0f0f] border border-gray-700 rounded-xl shadow-2xl z-50 overflow-hidden">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-800">
              <h3 className="text-lg font-semibold text-white">Select Network</h3>
            </div>
            
            {/* Content */}
            <div className="overflow-y-auto max-h-[calc(80vh-120px)] p-4">
              {/* Mainnet Section */}
              {mainnetChains.length > 0 && (
                <div className="mb-6">
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-2">Mainnet</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {mainnetChains.map((chain) => (
                      <button
                        key={chain.chain_name}
                        onClick={() => handleChainSelect(chain)}
                        disabled={switching}
                        className={`flex flex-col items-center gap-2 p-3 rounded-lg hover:bg-[#1a1a1a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                          selectedChain?.chain_name === chain.chain_name ? 'bg-[#1a1a1a] ring-2 ring-blue-500' : 'bg-[#0f0f0f]'
                        }`}
                      >
                        <LazyImage src={chain.logo} alt={chain.chain_name} className="w-10 h-10 rounded-full" />
                        <span className="text-white text-xs text-center font-medium truncate w-full">{getPrettyName(chain.chain_name)}</span>
                        {selectedChain?.chain_name === chain.chain_name && (
                          <span className="text-blue-500 text-[10px]">✓ Active</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Testnet Section */}
              {testnetChains.length > 0 && (
                <div>
                  <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3 px-2">Testnet</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                    {testnetChains.map((chain) => (
                      <button
                        key={chain.chain_name}
                        onClick={() => handleChainSelect(chain)}
                        disabled={switching}
                        className={`flex flex-col items-center gap-2 p-3 rounded-lg hover:bg-[#1a1a1a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
                          selectedChain?.chain_name === chain.chain_name ? 'bg-[#1a1a1a] ring-2 ring-blue-500' : 'bg-[#0f0f0f]'
                        }`}
                      >
                        <LazyImage src={chain.logo} alt={chain.chain_name} className="w-10 h-10 rounded-full" />
                        <span className="text-white text-xs text-center font-medium truncate w-full">{getPrettyName(chain.chain_name)}</span>
                        {selectedChain?.chain_name === chain.chain_name && (
                          <span className="text-blue-500 text-[10px]">✓ Active</span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
