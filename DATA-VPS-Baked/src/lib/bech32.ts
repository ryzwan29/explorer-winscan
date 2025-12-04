// Bech32 encoding/decoding utilities
// Based on BIP173: https://github.com/bitcoin/bips/blob/master/bip-0173.mediawiki

const CHARSET = 'qpzry9x8gf2tvdw0s3jn54khce6mua7l';

function polymod(values: number[]): number {
  const GENERATOR = [0x3b6a57b2, 0x26508e6d, 0x1ea119fa, 0x3d4233dd, 0x2a1462b3];
  let chk = 1;
  for (const value of values) {
    const top = chk >> 25;
    chk = (chk & 0x1ffffff) << 5 ^ value;
    for (let i = 0; i < 5; i++) {
      if ((top >> i) & 1) {
        chk ^= GENERATOR[i];
      }
    }
  }
  return chk;
}

function hrpExpand(hrp: string): number[] {
  const ret = [];
  for (let p = 0; p < hrp.length; p++) {
    ret.push(hrp.charCodeAt(p) >> 5);
  }
  ret.push(0);
  for (let p = 0; p < hrp.length; p++) {
    ret.push(hrp.charCodeAt(p) & 31);
  }
  return ret;
}

function createChecksum(hrp: string, data: number[]): number[] {
  const values = hrpExpand(hrp).concat(data).concat([0, 0, 0, 0, 0, 0]);
  const mod = polymod(values) ^ 1;
  const ret = [];
  for (let p = 0; p < 6; p++) {
    ret.push((mod >> 5 * (5 - p)) & 31);
  }
  return ret;
}

function convertBits(data: number[], fromBits: number, toBits: number, pad: boolean): number[] | null {
  let acc = 0;
  let bits = 0;
  const ret = [];
  const maxv = (1 << toBits) - 1;
  for (const value of data) {
    if (value < 0 || (value >> fromBits) !== 0) {
      return null;
    }
    acc = (acc << fromBits) | value;
    bits += fromBits;
    while (bits >= toBits) {
      bits -= toBits;
      ret.push((acc >> bits) & maxv);
    }
  }
  if (pad) {
    if (bits > 0) {
      ret.push((acc << (toBits - bits)) & maxv);
    }
  } else if (bits >= fromBits || ((acc << (toBits - bits)) & maxv)) {
    return null;
  }
  return ret;
}

export function bech32Encode(hrp: string, data: Buffer): string {
  const dataArray = Array.from(data);
  const converted = convertBits(dataArray, 8, 5, true);
  if (!converted) {
    throw new Error('Failed to convert bits');
  }
  const combined = converted.concat(createChecksum(hrp, converted));
  let ret = hrp + '1';
  for (const d of combined) {
    ret += CHARSET.charAt(d);
  }
  return ret;
}

export function bech32Decode(bechString: string): { hrp: string; data: Buffer } | null {
  let p;
  let hasLower = false;
  let hasUpper = false;
  for (p = 0; p < bechString.length; p++) {
    if (bechString.charCodeAt(p) < 33 || bechString.charCodeAt(p) > 126) {
      return null;
    }
    if (bechString.charCodeAt(p) >= 97 && bechString.charCodeAt(p) <= 122) {
      hasLower = true;
    }
    if (bechString.charCodeAt(p) >= 65 && bechString.charCodeAt(p) <= 90) {
      hasUpper = true;
    }
  }
  if (hasLower && hasUpper) {
    return null;
  }
  bechString = bechString.toLowerCase();
  const pos = bechString.lastIndexOf('1');
  if (pos < 1 || pos + 7 > bechString.length || bechString.length > 90) {
    return null;
  }
  const hrp = bechString.substring(0, pos);
  const data = [];
  for (p = pos + 1; p < bechString.length; p++) {
    const d = CHARSET.indexOf(bechString.charAt(p));
    if (d === -1) {
      return null;
    }
    data.push(d);
  }
  if (!verifyChecksum(hrp, data)) {
    return null;
  }
  const converted = convertBits(data.slice(0, data.length - 6), 5, 8, false);
  if (!converted) {
    return null;
  }
  return { hrp, data: Buffer.from(converted) };
}

function verifyChecksum(hrp: string, data: number[]): boolean {
  return polymod(hrpExpand(hrp).concat(data)) === 1;
}

// Convert consensus pubkey (base64) to consensus address (bech32)
export function pubkeyToConsensusAddress(pubkeyBase64: string, prefix: string = 'cosmosvalcons'): string {
  const crypto = require('crypto');
  
  // Decode base64 pubkey
  const pubkeyBytes = Buffer.from(pubkeyBase64, 'base64');
  
  // SHA256 hash
  const hash = crypto.createHash('sha256').update(pubkeyBytes).digest();
  
  // Take first 20 bytes
  const address = hash.slice(0, 20);
  
  // Encode as bech32
  return bech32Encode(prefix, address);
}
