export interface StockInfo {
    ticker: string;
    name: string;
    basePrice: number;
    volatility: number;
}

export const STOCK_LIST: StockInfo[] = [
    { ticker: 'SAKU', name: 'Sakutina Corp', basePrice: 250, volatility: 0.04 },
    {
        ticker: 'TECH',
        name: 'NexTech Industries',
        basePrice: 180,
        volatility: 0.07,
    },
    {
        ticker: 'FOOD',
        name: 'Golden Bite Foods',
        basePrice: 60,
        volatility: 0.03,
    },
    { ticker: 'BANK', name: 'Ironvale Bank', basePrice: 320, volatility: 0.02 },
    {
        ticker: 'GAME',
        name: 'Pixel Forge Games',
        basePrice: 90,
        volatility: 0.08,
    },
    {
        ticker: 'OIL',
        name: 'Blackwell Energy',
        basePrice: 140,
        volatility: 0.05,
    },
    {
        ticker: 'MEME',
        name: 'MoonCoin Holdings',
        basePrice: 20,
        volatility: 0.15,
    },
];

/**
 * Mean-reverting random walk: nudges the price back toward its base price
 * while adding volatility-scaled noise. Floors at 1 to avoid zero/negative prices.
 */
export function tickStockPrice(
    price: number,
    basePrice: number,
    volatility: number
): number {
    const reversion = (basePrice - price) * 0.05;
    const noise = price * (Math.random() * 2 - 1) * volatility;
    return Math.max(1, Math.round(price + reversion + noise));
}

/** Weighted-average buy price after adding `newQty` shares bought for `cost` total. */
export function computeAvgBuyPrice(
    existingAvg: number,
    existingQty: number,
    cost: number,
    newQty: number
): number {
    return Math.round((existingAvg * existingQty + cost) / newQty);
}
