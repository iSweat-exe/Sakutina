import { Navigate } from 'react-router-dom';
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/lib/auth-context';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? '';

export function LoginPage() {
    const { user, loading } = useAuth();

    if (loading) return null;
    if (user) return <Navigate to="/guilds" replace />;

    return (
        <div className="flex min-h-svh items-center justify-center">
            <Card className="w-full max-w-sm">
                <CardHeader>
                    <CardTitle>Panneau Sakutina</CardTitle>
                    <CardDescription>
                        Connecte-toi avec Discord pour administrer tes serveurs.
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Button asChild className="w-full">
                        <a href={`${API_BASE}/auth/login`}>
                            Se connecter avec Discord
                        </a>
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
