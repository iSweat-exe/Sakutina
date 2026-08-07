import * as React from 'react';
import { cn } from '@/lib/utils';

interface DiscordAvatarProps {
    src: string;
    alt: string;
    size?: number;
    className?: string;
}

function initialsFromAlt(alt: string): string {
    const trimmed = alt.trim();
    return trimmed ? trimmed[0]!.toUpperCase() : '?';
}

export function DiscordAvatar({
    src,
    alt,
    size = 32,
    className,
}: DiscordAvatarProps) {
    const [failed, setFailed] = React.useState(false);

    React.useEffect(() => {
        setFailed(false);
    }, [src]);

    if (failed) {
        return (
            <div
                role="img"
                aria-label={alt}
                className={cn(
                    'rounded-full bg-muted text-muted-foreground shrink-0 flex items-center justify-center font-medium select-none',
                    className
                )}
                style={{
                    width: size,
                    height: size,
                    fontSize: Math.max(10, size * 0.4),
                }}
            >
                {initialsFromAlt(alt)}
            </div>
        );
    }

    return (
        <img
            src={src}
            alt={alt}
            width={size}
            height={size}
            onError={() => setFailed(true)}
            className={cn(
                'rounded-full bg-muted shrink-0 object-cover',
                className
            )}
            style={{ width: size, height: size }}
        />
    );
}
