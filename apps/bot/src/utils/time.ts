/** Formats a duration in seconds as a compact "Xm Ys" / "Ys" string. */
export function formatDuration(totalSeconds: number): string {
    const s = Math.max(0, Math.round(totalSeconds));
    const minutes = Math.floor(s / 60);
    const seconds = s % 60;
    return minutes === 0 ? `${seconds}s` : `${minutes}m ${seconds}s`;
}

/** Formats a duration in seconds as a compact "Xh Ym" / "Ym Ys" / "Ys" string. */
export function formatLongDuration(totalSeconds: number): string {
    const s = Math.max(0, Math.round(totalSeconds));
    const hours = Math.floor(s / 3600);
    if (hours === 0) return formatDuration(s);
    const minutes = Math.floor((s % 3600) / 60);
    return `${hours}h ${minutes}m`;
}


