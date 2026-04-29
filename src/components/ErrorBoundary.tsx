import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

interface Props {
  children: ReactNode;
  /** Friendly label for the area that failed (e.g. "uploader", "lightbox") */
  label?: string;
  /** Optional custom fallback render */
  fallback?: (error: Error, reset: () => void) => ReactNode;
}

interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // Surface in console for dev/inspection. No analytics in this project.
    console.error(`[ErrorBoundary${this.props.label ? `:${this.props.label}` : ""}]`, error, info);
  }

  reset = () => this.setState({ error: null });

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;
    if (this.props.fallback) return this.props.fallback(error, this.reset);

    return (
      <div className="flex flex-col items-center gap-3 rounded-md border border-destructive/30 bg-destructive/5 p-6 text-center">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/15 text-destructive">
          <AlertTriangle className="h-5 w-5" />
        </div>
        <div>
          <p className="text-sm font-semibold">
            Something went wrong{this.props.label ? ` with the ${this.props.label}` : ""}.
          </p>
          <p className="mt-1 text-xs text-muted-foreground">{error.message || "An unexpected error occurred."}</p>
        </div>
        <Button size="sm" variant="outline" onClick={this.reset}>
          <RotateCcw className="mr-1 h-3.5 w-3.5" /> Try again
        </Button>
      </div>
    );
  }
}
