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
        <div className="max-w-md mx-auto bg-white rounded-[28px] border border-[#e7ecf3] shadow-[0_40px_80px_-40px_rgba(19,35,63,0.5)] p-6 sm:p-8">
            <div className="mb-6">
                <h3 className="text-[1.5rem] font-semibold tracking-[-0.02em] text-[#13233f] mb-1.5">Student access</h3>
                <p className="text-[#1a2b4a]/65 text-[14px] leading-relaxed">
                    Enter your access code and graduation year to get free PetWise access.
                </p>
            </div>

            <div className="space-y-4">
                {!canRedeemStudentAccess() && (
                    <div className="bg-[#fffaf0] border border-[#f5e2b8] rounded-2xl p-3.5">
                        <p className="text-[#13233f]/80 text-[13px]">
                            You currently have an active paid subscription. Please cancel your subscription first before redeeming student access.
                        </p>
                    </div>
                )}

                <div>
                    <label className="block text-[13px] font-medium text-[#13233f] mb-1.5">
                        Access Code *
                    </label>
                    <input
                        className="w-full border border-[#e7ecf3] rounded-2xl px-4 py-3 text-[15px] text-[#13233f] bg-white placeholder-[#1a2b4a]/35 focus:outline-none focus:border-[#3468bd] focus:ring-4 focus:ring-[#3468bd]/10 disabled:bg-[#f6f8fb] transition-all"
                        value={accessCode}
                        onChange={e => setAccessCode(e.target.value)}
                        placeholder="Enter your student access code"
                        disabled={loading || !canRedeemStudentAccess()}
                    />
                </div>

                <div>
                    <label className="block text-[13px] font-medium text-[#13233f] mb-1.5">
                        Graduation Year *
                    </label>
                    <select
                        className="w-full border border-[#e7ecf3] rounded-2xl px-4 py-3 text-[15px] text-[#13233f] bg-white placeholder-[#1a2b4a]/35 focus:outline-none focus:border-[#3468bd] focus:ring-4 focus:ring-[#3468bd]/10 disabled:bg-[#f6f8fb] transition-all"
                        value={gradYear}
                        onChange={e => setGradYear(Number(e.target.value))}
                        disabled={loading || !!userData?.student_grad_year || !canRedeemStudentAccess()}
                    >
                        {years.map(y => (
                            <option key={y} value={y}>{y}</option>
                        ))}
                    </select>
                    {userData?.student_grad_year && (
                        <p className="text-xs text-[#1a2b4a]/50 mt-1.5">
                            Graduation year is locked once set
                        </p>
                    )}
                </div>

                <div>
                    <label className="block text-[13px] font-medium text-[#13233f] mb-1.5">
                        Student Email *
                    </label>
                    <input
                        className="w-full border border-[#e7ecf3] rounded-2xl px-4 py-3 text-[15px] text-[#13233f] bg-white placeholder-[#1a2b4a]/35 focus:outline-none focus:border-[#3468bd] focus:ring-4 focus:ring-[#3468bd]/10 disabled:bg-[#f6f8fb] transition-all"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        placeholder="name@school.edu"
                        type="email"
                        disabled={loading || !canRedeemStudentAccess()}
                        required
                    />
                </div>

                {error && (
                    <div className="bg-[#fff6f6] border border-[#f6d5d5] rounded-2xl p-3.5">
                        <div className="text-[#d64545] text-[13px]">{error}</div>
                    </div>
                )}

                <div className="flex space-x-3 pt-4">
                    <button
                        disabled={loading || !accessCode || !gradYear || !email || !canRedeemStudentAccess()}
                        onClick={redeem}
                        className="flex-1 bg-[#3468bd] text-white py-3 px-5 rounded-full font-medium text-[14px] hover:bg-[#2a5298] focus:outline-none focus:ring-4 focus:ring-[#3468bd]/15 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                        {loading ? "Applying..." : "Apply Student Access"}
                    </button>

                    {onCancel && (
                        <button
                            onClick={onCancel}
                            className="px-5 py-3 border border-[#13233f]/15 rounded-full text-[#13233f] font-medium text-[14px] hover:border-[#13233f]/40 focus:outline-none transition-colors"
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
