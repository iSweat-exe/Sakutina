import type { JobInfo, ShopItemInfo } from './types.js';

/** Daily reward amount (coins) */
export const DAILY_REWARD = 500;

/** Shift count thresholds shared by every job's 3 internal ranks */
const RANK_THRESHOLDS = [0, 15, 40] as const;
/** Cooldown (seconds) per rank tier â€” higher ranks work a bit faster */
const RANK_COOLDOWNS = [300, 240, 195] as const;

/** Salary bonus granted per consecutive day worked, capped at STREAK_BONUS_CAP */
export const STREAK_BONUS_PER_DAY = 0.02;
/** Maximum streak salary bonus (30%) */
export const STREAK_BONUS_CAP = 0.3;

/** All available jobs in the work system, each with 3 internal ranks unlocked by seniority */
export const AVAILABLE_JOBS: JobInfo[] = [
    {
        id: 'barista',
        minExperience: 0,
        ranks: [
            { title: 'Barista', salaryMin: 10, salaryMax: 30 },
            { title: 'Senior Barista', salaryMin: 18, salaryMax: 38 },
            { title: 'Shift Manager', salaryMin: 28, salaryMax: 50 },
        ].map((r, i) => ({
            ...r,
            minShifts: RANK_THRESHOLDS[i]!,
            cooldownSeconds: RANK_COOLDOWNS[i]!,
        })),
    },
    {
        id: 'cashier',
        minExperience: 0,
        ranks: [
            { title: 'Cashier', salaryMin: 12, salaryMax: 28 },
            { title: 'Head Cashier', salaryMin: 20, salaryMax: 36 },
            { title: 'Store Supervisor', salaryMin: 30, salaryMax: 48 },
        ].map((r, i) => ({
            ...r,
            minShifts: RANK_THRESHOLDS[i]!,
            cooldownSeconds: RANK_COOLDOWNS[i]!,
        })),
    },
    {
        id: 'delivery',
        minExperience: 20,
        ranks: [
            { title: 'Delivery Driver', salaryMin: 25, salaryMax: 50 },
            { title: 'Senior Driver', salaryMin: 38, salaryMax: 65 },
            { title: 'Dispatch Lead', salaryMin: 55, salaryMax: 90 },
        ].map((r, i) => ({
            ...r,
            minShifts: RANK_THRESHOLDS[i]!,
            cooldownSeconds: RANK_COOLDOWNS[i]!,
        })),
    },
    {
        id: 'chef',
        minExperience: 50,
        ranks: [
            { title: 'Line Cook', salaryMin: 35, salaryMax: 65 },
            { title: 'Sous Chef', salaryMin: 52, salaryMax: 90 },
            { title: 'Head Chef', salaryMin: 75, salaryMax: 125 },
        ].map((r, i) => ({
            ...r,
            minShifts: RANK_THRESHOLDS[i]!,
            cooldownSeconds: RANK_COOLDOWNS[i]!,
        })),
    },
    {
        id: 'developer',
        minExperience: 100,
        ranks: [
            { title: 'Developer', salaryMin: 60, salaryMax: 120 },
            { title: 'Senior Developer', salaryMin: 90, salaryMax: 165 },
            { title: 'Lead Developer', salaryMin: 130, salaryMax: 220 },
        ].map((r, i) => ({
            ...r,
            minShifts: RANK_THRESHOLDS[i]!,
            cooldownSeconds: RANK_COOLDOWNS[i]!,
        })),
    },
    {
        id: 'doctor',
        minExperience: 250,
        ranks: [
            { title: 'Resident Doctor', salaryMin: 150, salaryMax: 260 },
            { title: 'Doctor', salaryMin: 210, salaryMax: 340 },
            { title: 'Chief Physician', salaryMin: 290, salaryMax: 440 },
        ].map((r, i) => ({
            ...r,
            minShifts: RANK_THRESHOLDS[i]!,
            cooldownSeconds: RANK_COOLDOWNS[i]!,
        })),
    },
    {
        id: 'ceo',
        minExperience: 500,
        ranks: [
            { title: 'CEO', salaryMin: 200, salaryMax: 500 },
            { title: 'Executive CEO', salaryMin: 300, salaryMax: 620 },
            { title: 'Founder & Chairman', salaryMin: 420, salaryMax: 800 },
        ].map((r, i) => ({
            ...r,
            minShifts: RANK_THRESHOLDS[i]!,
            cooldownSeconds: RANK_COOLDOWNS[i]!,
        })),
    },
];

/** All cosmetic titles purchasable in the shop */
export const SHOP_ITEMS: ShopItemInfo[] = [
    { key: 'title_early_bird', name: 'ðŸŒ… Early Bird', price: 1000 },
    { key: 'title_night_owl', name: 'ðŸŒ™ Night Owl', price: 1000 },
    { key: 'title_high_roller', name: 'ðŸŽ° High Roller', price: 3000 },
    { key: 'title_legend', name: 'ðŸ† Legend', price: 5000 },
    { key: 'title_vip', name: 'ðŸ’Ž VIP', price: 10000 },
];


