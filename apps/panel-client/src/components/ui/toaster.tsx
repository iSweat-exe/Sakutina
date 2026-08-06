import { CheckCircle2, Info, X, XCircle } from 'lucide-react';
import { useToast, type ToastVariant } from '@/lib/toast-context';
import { cn } from '@/lib/utils';

const ICONS: Record<ToastVariant, typeof CheckCircle2> = {
    success: CheckCircle2,
    error: XCircle,
    info: Info,
};

const STYLES: Record<ToastVariant, string> = {
    success: 'border-emerald-500/30 [&_svg.toast-icon]:text-emerald-500',
    error: 'border-destructive/30 [&_svg.toast-icon]:text-destructive',
    info: 'border-border [&_svg.toast-icon]:text-muted-foreground',
};

export function Toaster() {
    const { toasts, dismiss } = useToast();

    if (toasts.length === 0) return null;

    return (
        <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-full max-w-sm flex-col gap-2">
            {toasts.map((t) => {
                const Icon = ICONS[t.variant];
                return (
                    <div
                        key={t.id}
                        className={cn(
                            'toast-enter pointer-events-auto flex items-start gap-2 rounded-lg border bg-card p-3 pr-2 text-sm shadow-lg',
                            STYLES[t.variant]
                        )}
                    >
                        <Icon className="toast-icon mt-0.5 size-4 shrink-0" />
                        <p className="flex-1 text-card-foreground">
                            {t.message}
                        </p>
                        <button
                            onClick={() => dismiss(t.id)}
                            className="shrink-0 rounded p-0.5 text-muted-foreground hover:text-foreground"
                            aria-label="Fermer"
                        >
                            <X className="size-3.5" />
                        </button>
                    </div>
                );
            })}
        </div>
    );
}
