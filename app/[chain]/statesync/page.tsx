'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Sidebar from '@/components/Sidebar';
import Header from '@/components/Header';
import { ChainData } from '@/types/chain';
import { RefreshCw, Copy, CheckCircle, Server, Database } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

export default function StateSyncPage() {
  const params = useParams();
  const { language } = useLanguage();
  const [chains, setChains] = useState<ChainData[]>([]);
  const [selectedChain, setSelectedChain] = useState<ChainData | null>(null);
  const [syncInfo, setSyncInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState('');

  useEffect(() => {
    const cachedChains = sessionStorage.getItem('chains');
    
    if (cachedChains) {
      const data = JSON.parse(cachedChains);
      setChains(data);
      const chainName = params?.chain as string;
      const chain = chainName 
        ? data.find((c: ChainData) => c.chain_name.toLowerCase().replace(/\s+/g, '-') === chainName.toLowerCase())
        : data.find((c: ChainData) => c.chain_name === 'lumera-mainnet') || data[0];
      if (chain) setSelectedChain(chain);
    } else {
      fetch('/api/chains')
        .then(res => res.json())
        .then(data => {
          sessionStorage.setItem('chains', JSON.stringify(data));
          setChains(data);
          const chainName = params?.chain as string;
          const chain = chainName 
            ? data.find((c: ChainData) => c.chain_name.toLowerCase().replace(/\s+/g, '-') === chainName.toLowerCase())
            : data.find((c: ChainData) => c.chain_name === 'lumera-mainnet') || data[0];
          if (chain) setSelectedChain(chain);
        });
    }
  }, [params]);

  const checkRpcIndexer = async (rpcUrl: string): Promise<boolean> => {
    try {
      const response = await fetch(`${rpcUrl}/status`);
      const data = await response.json();
      const txIndex = data?.result?.node_info?.other?.tx_index;
      return txIndex === 'on';
    } catch {
      return false;
    }
  };

  const findRpcWithIndexer = async (rpcList: any[]): Promise<string | null> => {
    for (const rpc of rpcList) {
      const hasIndexer = await checkRpcIndexer(rpc.address);
      if (hasIndexer) {
        console.log(`✅ Found RPC with indexer: ${rpc.address} (${rpc.provider})`);
        return rpc.address;
      } else {
        console.log(`❌ RPC without indexer: ${rpc.address} (${rpc.provider})`);
      }
    }
    return null;
  };

  useEffect(() => {
    if (selectedChain && selectedChain.rpc && selectedChain.rpc.length > 0) {
      setLoading(true);

      findRpcWithIndexer(selectedChain.rpc)
        .then(rpcUrl => {
          if (!rpcUrl) {

            console.warn('⚠️ No RPC with indexer found, using first available RPC');
            rpcUrl = selectedChain.rpc[0].address;
          }

          return Promise.all([
            fetch(`${rpcUrl}/block`).then(r => r.json()),
            fetch(`${rpcUrl}/status`).then(r => r.json()),
            Promise.resolve(rpcUrl)
          ]);
        })
        .then(([blockData, statusData, rpcUrl]) => {
          const latestBlock = blockData?.result?.block;
          const status = statusData?.result;
          
          if (latestBlock) {
            const height = parseInt(latestBlock.header.height);
            const trustHeight = height - 2000; // Trust height (2000 blocks back)

            fetch(`${rpcUrl}/block?height=${trustHeight}`)
              .then(r => r.json())
              .then(trustBlockData => {
                const trustHash = trustBlockData?.result?.block_id?.hash || '';

                const rpcPromises = selectedChain.rpc.map(async (rpc: any) => {
                  const hasIndexer = await checkRpcIndexer(rpc.address);
                  return hasIndexer ? rpc.address : null;
                });
                
                Promise.all(rpcPromises).then(rpcs => {
                  const validRpcs = rpcs.filter(r => r !== null) as string[];
                  
                  setSyncInfo({
                    latestHeight: height,
                    trustHeight: trustHeight,
                    trustHash: trustHash,
                    rpcServers: validRpcs.length > 0 ? validRpcs : selectedChain.rpc.map((r: any) => r.address),
                    chainId: status?.node_info?.network || selectedChain.chain_id || selectedChain.chain_name,
                    activeRpc: rpcUrl,
                  });
                  setLoading(false);
                });
              })
              .catch(() => {
                setLoading(false);
              });
          } else {
            setLoading(false);
          }
        })
        .catch(() => {
          setLoading(false);
        });
    }
  }, [selectedChain]);

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    setCopied(label);
    setTimeout(() => setCopied(''), 2000);
  };

  const generateStateSyncConfig = () => {
    if (!syncInfo || !selectedChain) return '';
    
    const rpcServers = syncInfo.rpcServers.join(',');
    
    return `#######################################################
###           State Sync Configuration            ###
#######################################################

[statesync]
enable = true

rpc_servers = "${rpcServers}"
trust_height = ${syncInfo.trustHeight}
trust_hash = "${syncInfo.trustHash}"
trust_period = "168h0m0s"

# Chunk request timeout
chunk_request_timeout = "10s"

# State sync RPC servers (comma-separated list)
# It's recommended to use multiple servers
temp_dir = ""`;
  };

  const generateQuickSyncScript = () => {
    if (!syncInfo || !selectedChain) return '';
    
    const rpcServer = syncInfo.rpcServers[0];
    
    return `#!/bin/bash

# Stop your node
sudo systemctl stop ${selectedChain.chain_name}d

# Backup priv_validator_state.json
cp ~/.${selectedChain.chain_name}/data/priv_validator_state.json ~/priv_validator_state.json.backup

# Reset database
${selectedChain.chain_name}d tendermint unsafe-reset-all --home ~/.${selectedChain.chain_name}

# Get trust height and hash
LATEST_HEIGHT=$(curl -s ${rpcServer}/block | jq -r .result.block.header.height)
TRUST_HEIGHT=$((LATEST_HEIGHT - 2000))
TRUST_HASH=$(curl -s "${rpcServer}/block?height=\${TRUST_HEIGHT}" | jq -r .result.block_id.hash)

# Configure state sync
sed -i.bak -E "s|^(enable[[:space:]]+=[[:space:]]+).*$|\\1true|" ~/.${selectedChain.chain_name}/config/config.toml
sed -i.bak -E "s|^(rpc_servers[[:space:]]+=[[:space:]]+).*$|\\1\\"${rpcServer},${rpcServer}\\"|" ~/.${selectedChain.chain_name}/config/config.toml
sed -i.bak -E "s|^(trust_height[[:space:]]+=[[:space:]]+).*$|\\1\${TRUST_HEIGHT}|" ~/.${selectedChain.chain_name}/config/config.toml
sed -i.bak -E "s|^(trust_hash[[:space:]]+=[[:space:]]+).*$|\\1\\"\${TRUST_HASH}\\"|" ~/.${selectedChain.chain_name}/config/config.toml

# Restore priv_validator_state.json
mv ~/priv_validator_state.json.backup ~/.${selectedChain.chain_name}/data/priv_validator_state.json

# Start node
sudo systemctl start ${selectedChain.chain_name}d

echo "State sync configured! Check logs: journalctl -u ${selectedChain.chain_name}d -f"`;
  };

  return (
    <div className="min-h-screen bg-[#0a0a0a] flex">
      <Sidebar selectedChain={selectedChain} />
      
      <div className="flex-1 flex flex-col">
        <Header 
          chains={chains}
          selectedChain={selectedChain}
          onSelectChain={setSelectedChain}
        />

        <main className="flex-1 mt-24 md:mt-16 p-3 md:p-6 overflow-auto">
          <div className="mb-6">
            <h1 className="text-3xl font-bold text-white mb-2 flex items-center">
              <RefreshCw className="w-8 h-8 mr-3" />
              State Sync Configuration
            </h1>
            <p className="text-gray-400">
              Quickly sync your node using state sync instead of downloading the entire blockchain
            </p>
          </div>

          {loading ? (
            <div className="text-center py-20">
              <div className="inline-block animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
              <p className="mt-4 text-gray-400">Loading state sync information...</p>
            </div>
          ) : syncInfo ? (
            <div className="space-y-6">
              {/* Current State Info */}
              <div className="bg-[#1a1a1a] rounded-lg p-6 border border-gray-800">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center">
                  <Database className="w-5 h-5 mr-2" />
                  Current Chain State
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-[#0f0f0f] rounded-lg p-4">
                    <p className="text-gray-400 text-sm mb-1">Latest Height</p>
                    <p className="text-2xl font-bold text-blue-500">{syncInfo.latestHeight.toLocaleString()}</p>
                  </div>
                  <div className="bg-[#0f0f0f] rounded-lg p-4">
                    <p className="text-gray-400 text-sm mb-1">Trust Height</p>
                    <p className="text-2xl font-bold text-green-500">{syncInfo.trustHeight.toLocaleString()}</p>
                  </div>
                  <div className="bg-[#0f0f0f] rounded-lg p-4">
                    <p className="text-gray-400 text-sm mb-1">Chain ID</p>
                    <p className="text-lg font-mono text-white truncate">{syncInfo.chainId}</p>
                  </div>
                </div>
              </div>

              {/* RPC Servers */}
              <div className="bg-[#1a1a1a] rounded-lg p-6 border border-gray-800">
                <h2 className="text-xl font-bold text-white mb-4 flex items-center">
                  <Server className="w-5 h-5 mr-2" />
                  Available RPC Servers (Indexer Enabled)
                </h2>
                {syncInfo.activeRpc && (
                  <div className="mb-4 p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                    <p className="text-sm text-green-400">
                      ✅ Using RPC with indexer: <code className="font-mono text-green-300">{syncInfo.activeRpc}</code>
                    </p>
                  </div>
                )}
                <div className="space-y-2">
                  {syncInfo.rpcServers.map((rpc: string, idx: number) => (
                    <div key={idx} className="flex items-center justify-between bg-[#0f0f0f] rounded-lg p-3">
                      <div className="flex items-center gap-2 flex-1">
                        <code className="text-blue-400 font-mono text-sm">{rpc}</code>
                        {rpc === syncInfo.activeRpc && (
                          <span className="px-2 py-1 bg-green-500/20 text-green-400 text-xs rounded-full">
                            Active
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() => copyToClipboard(rpc, `rpc-${idx}`)}
                        className="ml-2 p-2 hover:bg-gray-800 rounded transition-colors"
                        title="Copy RPC URL"
                      >
                        {copied === `rpc-${idx}` ? (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        ) : (
                          <Copy className="w-4 h-4 text-gray-400" />
                        )}
                      </button>
                    </div>
                  ))}
                </div>
                {syncInfo.rpcServers.length === 0 && (
                  <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
                    <p className="text-sm text-yellow-400">
                      ⚠️ No RPC with indexer enabled found. State sync may not work properly.
                    </p>
                  </div>
                )}
              </div>

              {/* Config.toml Configuration */}
              <div className="bg-[#1a1a1a] rounded-lg p-6 border border-gray-800">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-white">config.toml Configuration</h2>
                  <button
                    onClick={() => copyToClipboard(generateStateSyncConfig(), 'config')}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg transition-colors"
                  >
                    {copied === 'config' ? (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Copy Config</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="bg-[#0f0f0f] rounded-lg p-4 overflow-x-auto text-sm text-gray-300 font-mono">
                  {generateStateSyncConfig()}
                </pre>
                <p className="mt-4 text-gray-400 text-sm">
                  Add this configuration to your <code className="text-blue-400">~/.{selectedChain?.chain_name}/config/config.toml</code> file
                </p>
              </div>

              {/* Quick Sync Script */}
              <div className="bg-[#1a1a1a] rounded-lg p-6 border border-gray-800">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-xl font-bold text-white">Automated Setup Script</h2>
                  <button
                    onClick={() => copyToClipboard(generateQuickSyncScript(), 'script')}
                    className="flex items-center gap-2 px-4 py-2 bg-green-500 hover:bg-green-600 rounded-lg transition-colors"
                  >
                    {copied === 'script' ? (
                      <>
                        <CheckCircle className="w-4 h-4" />
                        <span>Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-4 h-4" />
                        <span>Copy Script</span>
                      </>
                    )}
                  </button>
                </div>
                <pre className="bg-[#0f0f0f] rounded-lg p-4 overflow-x-auto text-sm text-gray-300 font-mono">
                  {generateQuickSyncScript()}
                </pre>
                <div className="mt-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg p-4">
                  <p className="text-yellow-500 font-medium mb-2">⚠️ Important Notes:</p>
                  <ul className="text-gray-400 text-sm space-y-1 list-disc list-inside">
                    <li>This script will reset your node's database</li>
                    <li>Make sure to backup your validator keys before running</li>
                    <li>The script automatically backs up priv_validator_state.json</li>
                    <li>Review and modify the script according to your setup</li>
                  </ul>
                </div>
              </div>

              {/* Instructions */}
              <div className="bg-[#1a1a1a] rounded-lg p-6 border border-gray-800">
                <h2 className="text-xl font-bold text-white mb-4">Setup Instructions</h2>
                <div className="space-y-4">
                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">1</div>
                    <div className="flex-1">
                      <h3 className="text-white font-medium mb-1">Stop Your Node</h3>
                      <p className="text-gray-400 text-sm">
                        Stop your running node service before applying state sync configuration
                      </p>
                      <code className="block mt-2 bg-[#0f0f0f] p-2 rounded text-sm text-blue-400">
                        sudo systemctl stop {selectedChain?.chain_name}d
                      </code>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">2</div>
                    <div className="flex-1">
                      <h3 className="text-white font-medium mb-1">Backup Important Files</h3>
                      <p className="text-gray-400 text-sm">
                        Backup your priv_validator_state.json to prevent double signing
                      </p>
                      <code className="block mt-2 bg-[#0f0f0f] p-2 rounded text-sm text-blue-400">
                        cp ~/.{selectedChain?.chain_name}/data/priv_validator_state.json ~/backup.json
                      </code>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">3</div>
                    <div className="flex-1">
                      <h3 className="text-white font-medium mb-1">Apply Configuration</h3>
                      <p className="text-gray-400 text-sm">
                        Either use the automated script above or manually add the config to config.toml
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center text-white font-bold">4</div>
                    <div className="flex-1">
                      <h3 className="text-white font-medium mb-1">Start Your Node</h3>
                      <p className="text-gray-400 text-sm">
                        Start your node and monitor the logs to ensure state sync is working
                      </p>
                      <code className="block mt-2 bg-[#0f0f0f] p-2 rounded text-sm text-blue-400">
                        sudo systemctl start {selectedChain?.chain_name}d && journalctl -u {selectedChain?.chain_name}d -f
                      </code>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-[#1a1a1a] rounded-lg p-12 text-center border border-gray-800">
              <RefreshCw className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <p className="text-gray-400">Unable to load state sync information</p>
              <p className="text-gray-500 text-sm mt-2">Please make sure the RPC endpoint is accessible</p>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

