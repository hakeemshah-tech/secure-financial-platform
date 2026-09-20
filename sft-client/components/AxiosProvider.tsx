'use client';

import { useEffect, useState } from 'react';
import axios from 'axios';
import { useUserStore } from '@/lib/store';
import { useRouter } from 'next/navigation';

export default function AxiosProvider({ children }: { children: React.ReactNode }) {
    const { logout } = useUserStore();
    const router = useRouter();
    const [isSet, setIsSet] = useState(false);

    useEffect(() => {
        const interceptor = axios.interceptors.response.use(
            (response) => response,
            (error) => {
                if (error.response && error.response.status === 401) {
                    // Check if it's not the login page itself causing 401 (though unlikely for login API)
                    // or if we are already on login page
                    if (window.location.pathname !== '/login') {
                        console.warn('Axios Interceptor: 401 Unauthorized detected. Logging out.');
                        logout();
                        router.push('/login');
                    }
                }
                return Promise.reject(error);
            }
        );

        setIsSet(true);

        return () => {
            axios.interceptors.response.eject(interceptor);
        };
    }, [logout, router]);

    return <>{children}</>;
}
