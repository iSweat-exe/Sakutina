import type { JobInfo } from './types.js';

/** Daily reward amount (coins) */
export const DAILY_REWARD = 500;

/** Work shift cooldown in seconds */
export const SHIFT_COOLDOWN_SECONDS = 30;

/** All available jobs in the work system */
export const AVAILABLE_JOBS: JobInfo[] = [
    {
        id: 'barista',
        title: 'Barista',
        minExperience: 0,
        salaryMin: 10,
        salaryMax: 30,
    },
    {
        id: 'delivery',
        title: 'Delivery Driver',
        minExperience: 20,
        salaryMin: 25,
        salaryMax: 50,
    },
    {
        id: 'developer',
        title: 'Developer',
        minExperience: 100,
        salaryMin: 60,
        salaryMax: 120,
    },
    {
        id: 'ceo',
        title: 'CEO',
        minExperience: 500,
        salaryMin: 200,
        salaryMax: 500,
    },
];
