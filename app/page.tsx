'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ChainData } from '@/types/chain';
import { Activity, TrendingUp, Users, Sparkles, Zap, Network } from 'lucide-react';
import { fetchApi } from '@/lib/api';
import { useLanguage } from '@/contexts/LanguageContext';
import { getTranslation } from '@/lib/i18n';
import LanguageSwitcher from '@/components/LanguageSwitcher';
import WinScanLogo from '@/components/WinScanLogo';
import Footer from '@/components/Footer';

export default function Home() {
  const [chains, setChains] = useState<ChainData[]>([]);
  const [loading, setLoading] = useState(true);
  const [mounted, setMounted] = useState(false);
  const { language } = useLanguage();

  const t = (key: string) => getTranslation(language, key);

  useEffect(() => {
    setMounted(true);
    
    const minLoadTime = new Promise(resolve => setTimeout(resolve, 1500));
    
    Promise.all([
      fetchApi('/api/chains').then(res => res.json()),
      minLoadTime
    ])
      .then(([data]) => {
        setChains(data);
        setLoading(false);
      })
      .catch(err => {
        console.error('Error loading chains:', err);
        setLoading(false);
      });
  }, []);

  const getPrettyName = (chainName: string) => {
    return chainName
      .replace(/-mainnet$/i, '')
      .replace(/-testnet$/i, '')
      .replace(/-test$/i, '')
      .split('-')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const mainnets = chains.filter(c => 
    c.chain_name.toLowerCase().includes('mainnet') || 
    (!c.chain_name.toLowerCase().includes('test'))
  );
  
  const testnets = chains.filter(c => 
    c.chain_name.toLowerCase().includes('test') && 
    !c.chain_name.toLowerCase().includes('mainnet')
  );

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex flex-col relative overflow-hidden">
      <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 via-transparent to-purple-500/5 pointer-events-none"></div>

      <header className="border-b border-gray-800/30 backdrop-blur-xl bg-black/40 relative z-50">
        <div className="container mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <WinScanLogo size="md" />
              <div>
                <h1 className="text-2xl font-bold text-white">
                  {t('home.title')}
                </h1>
                <p className="text-gray-500 text-sm">{t('home.subtitle')}</p>
              </div>
            </div>
            
            <div className="flex items-center gap-3">
              {!loading && chains.length > 0 && (
                <div className="flex items-center gap-2 px-3 py-1.5 bg-gray-900/50 border border-gray-800 rounded-lg">
                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                  <span className="text-gray-400 text-sm">{chains.length} Networks</span>
                </div>
              )}
              <LanguageSwitcher />
            </div>
          </div>
        </div>
      </header>

      <main className="flex-1 container mx-auto px-6 py-12 relative z-10">
        {loading ? (
          <div className="flex flex-col items-center justify-center min-h-[500px]">
            <WinScanLogo size="xl" animated={true} />
            <p className="text-gray-500 mt-6">{t('home.loading')}</p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
              <div className="bg-gray-900/30 border border-gray-800/50 rounded-xl p-6 backdrop-blur-sm">
                <div className="flex items-center gap-3 mb-2">
                  <Network className="w-5 h-5 text-gray-500" />
                  <span className="text-gray-400 text-sm">{t('home.totalNetworks')}</span>
                </div>
                <p className="text-3xl font-bold text-white">{chains.length}</p>
              </div>

              <div className="bg-gray-900/30 border border-gray-800/50 rounded-xl p-6 backdrop-blur-sm">
                <div className="flex items-center gap-3 mb-2">
                  <TrendingUp className="w-5 h-5 text-green-500" />
                  <span className="text-gray-400 text-sm">{t('home.mainnets')}</span>
                </div>
                <p className="text-3xl font-bold text-white">{mainnets.length}</p>
              </div>

              <div className="bg-gray-900/30 border border-gray-800/50 rounded-xl p-6 backdrop-blur-sm">
                <div className="flex items-center gap-3 mb-2">
                  <Users className="w-5 h-5 text-purple-500" />
                  <span className="text-gray-400 text-sm">{t('home.testnets')}</span>
                </div>
                <p className="text-3xl font-bold text-white">{testnets.length}</p>
              </div>
            </div>

            <div className="space-y-10">
              {mainnets.length > 0 && (
                <div>
                  <div className="flex items-center gap-3 mb-6">
                    <h2 className="text-xl font-semibold text-white">
                      {t('home.mainnetNetworks')}
                    </h2>
                    <span className="px-2.5 py-0.5 bg-gray-900/50 border border-gray-800 text-gray-400 text-sm rounded-md">
                      {mainnets.length}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {mainnets.map((chain) => {
                      const chainPath = chain.chain_name.toLowerCase().replace(/\s+/g, '-');
                      
                      return (
                        <Link
                          key={chain.chain_name}
                          href={`/${chainPath}`}
                          className="group bg-gray-900/30 border border-gray-800/50 rounded-xl p-5 hover:bg-gray-900/50 hover:border-gray-700 transition-all backdrop-blur-sm"
                        >
                          <div className="flex items-center gap-3 mb-4">
                            <img 
                              src={chain.logo} 
                              alt={chain.chain_name}
                              className="w-12 h-12 rounded-full ring-1 ring-gray-800"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="48" height="48"%3E%3Ccircle cx="24" cy="24" r="24" fill="%236b7280"/%3E%3C/svg%3E';
                              }}
                            />
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-white truncate group-hover:text-blue-400 transition-colors">
                                {getPrettyName(chain.chain_name)}
                              </h3>
                              <p className="text-sm text-gray-500 font-mono">{chain.assets[0]?.symbol || 'N/A'}</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between pt-3 border-t border-gray-800/50">
                            <span className="text-xs text-gray-500">Prefix: <span className="text-gray-400 font-mono">{chain.addr_prefix}</span></span>
                            <div className="text-blue-500 opacity-0 group-hover:opacity-100 transition-opacity">→</div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}

              {testnets.length > 0 && (
                <div>
                  <div className="flex items-center gap-3 mb-6">
                    <h2 className="text-xl font-semibold text-white">
                      {t('home.testnetNetworks')}
                    </h2>
                    <span className="px-2.5 py-0.5 bg-gray-900/50 border border-gray-800 text-gray-400 text-sm rounded-md">
                      {testnets.length}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                    {testnets.map((chain) => {
                      const chainPath = chain.chain_name.toLowerCase().replace(/\s+/g, '-');
                      
                      return (
                        <Link
                          key={chain.chain_name}
                          href={`/${chainPath}`}
                          className="group bg-gray-900/30 border border-gray-800/50 rounded-xl p-5 hover:bg-gray-900/50 hover:border-gray-700 transition-all backdrop-blur-sm"
                        >
                          <div className="flex items-center gap-3 mb-4">
                            <img 
                              src={chain.logo} 
                              alt={chain.chain_name}
                              className="w-12 h-12 rounded-full ring-1 ring-gray-800"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.src = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="48" height="48"%3E%3Ccircle cx="24" cy="24" r="24" fill="%236b7280"/%3E%3C/svg%3E';
                              }}
                            />
                            <div className="flex-1 min-w-0">
                              <h3 className="font-semibold text-white truncate group-hover:text-purple-400 transition-colors">
                                {getPrettyName(chain.chain_name)}
                              </h3>
                              <p className="text-sm text-gray-500 font-mono">{chain.assets[0]?.symbol || 'N/A'}</p>
                            </div>
                          </div>
                          
                          <div className="flex items-center justify-between pt-3 border-t border-gray-800/50">
                            <span className="text-xs text-gray-500">Prefix: <span className="text-gray-400 font-mono">{chain.addr_prefix}</span></span>
                            <div className="text-purple-500 opacity-0 group-hover:opacity-100 transition-opacity">→</div>
                          </div>
                        </Link>
                      );
                    })}
                  </div>
                </div>
              )}

              {chains.length === 0 && !loading && (
                <div className="text-center py-16">
                  <Activity className="w-16 h-16 text-gray-700 mx-auto mb-4" />
                  <h3 className="text-xl font-semibold text-white mb-2">{t('home.noNetworks')}</h3>
                  <p className="text-gray-500 mb-4">{t('home.noNetworksDesc')}</p>
                  <button 
                    onClick={() => window.location.reload()}
                    className="px-5 py-2.5 bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors text-sm"
                  >
                    {t('home.retry')}
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </main>

      <Footer />
    </div>
  );
}
