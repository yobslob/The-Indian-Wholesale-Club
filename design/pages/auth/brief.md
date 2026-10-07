# auth: sign in, create an account, forgot password, email code (website + app sign-in)

**Surface:** website `/login`, `/signup` (and the same card on the profile page, D-089, and in the review panel, D-090)
+ app `auth/login`, `auth/signup` · **Code:** `apps/web/app/(store)/login/`, `signup/`, `apps/web/features/auth/auth-form.tsx`
(Supabase Auth: `signInWithPassword`, `signUp`) · **Status:** mockup, round 1

## The page's job
Let a customer in quickly, with as little typing as possible, and never strand them (a forgotten password has a way back).

## What it shows today
Sign in: email, password, Sign in, "New here? Create an account". Create: full name, email, password (8+), Create
account, "Already have an account? Sign in"; after creating: "Check your inbox to confirm your email, then sign in."
No "Forgot password?" and no other way in.

## Founder's direction (2026-10-08, asked as options)
"Forgot password", "Show password eye", "Email code instead" (also "Nothing else" was ticked; read as the three).

## Design (round 1)
The profile's sign-in card (D-089) centred on the page, in the D-079 / D-080 fonts, with:
- **Show password:** an eye button in the password field (shows / hides it).
- **Forgot password?** under the password: email → "Send reset link" → "Check your email" with the address shown; the
  link opens a "Set a new password" card (password twice, eye on both).
- **Email me a sign-in code:** a second way in under the button: email → "Send code" → six boxes for the code (pasting
  fills them), "Resend code", "Use a password instead". Supabase Auth sends both emails.
- Create account as today (full name, email, password with the eye).
New wording here is draft (D-059).

## Needs
- Supabase's email settings: the reset-link and sign-in-code emails need templates in the IWC voice (and the sender
  domain, Q-9).

## Rounds
| Date | Round | Founder's notes | Changed |
|---|---|---|---|
| 2026-10-08 | 1 | the options above | first proposal |
