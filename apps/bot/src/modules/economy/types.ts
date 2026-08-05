/**
 * A single internal rank/promotion tier within a job. Ranks are unlocked by
 * seniority (shifts worked) in that specific job, not by global XP.
 */
export interface JobRank {
    title: string;
    minShifts: number;
    salaryMin: number;
    salaryMax: number;
    cooldownSeconds: number;
}

/**
 * Type definition for a job in the work system.
 */
export interface JobInfo {
    id: string;
    minExperience: number;
    ranks: JobRank[];
}

/**
 * Type definition for a cosmetic item in the shop.
 */
export interface ShopItemInfo {
    key: string;
    name: string;
    price: number;
}

/**
 * Type definition for a fictional stock traded via /invest. `volatility` is
 * the max fraction of the current price the random walk can swing by per
 * tick (see InvestmentService.tickAllPrices).
 */
export interface StockInfo {
    ticker: string;
    name: string;
    basePrice: number;
    volatility: number;
}
