import { cn } from '@/lib/utils';

interface DiscordAvatarProps {
    src: string;
    alt: string;
    size?: number;
    className?: string;
}

export function DiscordAvatar({
    src,
    alt,
    size = 32,
    className,
}: DiscordAvatarProps) {
    return (
        <img
            src={src}
            alt={alt}
            width={size}
            height={size}
            className={cn(
                'rounded-full bg-muted shrink-0 object-cover',
                className
            )}
            style={{ width: size, height: size }}
        />
    );
}
