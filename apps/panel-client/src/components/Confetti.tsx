import * as React from 'react';

const COLORS = [
    '#f43f5e',
    '#f59e0b',
    '#10b981',
    '#3b82f6',
    '#a855f7',
    '#ec4899',
];
const PARTICLE_COUNT = 36;

interface Particle {
    id: number;
    left: number;
    color: string;
    delay: number;
    duration: number;
    drift: number;
    rotate: number;
}

function makeParticles(): Particle[] {
    return Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        color: COLORS[Math.floor(Math.random() * COLORS.length)]!,
        delay: Math.random() * 0.15,
        duration: 0.9 + Math.random() * 0.6,
        drift: (Math.random() - 0.5) * 160,
        rotate: Math.random() * 720 - 360,
    }));
}

/**
 * Fires a confetti burst whenever `trigger` changes to a new non-zero value
 * (pass an incrementing counter, not a boolean, so repeated wins re-fire).
 * Parent must be `position: relative` — this fills it with `absolute inset-0`.
 */
export function Confetti({ trigger }: { trigger: number }) {
    const [particles, setParticles] = React.useState<Particle[]>([]);

    React.useEffect(() => {
        if (trigger === 0) return;
        setParticles(makeParticles());
        const id = setTimeout(() => setParticles([]), 1700);
        return () => clearTimeout(id);
    }, [trigger]);

    if (particles.length === 0) return null;

    return (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
            {particles.map((p) => (
                <span
                    key={p.id}
                    className="confetti-piece absolute top-1/3 block h-2.5 w-1.5 rounded-[1px]"
                    style={
                        {
                            left: `${p.left}%`,
                            backgroundColor: p.color,
                            animationDelay: `${p.delay}s`,
                            animationDuration: `${p.duration}s`,
                            '--confetti-drift': `${p.drift}px`,
                            '--confetti-rotate': `${p.rotate}deg`,
                        } as React.CSSProperties
                    }
                />
            ))}
        </div>
    );
}
