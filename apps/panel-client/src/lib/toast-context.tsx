import * as React from 'react';

export type ToastVariant = 'success' | 'error' | 'info';

export interface ToastItem {
    id: number;
    message: string;
    variant: ToastVariant;
}

interface ToastContextValue {
    toasts: ToastItem[];
    dismiss: (id: number) => void;
    success: (message: string) => void;
    error: (message: string) => void;
    info: (message: string) => void;
}

const ToastContext = React.createContext<ToastContextValue | null>(null);
const TOAST_DURATION_MS = 4000;

let nextId = 1;

export function ToastProvider({ children }: { children: React.ReactNode }) {
    const [toasts, setToasts] = React.useState<ToastItem[]>([]);

    const dismiss = React.useCallback((id: number) => {
        setToasts((t) => t.filter((toast) => toast.id !== id));
    }, []);

    const push = React.useCallback(
        (message: string, variant: ToastVariant) => {
            const id = nextId++;
            setToasts((t) => [...t, { id, message, variant }]);
            setTimeout(() => dismiss(id), TOAST_DURATION_MS);
        },
        [dismiss]
    );

    const value = React.useMemo<ToastContextValue>(
        () => ({
            toasts,
            dismiss,
            success: (message) => push(message, 'success'),
            error: (message) => push(message, 'error'),
            info: (message) => push(message, 'info'),
        }),
        [toasts, dismiss, push]
    );

    return (
        <ToastContext.Provider value={value}>
            {children}
        </ToastContext.Provider>
    );
}

export function useToast(): ToastContextValue {
    const ctx = React.useContext(ToastContext);
    if (!ctx) throw new Error('useToast must be used within a ToastProvider');
    return ctx;
}
