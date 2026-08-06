import { BrowserRouter } from 'react-router';
import { AuthProvider } from '@/lib/auth-context';
import { ThemeProvider } from '@/lib/theme-context';
import { ToastProvider } from '@/lib/toast-context';
import { Toaster } from '@/components/ui/toaster';
import { AppRoutes } from '@/routes';

function App() {
    return (
        <ThemeProvider>
            <ToastProvider>
                <BrowserRouter>
                    <AuthProvider>
                        <AppRoutes />
                    </AuthProvider>
                </BrowserRouter>
                <Toaster />
            </ToastProvider>
        </ThemeProvider>
    );
}

export default App;
