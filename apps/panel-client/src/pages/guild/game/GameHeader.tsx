import { Link } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

export function GameHeader({
    title,
    balance,
}: {
    title: string;
    balance: number | null;
}) {
    return (
        <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
                <Link
                    to=".."
                    relative="path"
                    className="text-muted-foreground hover:text-foreground"
                    title="Retour au casino"
                >
                    <ArrowLeft className="size-5" />
                </Link>
                <h1 className="text-2xl font-semibold">{title}</h1>
            </div>
            <div className="text-right">
                <p className="text-xs text-muted-foreground">Solde</p>
                {balance === null ? (
                    <Skeleton className="h-6 w-20" />
                ) : (
                    <p className="text-lg font-semibold">{balance} 🪙</p>
                )}
            </div>
        </div>
    );
}
