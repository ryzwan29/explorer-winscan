'use client';
import { CheckCircle, XCircle, AlertTriangle, Shield } from 'lucide-react';

interface ContractVerificationBadgeProps {
  verified: boolean;
  verifiedAt?: string;
  license?: string;
  size?: 'sm' | 'md' | 'lg';
  showDetails?: boolean;
}

export default function ContractVerificationBadge({
  verified,
  verifiedAt,
  license,
  size = 'md',
  showDetails = false,
}: ContractVerificationBadgeProps) {
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-xs px-2.5 py-1',
    lg: 'text-sm px-3 py-1.5',
  };

  const iconSizes = {
    sm: 'w-3 h-3',
    md: 'w-3.5 h-3.5',
    lg: 'w-4 h-4',
  };

  if (!verified) {
    return (
      <div
        className={`inline-flex items-center gap-1.5 bg-gray-500/10 border border-gray-500/30 rounded ${sizeClasses[size]} ${
          showDetails ? 'cursor-help' : ''
        }`}
        title={showDetails ? 'Contract source code not verified' : undefined}
      >
        <XCircle className={`${iconSizes[size]} text-gray-400`} />
        <span className="font-medium text-gray-400">Not Verified</span>
      </div>
    );
  }

  return (
    <div className="inline-flex items-center gap-2">
      <div
        className={`inline-flex items-center gap-1.5 bg-green-500/10 border border-green-500/30 rounded ${sizeClasses[size]} ${
          showDetails ? 'cursor-help' : ''
        }`}
        title={
          showDetails && verifiedAt
            ? `Verified on ${new Date(verifiedAt).toLocaleDateString()}`
            : undefined
        }
      >
        <CheckCircle className={`${iconSizes[size]} text-green-400`} />
        <span className="font-medium text-green-400">Verified</span>
      </div>

      {showDetails && license && (
        <div
          className={`inline-flex items-center gap-1.5 bg-blue-500/10 border border-blue-500/30 rounded ${sizeClasses[size]}`}
          title="License"
        >
          <Shield className={`${iconSizes[size]} text-blue-400`} />
          <span className="font-medium text-blue-400">{license}</span>
        </div>
      )}
    </div>
  );
}
