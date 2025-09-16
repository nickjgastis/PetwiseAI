import React, { useState } from "react";
import axios from "axios";
import { useAuth0 } from "@auth0/auth0-react";

const API_URL = process.env.NODE_ENV === "production"
    ? "https://api.petwise.vet"
    : "http://localhost:3001";

export default function StudentRedeem({ onSuccess, onCancel, userData }) {
    const { getAccessTokenSilently, user } = useAuth0();
    const [accessCode, setAccessCode] = useState("");
    const [email, setEmail] = useState("");
    const [gradYear, setGradYear] = useState(userData?.student_grad_year || new Date().getUTCFullYear());
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const years = Array.from({ length: 5 }, (_, i) => new Date().getUTCFullYear() + i); // now..now+4

    const canRedeemStudentAccess = () => {
        // Check if user has active paid subscription
        if (userData?.stripe_customer_id &&
            userData?.subscription_status === 'active' &&
            !userData?.cancel_at_period_end) {
            return false; // Block student access
        }

        // Existing graduation year check
        if (userData?.student_grad_year) {
            const gradYear = userData.student_grad_year;
            const cutoffDate = new Date(Date.UTC(gradYear, 7, 31, 23, 59, 59, 999));
            return new Date() < cutoffDate;
        }

        return true;
    };

    const redeem = async () => {
        try {
            setError("");
            setLoading(true);

            const token = await getAccessTokenSilently();
            const res = await axios.post(`${API_URL}/student/redeem`, {
                access_code: accessCode,
                student_email: email || undefined,
                grad_year: gradYear,
                user_id: user.sub
            }, {
                headers: { Authorization: `Bearer ${token}` }
            });

            setLoading(false);
            onSuccess?.(res.data);
        } catch (e) {
            setLoading(false);
            setError(e?.response?.data?.error || "Redemption failed");
        }
    };

    return (
        <div className="max-w-md mx-auto bg-white rounded-lg shadow-lg p-6">
            <div className="mb-6">
                <h3 className="text-2xl font-bold text-gray-900 mb-2">Student Access</h3>
                <p className="text-gray-600 text-sm">
                    Enter your access code and graduation year to get free PetWise access.
                </p>
            </div>

            <div className="space-y-4">
                {!canRedeemStudentAccess() && (
                    <div className="bg-yellow-50 border border-yellow-200 rounded-md p-3">
                        <p className="text-yellow-800 text-sm">
                            You currently have an active paid subscription. Please cancel your subscription first before redeeming student access.
                        </p>
                    </div>
                )}

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Access Code *
                    </label>
                    <input
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        value={accessCode}
                        onChange={e => setAccessCode(e.target.value)}
                        placeholder="Enter your student access code"
                        disabled={loading || !canRedeemStudentAccess()}
                    />
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Graduation Year *
                    </label>
                    <select
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        value={gradYear}
                        onChange={e => setGradYear(Number(e.target.value))}
                        disabled={loading || !!userData?.student_grad_year || !canRedeemStudentAccess()}
                    >
                        {years.map(y => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                    {userData?.student_grad_year && (
                        <p className="text-xs text-gray-500 mt-1">
                            Graduation year is locked once set
                        </p>
                    )}
                </div>

                <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                        Student Email *
                    </label>
                    <input
                        className="w-full border border-gray-300 rounded-md px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="name@school.edu"
                        type="email"
                        disabled={loading || !canRedeemStudentAccess()}
                        required
                    />
                </div>

                {error && (
                    <div className="bg-red-50 border border-red-200 rounded-md p-3">
                        <div className="text-red-600 text-sm">{error}</div>
                    </div>
                )}

                <div className="flex space-x-3 pt-4">
                    <button
                        disabled={loading || !accessCode || !gradYear || !email || !canRedeemStudentAccess()}
                        onClick={redeem}
                        className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-md hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? "Applying..." : "Apply Student Access"}
                    </button>

                    {onCancel && (
                        <button
                            onClick={onCancel}
                            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                            disabled={loading}
                        >
                            Cancel
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}
