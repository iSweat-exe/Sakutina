/** Below this bank balance, the boosted "small saver" interest rate applies. */
export const POOR_BANK_THRESHOLD = 20_000;
/** Interest rate for balances at or below POOR_BANK_THRESHOLD. */
export const POOR_INTEREST_RATE = 0.05;
/** Interest rate for balances above POOR_BANK_THRESHOLD (the original flat rate, unchanged). */
export const STANDARD_INTEREST_RATE = 0.01;
/**
 * Hard ceiling on interest credited per run, regardless of balance size.
 * A percentage-only rate still lets a hoarded fortune compound into
 * economy-breaking amounts even at a "small" rate, so this caps the
 * absolute payout instead of relying on the percentage alone.
 */
export const MAX_BANK_INTEREST_PER_RUN = 2_500;

/**
 * Interest earned by a single bank balance under the tiered/capped rules
 * above. Uses marginal (tax-bracket-style) rates rather than a hard
 * cutoff: only the portion of the balance above POOR_BANK_THRESHOLD earns
 * the lower standard rate, the portion at or below it always earns the
 * boosted rate. This keeps the payout strictly non-decreasing in balance,
 * so there's no cliff a player could exploit by withdrawing down to the
 * threshold to farm a better rate.
 */
export function computeBankInterest(bank: number): number {
    if (bank <= 0) return 0;
    const interest =
        bank <= POOR_BANK_THRESHOLD
            ? bank * POOR_INTEREST_RATE
            : POOR_BANK_THRESHOLD * POOR_INTEREST_RATE +
              (bank - POOR_BANK_THRESHOLD) * STANDARD_INTEREST_RATE;
    return Math.round(Math.min(interest, MAX_BANK_INTEREST_PER_RUN));
}
