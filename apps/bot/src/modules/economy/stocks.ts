import type { StockInfo } from './types.js';

/** All fictional stocks tradable via /invest, seeded at startup. */
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
