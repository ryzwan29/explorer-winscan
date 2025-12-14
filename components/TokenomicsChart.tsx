'use client';

interface TokenomicsChartProps {
  bonded: string;
  totalSupply: string;
}

export default function TokenomicsChart({ bonded, totalSupply }: TokenomicsChartProps) {
  const bondedNum = parseFloat(bonded);
  const totalSupplyNum = parseFloat(totalSupply);
  
  const bondedPercent = totalSupplyNum > 0 ? (bondedNum / totalSupplyNum) * 100 : 0;
  const unbondedPercent = 100 - bondedPercent;

  const formatNumber = (num: number) => {
    if (num >= 1e9) return (num / 1e9).toFixed(2) + 'B';
    if (num >= 1e6) return (num / 1e6).toFixed(2) + 'M';
    if (num >= 1e3) return (num / 1e3).toFixed(2) + 'K';
    return num.toFixed(2);
  };

  return (
    <div className="bg-[#1a1a1a] border border-gray-800 rounded-lg p-6">
      <div className="flex items-center justify-center mb-6">
        <div className="relative w-64 h-64">
          <svg className="w-full h-full transform -rotate-90">
            <circle
              cx="128"
              cy="128"
              r="100"
              fill="none"
              stroke="#2d3748"
              strokeWidth="40"
            />
            <circle
              cx="128"
              cy="128"
              r="100"
              fill="none"
              stroke="#3b82f6"
              strokeWidth="40"
              strokeDasharray={`${bondedPercent * 6.28} ${100 * 6.28}`}
              strokeLinecap="round"
            />
            <circle
              cx="128"
              cy="128"
              r="100"
              fill="none"
              stroke="#8b5cf6"
              strokeWidth="40"
              strokeDasharray={`${unbondedPercent * 6.28} ${100 * 6.28}`}
              strokeDashoffset={`-${bondedPercent * 6.28}`}
              strokeLinecap="round"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-2xl font-bold text-white">{formatNumber(bondedNum)} / {formatNumber(totalSupplyNum)}</div>
              <div className="text-gray-400 text-sm">Bonded / Supply</div>
            </div>
          </div>
        </div>
      </div>
      
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 md:gap-4">
        <div className="text-center">
          <div className="flex items-center justify-center mb-2">
            <div className="w-3 h-3 rounded-full bg-blue-500 mr-2"></div>
            <span className="text-gray-400">Bonded</span>
          </div>
          <div className="text-xl font-bold text-white">{formatNumber(bondedNum)}</div>
        </div>
        <div className="text-center">
          <div className="flex items-center justify-center mb-2">
            <div className="w-3 h-3 rounded-full bg-purple-500 mr-2"></div>
            <span className="text-gray-400">Total Supply</span>
          </div>
          <div className="text-xl font-bold text-white">{formatNumber(totalSupplyNum)}</div>
        </div>
      </div>
    </div>
  );
}
