import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { withTimeout, NETWORK_TIMEOUT_MS, NETWORK_HELP } from "@/lib/network";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { OnboardingLayout } from "@/components/OnboardingLayout";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";

const GoogleIcon = () => (
  <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
);

const Auth = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, loading: authLoading } = useAuth();
  const params = new URLSearchParams(location.search);
  const prefillEmail = params.get("email") ?? "";
  const tabParam = params.get("tab");
  const [mode, setMode] = useState<"signin" | "signup">(
    tabParam === "signup" || (prefillEmail && tabParam !== "signin") ? "signup" : "signin"
  );

  const [email, setEmail] = useState(prefillEmail);
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [signupSent, setSignupSent] = useState(false);

  const rawRedirect = params.get("redirect") || "/projects";
  const redirect = rawRedirect.startsWith("/") && !rawRedirect.startsWith("//") ? rawRedirect : "/projects";
  const suspendedError = params.get("error") === "suspended";

  useEffect(() => {
    document.title = mode === "signup" ? "Create account — ReportAir" : "Sign in — ReportAir";
  }, [mode]);

  useEffect(() => {
    if (user) navigate(redirect, { replace: true });
  }, [user, navigate, redirect]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setBusy(false);
    if (error) return toast.error(error.message);
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim() || password.length < 8) {
      return toast.error("Please complete all fields (password ≥ 8 chars).");
    }
    setBusy(true);
    try {
      const { data, error } = await withTimeout(
        supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/projects`,
            data: { full_name: fullName },
          },
        }),
        NETWORK_TIMEOUT_MS,
        "Sign up"
      );
      setBusy(false);
      if (error) return toast.error(error.message, { description: NETWORK_HELP });
      if (data.session) {
        navigate("/onboarding", { replace: true });
      } else {
        setSignupSent(true);
      }
    } catch (err) {
      setBusy(false);
      const msg = err instanceof Error ? err.message : "Sign up failed";
      toast.error(msg, { description: NETWORK_HELP });
    }
  };

  const handleGoogle = async () => {
    setBusy(true);
    try {
      const { lovable } = await import("@/integrations/lovable/index");
      const result = await withTimeout(
        lovable.auth.signInWithOAuth("google", {
          redirect_uri: `${window.location.origin}/projects`,
        }),
        NETWORK_TIMEOUT_MS,
        "Google sign-in"
      );
      if (result.redirected) return;
      if (result.error) {
        setBusy(false);
        const msg = result.error instanceof Error ? result.error.message : String(result.error);
        toast.error("Google sign-in failed", { description: msg });
        return;
      }
      navigate("/projects");
    } catch (err) {
      setBusy(false);
      const msg = err instanceof Error ? err.message : "Google sign-in failed";
      toast.error(msg, { description: NETWORK_HELP });
    }
  };

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const orDivider = (
    <div className="relative my-6">
      <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
      <div className="relative flex justify-center text-xs uppercase">
        <span className="bg-card px-2 text-muted-foreground">or</span>
      </div>
    </div>
  );

  const googleButton = (
    <Button variant="outline" type="button" className="w-full" onClick={handleGoogle} disabled={busy}>
      <GoogleIcon />
      Continue with Google
    </Button>
  );

  const content = signupSent ? (
    <div>
      <h2 className="text-2xl font-bold text-foreground mb-1">Check your email</h2>
      <p className="text-sm text-muted-foreground mb-6">
        We sent a confirmation link to <span className="font-medium text-foreground">{email}</span>. Click it to activate your account, then sign in.
      </p>
      <button
        type="button"
        onClick={() => { setSignupSent(false); setMode("signin"); }}
        className="block w-full text-center text-sm text-muted-foreground hover:text-foreground"
      >
        Back to sign in
      </button>
    </div>
  ) : mode === "signin" ? (
    <div>
      <h2 className="text-2xl font-bold text-foreground mb-1">Welcome back</h2>
      <p className="text-sm text-muted-foreground mb-6">Sign in to continue.</p>
      {suspendedError && (
        <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
          Your account has been suspended. Please contact support.
        </div>
      )}
      <form onSubmit={handleSignIn} className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="email-in">Email</Label>
          <Input id="email-in" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pw-in">Password</Label>
          <Input id="pw-in" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <Button type="submit" className="w-full bg-[#1A6EFF] hover:bg-[#1A6EFF]/90 text-white" disabled={busy}>
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Sign in
        </Button>
        <Link to="/forgot-password" className="block text-center text-sm text-muted-foreground hover:text-foreground">
          Forgot password?
        </Link>
      </form>
      {orDivider}
      {googleButton}
      <p className="mt-6 text-center text-sm text-muted-foreground">
        No account yet?{" "}
        <button
          type="button"
          onClick={() => setMode("signup")}
          className="text-[#1A6EFF] hover:underline font-medium"
        >
          Sign up →
        </button>
      </p>
    </div>
  ) : (
    <div>
      <h2 className="text-2xl font-bold text-foreground mb-1">Create your account</h2>
      <p className="text-sm text-muted-foreground mb-6">Start your free 14-day trial. No credit card required.</p>
      <form onSubmit={handleSignUp} className="space-y-3">
        <div className="space-y-2">
          <Label htmlFor="name-up">Name</Label>
          <Input id="name-up" required value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Alex Rivera" />
        </div>
        <div className="space-y-2">
          <Label htmlFor="email-up">Email</Label>
          <Input id="email-up" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="space-y-2">
          <Label htmlFor="pw-up">Password</Label>
          <Input id="pw-up" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <Button type="submit" className="w-full bg-[#1A6EFF] hover:bg-[#1A6EFF]/90 text-white" disabled={busy}>
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Create account
        </Button>
      </form>
      {orDivider}
      {googleButton}
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <button
          type="button"
          onClick={() => setMode("signin")}
          className="text-[#1A6EFF] hover:underline font-medium"
        >
          Sign in →
        </button>
      </p>
    </div>
  );

  return <OnboardingLayout>{content}</OnboardingLayout>;
};

export default Auth;
