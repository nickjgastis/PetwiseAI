import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth0 } from '@auth0/auth0-react';

const Callback = () => {
    const { isLoading, isAuthenticated, error } = useAuth0();
    const navigate = useNavigate();

    useEffect(() => {
        if (isLoading) return;
        if (isAuthenticated) {
            navigate('/dashboard', { replace: true });
            return;
        }
        if (error) return;
        navigate('/', { replace: true });
    }, [isLoading, isAuthenticated, error, navigate]);

    if (error) {
        return (
            <div className="min-h-screen bg-[#3369bd] flex items-center justify-center p-6">
                <div className="text-center text-white max-w-md">
                    <p className="text-xl font-semibold mb-2">Login didn’t finish</p>
                    <p className="text-white/80 text-sm mb-6">{error.message}</p>
                    <button
                        type="button"
                        onClick={() => navigate('/', { replace: true })}
                        className="px-5 py-2.5 rounded-xl bg-white text-[#3369bd] font-semibold text-sm"
                    >
                        Try again
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#3369bd] flex items-center justify-center">
            <div className="text-white text-xl">Loading...</div>
        </div>
    );
};

export default Callback;
