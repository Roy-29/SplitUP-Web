export const currencies = [
    { code: "BDT", symbol: "৳", name: "Bangladeshi Taka", flagEmoji: "🇧🇩" },
    { code: "USD", symbol: "$", name: "US Dollar", flagEmoji: "🇺🇸" },
    { code: "EUR", symbol: "€", name: "Euro", flagEmoji: "🇪🇺" },
    { code: "GBP", symbol: "£", name: "British Pound", flagEmoji: "🇬🇧" },
    { code: "INR", symbol: "₹", name: "Indian Rupee", flagEmoji: "🇮🇳" },
    { code: "JPY", symbol: "¥", name: "Japanese Yen", flagEmoji: "🇯🇵" },
    { code: "CAD", symbol: "C$", name: "Canadian Dollar", flagEmoji: "🇨🇦" },
    { code: "AUD", symbol: "A$", name: "Australian Dollar", flagEmoji: "🇦🇺" },
    { code: "CHF", symbol: "CHF", name: "Swiss Franc", flagEmoji: "🇨🇭" },
    { code: "CNY", symbol: "¥", name: "Chinese Yuan", flagEmoji: "🇨🇳" },
    { code: "SGD", symbol: "S$", name: "Singapore Dollar", flagEmoji: "🇸🇬" },
    { code: "AED", symbol: "د.إ", name: "UAE Dirham", flagEmoji: "🇦🇪" },
    { code: "BRL", symbol: "R$", name: "Brazilian Real", flagEmoji: "🇧🇷" },
    { code: "KRW", symbol: "₩", name: "South Korean Won", flagEmoji: "🇰🇷" },
    { code: "ZAR", symbol: "R", name: "South African Rand", flagEmoji: "🇿🇦" },
    { code: "THB", symbol: "฿", name: "Thai Baht", flagEmoji: "🇹🇭" },
    { code: "MYR", symbol: "RM", name: "Malaysian Ringgit", flagEmoji: "🇲🇾" },
    { code: "IDR", symbol: "Rp", name: "Indonesian Rupiah", flagEmoji: "🇮🇩" },
    { code: "PHP", symbol: "₱", name: "Philippine Peso", flagEmoji: "🇵🇭" },
    { code: "NZD", symbol: "NZ$", name: "New Zealand Dollar", flagEmoji: "🇳🇿" },
    { code: "SEK", symbol: "kr", name: "Swedish Krona", flagEmoji: "🇸🇪" },
    { code: "NOK", symbol: "kr", name: "Norwegian Krone", flagEmoji: "🇳🇴" },
    { code: "DKK", symbol: "kr", name: "Danish Krone", flagEmoji: "🇩🇰" },
    { code: "PLN", symbol: "zł", name: "Polish Zloty", flagEmoji: "🇵🇱" },
    { code: "TRY", symbol: "₺", name: "Turkish Lira", flagEmoji: "🇹🇷" },
    { code: "RUB", symbol: "₽", name: "Russian Ruble", flagEmoji: "🇷🇺" },
    { code: "MXN", symbol: "MX$", name: "Mexican Peso", flagEmoji: "🇲🇽" },
    { code: "HKD", symbol: "HK$", name: "Hong Kong Dollar", flagEmoji: "🇭🇰" },
    { code: "TWD", symbol: "NT$", name: "Taiwan Dollar", flagEmoji: "🇹🇼" },
    { code: "SAR", symbol: "﷼", name: "Saudi Riyal", flagEmoji: "🇸🇦" },
    { code: "QAR", symbol: "﷼", name: "Qatari Riyal", flagEmoji: "🇶🇦" }
];

export function getSymbol(code) {
    const currency = currencies.find(c => c.code === code);
    return currency ? currency.symbol : code;
}

export function formatCompact(amount, currencyCode = "BDT") {
    const symbol = getSymbol(currencyCode);
    const validAmount = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
    if (validAmount >= 10000000) return `${symbol}${(validAmount / 10000000).toFixed(1)}Cr`;
    if (validAmount >= 100000) return `${symbol}${(validAmount / 100000).toFixed(1)}L`;
    if (validAmount >= 1000) return `${symbol}${(validAmount / 1000).toFixed(1)}K`;
    return `${symbol}${validAmount.toFixed(0)}`;
}

export function formatSimple(amount, currencyCode = "BDT") {
    const symbol = getSymbol(currencyCode);
    const validAmount = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
    // Mimic string formatting with thousands separators
    const numStr = validAmount % 1 === 0 
        ? validAmount.toLocaleString('en-US') 
        : validAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return `${symbol}${numStr}`;
}
