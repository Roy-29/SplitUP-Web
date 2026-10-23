/**
 * Bangladesh Mobile Financial Services (MFS) Helper
 * Supports bKash, Nagad, Rocket, Upay, CellFin
 */

export const MFS_PROVIDERS = {
  BKASH: {
    id: 'BKASH',
    name: 'bKash',
    bengaliName: 'bKash',
    color: '#E2136E',
    lightColor: '#fde8f1',
    icon: 'ph-money',
    ussd: '*247#',
    ussdTel: 'tel:*247%23',
    appUrl: 'https://www.bkash.com/app',
    prefix: ['017', '013', '018', '019', '014', '015', '016']
  },
  NAGAD: {
    id: 'NAGAD',
    name: 'Nagad',
    bengaliName: 'Nagad',
    color: '#F7941D',
    lightColor: '#fef4e8',
    icon: 'ph-lightning',
    ussd: '*167#',
    ussdTel: 'tel:*167%23',
    appUrl: 'https://nagad.com.bd',
    prefix: ['017', '013', '018', '019', '014', '015', '016']
  },
  ROCKET: {
    id: 'ROCKET',
    name: 'Rocket',
    bengaliName: 'Rocket',
    color: '#8C3494',
    lightColor: '#f4e9f5',
    icon: 'ph-rocket-launch',
    ussd: '*322#',
    ussdTel: 'tel:*322%23',
    appUrl: 'https://www.dutchbanglabank.com/rocket/rocket.html',
    prefix: ['017', '013', '018', '019', '014', '015', '016']
  },
  UPAY: {
    id: 'UPAY',
    name: 'Upay',
    bengaliName: 'Upay',
    color: '#00A651',
    lightColor: '#e6f7ee',
    icon: 'ph-credit-card',
    ussd: '*268#',
    ussdTel: 'tel:*268%23',
    appUrl: 'https://www.upaybd.com',
    prefix: ['017', '013', '018', '019', '014', '015', '016']
  }
};

/**
 * Validate a Bangladeshi mobile number (01XXXXXXXXX)
 */
export function isValidBdNumber(number) {
  if (!number) return false;
  const clean = String(number).replace(/[\s\-+]/g, '');
  // Matches 013, 014, 015, 016, 017, 018, 019 followed by 8 digits
  return /^(?:\+?88)?01[3-9]\d{8}$/.test(clean);
}

/**
 * Normalize to standard format: 017XXXXXXXX
 */
export function normalizeBdNumber(number) {
  if (!number) return '';
  let clean = String(number).replace(/[\s\-]/g, '');
  if (clean.startsWith('+88')) clean = clean.substring(3);
  if (clean.startsWith('88')) clean = clean.substring(2);
  return clean;
}

/**
 * Generate deep-link / QR payload for MFS payment
 */
export function generateMfsQrPayload({ provider = 'BKASH', number, amount, reference = 'SplitUP' }) {
  const normNumber = normalizeBdNumber(number);
  const cleanAmount = Number(amount || 0).toFixed(2);
  
  // Standard format that bKash/Nagad can recognize or fallback to informative string
  return JSON.stringify({
    service: provider,
    recipient: normNumber,
    amount: cleanAmount,
    currency: 'BDT',
    ref: reference,
    timestamp: Date.now()
  });
}
