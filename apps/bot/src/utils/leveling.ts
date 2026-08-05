/**
 * Computes the level based on experience.
 * Formula: Math.floor(Math.sqrt(XP / 10))
 */
export function calculateLevel(xp: number): number {
    return Math.floor(Math.sqrt(xp / 10));
}
