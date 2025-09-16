const crypto = require("crypto");
const express = require("express");
const { createClient } = require("@supabase/supabase-js");

const studentRouter = express.Router();

// Use existing auth system - students must be logged in

// Use the same Supabase client as the main server (anon key)
const getSupabaseClient = () => {
    if (!process.env.REACT_APP_SUPABASE_URL || !process.env.REACT_APP_SUPABASE_ANON_KEY) {
        throw new Error('Missing Supabase environment variables');
    }
    return createClient(
        process.env.REACT_APP_SUPABASE_URL,
        process.env.REACT_APP_SUPABASE_ANON_KEY
    );
};

const hash = (s) => {
    if (!process.env.SECRET_SALT) {
        throw new Error('SECRET_SALT environment variable is required');
    }
    return crypto.createHash("sha256").update(process.env.SECRET_SALT + s).digest("hex");
};

const cutoffMM = Number(process.env.SCHOOLYEAR_CUTOFF_MM || 8);  // Aug
const cutoffDD = Number(process.env.SCHOOLYEAR_CUTOFF_DD || 31); // 31


//YEAR LONG STUDENT CODE CHANGE HERE
//YEAR LONG STUDENT CODE CHANGE HERE
//YEAR LONG STUDENT CODE CHANGE HERE
//YEAR LONG STUDENT CODE CHANGE HERE

// Hardcoded student access code for this academic year
const CURRENT_STUDENT_CODE = "PW-STUDENT-2025-26";
const GRANTS_UNTIL = "2026-08-31T23:59:59Z"; // End of academic year
const EXPIRES_AT = "2026-08-31T23:59:59Z";   // Same as grants_until - no grace period

// Generate hash when needed, not at module load
const getCurrentCodeHash = () => hash(CURRENT_STUDENT_CODE);

const endOfDayUTC = (d) => {
    const x = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate(), 23, 59, 59, 999));
    return x.toISOString();
};

studentRouter.post("/redeem", async (req, res) => {
    try {
        console.log("Student redemption request:", req.body);
        const { access_code, student_email, grad_year } = req.body || {};
        if (!access_code || !grad_year || !student_email) {
            console.log("Missing required fields:", { access_code: !!access_code, grad_year: !!grad_year, student_email: !!student_email });
            return res.status(400).json({ error: "Missing required fields: access code, graduation year, and student email are required" });
        }

        // Get user ID from Auth0 token (students must be logged in)
        const auth0UserId = req.body.user_id; // Frontend will send this

        if (!auth0UserId) {
            return res.status(400).json({ error: "User not authenticated" });
        }

        // Load user from database
        const supa = getSupabaseClient();
        const { data: user, error: uerr } = await supa
            .from("users")
            .select("id, subscription_end_date, plan_label, student_last_student_redeem_at, student_grad_year")
            .eq("auth0_user_id", auth0UserId)
            .single();

        if (uerr || !user) {
            return res.status(400).json({ error: "User not found" });
        }

        // Check if user already has a graduation year set (locked)
        if (user.student_grad_year && user.student_grad_year !== Number(grad_year)) {
            return res.status(400).json({ error: "Graduation year cannot be changed once set" });
        }

        // 1) Graduation cutoff gate
        const gy = Number(grad_year);
        if (!gy || gy < 2000 || gy > 2100) {
            return res.status(400).json({ error: "Invalid graduation year" });
        }

        const gradCutoff = new Date(Date.UTC(gy, cutoffMM - 1, cutoffDD, 23, 59, 59, 999));
        if (new Date() >= gradCutoff) {
            return res.status(400).json({ error: "Graduation date has passed for student access" });
        }

        // 2) Validate the hardcoded code
        const codeHash = hash(access_code.trim());
        if (codeHash !== getCurrentCodeHash()) {
            return res.status(400).json({ error: "Invalid access code" });
        }

        // 3) Check if code has expired
        if (new Date() >= new Date(EXPIRES_AT)) {
            return res.status(400).json({ error: "Access code has expired" });
        }

        // 4) Prevent double-redeem by checking if user already has student access
        if (user?.plan_label === 'student' && user?.student_last_student_redeem_at) {
            return res.status(400).json({ error: "Already redeemed student access" });
        }

        // 5) Grant until end of school year
        const currentEnd = user.subscription_end_date ? new Date(user.subscription_end_date) : null;
        const grantUntil = new Date(GRANTS_UNTIL);
        const freeUntil = currentEnd && currentEnd > grantUntil ? currentEnd : grantUntil;

        // 5) Update user → mark student mode + persist fields
        const updates = {
            subscription_status: 'active', // Set to active so student can use the system
            subscription_end_date: endOfDayUTC(freeUntil),
            student_school_email: student_email || null,
            student_grad_year: gy,
            student_last_student_redeem_at: new Date().toISOString(),
            plan_label: "student", // toggles Student Mode on UI
        };

        const { error: upErr } = await supa
            .from("users")
            .update(updates)
            .eq("id", user.id);

        if (upErr) {
            return res.status(500).json({ error: "Failed to update user" });
        }

        // 6) No need to record redemption in database with hardcoded approach

        return res.json({
            ok: true,
            free_until: endOfDayUTC(freeUntil),
            message: "Student access granted successfully"
        });
    } catch (e) {
        console.error("Student redemption error:", e);
        return res.status(500).json({ error: "Server error" });
    }
});

module.exports = studentRouter;
