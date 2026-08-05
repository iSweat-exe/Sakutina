export function getUserAvatarUrl(
    userId: string,
    avatar: string | null,
    size = 64
): string {
    if (avatar) {
        return `https://cdn.discordapp.com/avatars/${userId}/${avatar}.png?size=${size}`;
    }
    const index = Number(BigInt(userId) >> 22n) % 6;
    return `https://cdn.discordapp.com/embed/avatars/${index}.png`;
}

export function getGuildIconUrl(
    guildId: string,
    icon: string | null,
    size = 64
): string | null {
    if (!icon) return null;
    return `https://cdn.discordapp.com/icons/${guildId}/${icon}.png?size=${size}`;
}


