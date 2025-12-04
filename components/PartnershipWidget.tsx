'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';

interface Partner {
  name: string;
  logo: string;
  website: string;
  chain_name?: string;
}

export default function PartnershipWidget() {
  const [partners, setPartners] = useState<Partner[]>([]);

  useEffect(() => {
    async function loadPartners() {
      try {
        const response = await fetch('/api/chains');
        const chains = await response.json();
        
        // Deduplicate and filter chains with website and logo
        const seenBaseNames = new Set<string>();
        const partnerChains: Partner[] = chains
          .filter((chain: any) => chain.website && chain.logo)
          .filter((chain: any) => {
            const baseName = chain.chain_name
              .replace(/-mainnet$/i, '')
              .replace(/-testnet$/i, '')
              .replace(/-test$/i, '');
            
            if (seenBaseNames.has(baseName.toLowerCase())) {
              return false;
            }
            seenBaseNames.add(baseName.toLowerCase());
            return true;
          })
          .map((chain: any) => ({
            name: chain.pretty_name || chain.chain_name,
            logo: chain.logo,
            website: chain.website,
            chain_name: chain.chain_name
          }));

        setPartners(partnerChains);
      } catch (error) {
        console.error('Failed to load partners:', error);
      }
    }

    loadPartners();
  }, []);

  if (partners.length === 0) return null;

  return (
    <div className="mt-0 pt-2 border-t border-gray-700">
      <h3 className="text-xs font-bold text-gray-300 mb-2 text-center">
        🤝 Partnership
      </h3>
      <div className="flex justify-center">
        <div className="flex gap-2 items-center justify-center">
        {partners.slice(0, 6).map((partner, index) => (
          <a
            key={`${partner.chain_name || partner.name}-${index}`}
            href={partner.website}
            target="_blank"
            rel="noopener noreferrer"
            className="group flex items-center justify-center bg-gray-800 hover:bg-gray-700 rounded-lg p-2 transition-all duration-200"
            title={partner.name}
          >
            <div className="relative w-8 h-8">
              <Image
                src={partner.logo}
                alt={partner.name}
                fill
                className="object-contain group-hover:scale-110 transition-transform duration-200"
                onError={(e) => {
                  const target = e.target as HTMLImageElement;
                  target.src = '/icon-192x192.png';
                }}
              />
            </div>
          </a>
        ))}
        </div>
      </div>
    </div>
  );
}
