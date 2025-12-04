// Helper functions to convert validator consensus pubkey to address
import { createHash } from 'crypto';

/**
 * Convert base64 encoded ED25519 pubkey to hex address
 * Address = SHA256(pubkey)[:20]
 */
export function pubkeyToAddress(consensusPubkey: any): string {
  try {
    if (!consensusPubkey || !consensusPubkey.key) {
      return '';
    }

    // For Tendermint/CometBFT ED25519 keys
    // The key is base64 encoded, we need to decode and hash it
    const pubkeyBase64 = consensusPubkey.key;
    const pubkeyBuffer = Buffer.from(pubkeyBase64, 'base64');
    
    // Calculate SHA256 hash
    const hash = createHash('sha256').update(pubkeyBuffer).digest();
    
    // Take first 20 bytes and convert to uppercase hex
    const address = hash.slice(0, 20).toString('hex').toUpperCase();
    
    return address;
  } catch (error) {
    console.error('Error converting pubkey to address:', error);
    return '';
  }
}

/**
 * Validate if address format is correct (40 hex characters)
 */
export function isValidAddress(address: string): boolean {
  return /^[0-9A-F]{40}$/i.test(address);
}
