import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Camera, ImagePlus, Share2, Sparkles } from "lucide-react";

const Index = () => {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && user) navigate("/projects", { replace: true });
  }, [user, loading, navigate]);

  return (
    <div className="min-h-screen bg-gradient-subtle">
      <header className="border-b bg-background/60 backdrop-blur">
        <div className="container flex h-14 items-center justify-between">
          <ReportAirLockup variant="light" />
          <div className="flex items-center gap-2">
            <Link to="/auth"><Button variant="ghost" size="sm">Sign in</Button></Link>
            <Link to="/auth"><Button size="sm">Get started</Button></Link>
          </div>
        </div>
      </header>

      <main>
        <section className="container py-20 md:py-28">
          <div className="mx-auto max-w-3xl text-center">
            <div className="mb-6 inline-flex items-center gap-2 rounded-full border bg-background px-3 py-1 text-xs font-medium text-muted-foreground">
              <Sparkles className="h-3 w-3 text-primary" />
              Built for creative & event teams
            </div>
            <h1 className="text-4xl font-semibold tracking-tight md:text-6xl">
              Project photos,<br />
              <span className="bg-gradient-primary bg-clip-text text-transparent">organised at last.</span>
            </h1>
            <p className="mx-auto mt-6 max-w-xl text-lg text-muted-foreground">
              Upload, structure, annotate, and share your project photography — without juggling Drive, Slack, and email.
            </p>
            <div className="mt-8 flex items-center justify-center gap-3">
              <Link to="/auth"><Button size="lg">Start free</Button></Link>
              <Button size="lg" variant="outline" asChild>
                <a href="#features">See how it works</a>
              </Button>
            </div>
          </div>
        </section>

        <section id="features" className="container pb-24">
          <div className="grid gap-6 md:grid-cols-3">
            <Feature icon={<ImagePlus className="h-5 w-5" />} title="Upload anything" desc="Bulk upload with EXIF auto-parsed. Photos land where they belong." />
            <Feature icon={<Sparkles className="h-5 w-5" />} title="AI captions & tags" desc="Editable captions on every shot, generated the moment you upload." />
            <Feature icon={<Share2 className="h-5 w-5" />} title="Share with clients" desc="Password-protected links or branded PDF exports — no extra seats required." />
          </div>
        </section>
      </main>
    </div>
  );
};

const Feature = ({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) => (
  <div className="rounded-xl border bg-card p-6 shadow-soft">
    <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
      {icon}
    </div>
    <h3 className="text-base font-semibold">{title}</h3>
    <p className="mt-1 text-sm text-muted-foreground">{desc}</p>
  </div>
);

export default Index;
