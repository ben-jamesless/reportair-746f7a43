import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { withTimeout, NETWORK_TIMEOUT_MS, NETWORK_HELP } from "@/lib/network";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { OnboardingLayout } from "@/components/OnboardingLayout";
import { Loader2, Check, ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type PlanKey = "solo" | "pro" | "studio";

const PLANS: {
  key: PlanKey;
  name: string;
  monthly: string;
  annualMonthly: string;
  description: string;
  features: string[];
  recommended?: boolean;
}[] = [
  {
    key: "solo",
    name: "Solo",
    monthly: "HK$128",
    annualMonthly: "HK$102",
    description: "For solo operators running events.",
    features: ["1 active event", "Unlimited PDF exports", "14-day free trial"],
  },
  {
    key: "pro",
    name: "Pro",
    monthly: "HK$298",
    annualMonthly: "HK$238",
    description: "For growing event teams.",
    features: ["5 active events", "5 team members", "Share & client links", "14-day free trial"],
    recommended: true,
  },
  {
    key: "studio",
    name: "Studio",
    monthly: "HK$688",
    annualMonthly: "HK$550",
    description: "For agencies and large organisations.",
    features: ["Unlimited events", "Unlimited members", "Custom branding", "14-day free trial"],
  },
];

const Auth = () => {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const params = new URLSearchParams(window.location.search);
  const prefillEmail = params.get("email") ?? "";
  const tabParam = params.get("tab");
  const initialTab = tabParam === "signin" ? "signin" : (tabParam === "signup" || prefillEmail ? "signup" : "signin");

  // Shared
  const [email, setEmail] = useState(prefillEmail);
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);

  // Sign-up wizard state
  const [signupStep, setSignupStep] = useState<1 | 2 | 3>(1);
  const [teamName, setTeamName] = useState("");
  const [planChoice, setPlanChoice] = useState<PlanKey | null>(null);
  const [annual, setAnnual] = useState(false);
  const [signupSent, setSignupSent] = useState(false);

  const rawRedirect = params.get("redirect") || "/projects";
  const redirect = rawRedirect.startsWith("/") && !rawRedirect.startsWith("//") ? rawRedirect : "/projects";
  const suspendedError = params.get("error") === "suspended";

  useEffect(() => {
    document.title = "Sign in — ReportAir";
  }, []);

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

  const handleGoogle = async () => {
    setBusy(true);
    try {
      const { error } = await withTimeout(
        supabase.auth.signInWithOAuth({
          provider: "google",
          options: { redirectTo: `${window.location.origin}/projects` },
        }),
        NETWORK_TIMEOUT_MS,
        "Google sign-in"
      );
      if (error) {
        setBusy(false);
        toast.error("Google sign-in failed", { description: error.message });
      }
      // On success the browser navigates away — keep busy=true.
    } catch (err) {
      setBusy(false);
      const msg = err instanceof Error ? err.message : "Google sign-in failed";
      toast.error(msg, { description: NETWORK_HELP });
    }
  };

  const submitStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email.trim() || password.length < 8) {
      return toast.error("Please complete all fields (password ≥ 8 chars).");
    }
    setSignupStep(2);
  };

  const submitStep2 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!teamName.trim()) return toast.error("Enter a team or company name.");
    setSignupStep(3);
  };

  const completeSignup = async (chosenPlan: PlanKey | null) => {
    setBusy(true);
    setPlanChoice(chosenPlan);
    try {
      const { data, error } = await withTimeout(
        supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/projects`,
            data: {
              full_name: fullName,
              pending_team_name: teamName,
              pending_plan_choice: chosenPlan,
              pending_plan_interval: annual ? "annual" : "monthly",
            },
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

  if (authLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const isSignup = initialTab === "signup";

  // Sign-in card (unchanged behavior)
  const signinCard = (
    <Card className="shadow-soft">
      <CardHeader>
        <CardTitle>Welcome back</CardTitle>
        <CardDescription>Sign in to continue.</CardDescription>
      </CardHeader>
      <CardContent>
        {suspendedError && (
          <div className="mb-4 rounded-md border border-destructive/50 bg-destructive/10 p-3 text-sm text-destructive">
            Your account has been suspended. Please contact support.
          </div>
        )}
        <Tabs defaultValue="signin" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin">Sign in</TabsTrigger>
            <TabsTrigger value="signup" onClick={() => navigate("/auth?tab=signup", { replace: true })}>
              Sign up
            </TabsTrigger>
          </TabsList>

          <TabsContent value="signin" className="space-y-4 pt-4">
            <form onSubmit={handleSignIn} className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="email-in">Email</Label>
                <Input id="email-in" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="pw-in">Password</Label>
                <Input id="pw-in" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
              </div>
              <Button type="submit" className="w-full" disabled={busy}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Sign in
              </Button>
              <Link to="/forgot-password" className="block text-center text-sm text-muted-foreground hover:text-foreground">
                Forgot password?
              </Link>
            </form>
          </TabsContent>
        </Tabs>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-card px-2 text-muted-foreground">or</span>
          </div>
        </div>

        <Button variant="outline" className="w-full" onClick={handleGoogle} disabled={busy}>
          <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
            <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
            <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </Button>
      </CardContent>
    </Card>
  );

  // Sign-up wizard
  const renderSignupStep = () => {
    if (signupSent) {
      return (
        <div>
          <h2 className="text-2xl font-bold text-[#0F1724] mb-1">Check your email</h2>
          <p className="text-sm text-[#7A7974] mb-6">
            We sent a confirmation link to <span className="font-medium text-[#0F1724]">{email}</span>. Click it to activate your account, then sign in to start your trial.
          </p>
          <div className="rounded-xl border border-[#D4D1CA] bg-[#FBFBF9] p-4 text-sm text-[#0F1724]/80">
            <p className="font-medium mb-1">What's next</p>
            <ul className="space-y-1 text-xs">
              <li>• We'll set up <span className="font-medium">{teamName}</span> for you automatically</li>
              {planChoice && (
                <li>• Your <span className="font-medium capitalize">{planChoice}</span> trial ({annual ? "annual" : "monthly"}) starts on first sign-in</li>
              )}
            </ul>
          </div>
          <Link to="/auth?tab=signin" className="mt-6 block text-center text-sm text-[#7A7974] hover:text-[#0F1724]">
            Back to sign in
          </Link>
        </div>
      );
    }

    if (signupStep === 1) {
      return (
        <div>
          <h2 className="text-2xl font-bold text-[#0F1724] mb-1">Create your account</h2>
          <p className="text-sm text-[#7A7974] mb-6">Start your free 14-day trial. No credit card required.</p>
          <form onSubmit={submitStep1} className="space-y-3">
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
            <Button type="submit" className="w-full bg-[#1A6EFF] hover:bg-[#1A6EFF]/90 text-white">
              Continue
            </Button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center"><span className="w-full border-t" /></div>
            <div className="relative flex justify-center text-xs uppercase"><span className="bg-white px-2 text-muted-foreground">or</span></div>
          </div>
          <Button variant="outline" className="w-full" onClick={handleGoogle} disabled={busy}>
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </Button>
          <p className="mt-4 text-center text-sm text-[#7A7974]">
            Already have an account?{" "}
            <Link to="/auth?tab=signin" className="text-[#1A6EFF] hover:underline">Sign in</Link>
          </p>
        </div>
      );
    }

    if (signupStep === 2) {
      return (
        <div>
          <button onClick={() => setSignupStep(1)} className="mb-4 inline-flex items-center gap-1 text-sm text-[#7A7974] hover:text-[#0F1724]">
            <ArrowLeft className="h-4 w-4" /> Back
          </button>
          <h2 className="text-2xl font-bold text-[#0F1724] mb-1">Set up your workspace</h2>
          <p className="text-sm text-[#7A7974] mb-6">A couple of quick details and you're in.</p>
          <form onSubmit={submitStep2} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="team">Team / company name</Label>
              <Input id="team" required value={teamName} onChange={(e) => setTeamName(e.target.value)} placeholder="Northwind Events" />
              <p className="text-xs text-[#7A7974]">You can invite teammates later.</p>
            </div>
            <Button type="submit" className="w-full bg-[#1A6EFF] hover:bg-[#1A6EFF]/90 text-white">
              Continue
            </Button>
          </form>
        </div>
      );
    }

    // Step 3: plan
    return (
      <div>
        <button onClick={() => setSignupStep(2)} className="mb-4 inline-flex items-center gap-1 text-sm text-[#7A7974] hover:text-[#0F1724]">
          <ArrowLeft className="h-4 w-4" /> Back
        </button>
        <h2 className="text-2xl font-bold text-[#0F1724] mb-1">Choose your plan</h2>
        <p className="text-sm text-[#7A7974] mb-6">Start free for 14 days. Cancel anytime.</p>

        <div className="flex items-center justify-center gap-3 mb-6">
          <span className={cn("text-sm font-medium", !annual ? "text-[#0F1724]" : "text-[#7A7974]")}>Monthly</span>
          <button
            type="button"
            onClick={() => setAnnual((a) => !a)}
            className={cn("relative w-10 h-6 rounded-full transition-colors", annual ? "bg-[#1A6EFF]" : "bg-[#D4D1CA]")}
            aria-label="Toggle annual billing"
          >
            <span className={cn("absolute top-1 left-1 w-4 h-4 rounded-full bg-white transition-transform", annual && "translate-x-4")} />
          </button>
          <span className={cn("text-sm font-medium", annual ? "text-[#0F1724]" : "text-[#7A7974]")}>
            Annual <span className="text-[#1A6EFF] text-xs">(save ~20%)</span>
          </span>
        </div>

        <div className="space-y-3">
          {PLANS.map((p) => (
            <button
              type="button"
              key={p.key}
              onClick={() => setPlanChoice(p.key)}
              disabled={busy}
              className={cn(
                "w-full text-left rounded-xl border p-4 transition-all",
                planChoice === p.key
                  ? "border-[#1A6EFF] bg-[#1A6EFF]/5 ring-2 ring-[#1A6EFF]/30"
                  : p.recommended
                  ? "border-[#1A6EFF]/50 bg-[#1A6EFF]/5 hover:border-[#1A6EFF]"
                  : "border-[#D4D1CA] bg-white hover:border-[#1A6EFF]/50"
              )}
            >
              <div className="flex items-start justify-between gap-4 mb-2">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="text-base font-semibold text-[#0F1724]">{p.name}</h3>
                    {p.recommended && (
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#1A6EFF] text-white font-medium uppercase tracking-wide">
                        Popular
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#7A7974] mt-0.5">{p.description}</p>
                </div>
                <div className="text-right shrink-0">
                  <div className="text-base font-bold text-[#0F1724]">
                    {annual ? p.annualMonthly : p.monthly}
                  </div>
                  <div className="text-[10px] text-[#7A7974]">/month</div>
                </div>
              </div>
              <ul className="space-y-1">
                {p.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-xs text-[#0F1724]/80">
                    <Check className="h-3.5 w-3.5 text-[#1A6EFF] shrink-0" />
                    {f}
                  </li>
                ))}
              </ul>
            </button>
          ))}
        </div>

        <Button
          onClick={() => completeSignup(planChoice)}
          disabled={busy || !planChoice}
          className="mt-5 w-full bg-[#1A6EFF] hover:bg-[#1A6EFF]/90 text-white"
        >
          {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Create account & start trial
        </Button>
        <button
          type="button"
          onClick={() => completeSignup(null)}
          disabled={busy}
          className="mt-3 w-full text-sm text-[#7A7974] hover:text-[#0F1724] transition-colors"
        >
          Skip — choose a plan later
        </button>
      </div>
    );
  };

  if (!isSignup) {
    return <OnboardingLayout step={1}>{signinCard}</OnboardingLayout>;
  }

  return <OnboardingLayout step={signupSent ? 3 : signupStep}>{renderSignupStep()}</OnboardingLayout>;
};

export default Auth;
