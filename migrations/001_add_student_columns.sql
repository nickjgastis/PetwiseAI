-- Add student columns to users table
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS student_school_email text,
  ADD COLUMN IF NOT EXISTS student_grad_year int,
  ADD COLUMN IF NOT EXISTS student_last_student_redeem_at timestamptz,
  ADD COLUMN IF NOT EXISTS plan_label text; -- 'student' when student mode is active

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_plan_label ON public.users(plan_label);
CREATE INDEX IF NOT EXISTS idx_users_student_grad_year ON public.users(student_grad_year);
