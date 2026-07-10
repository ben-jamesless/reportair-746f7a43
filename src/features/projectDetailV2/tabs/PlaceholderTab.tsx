import { Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

interface Props {
  projectId: string;
  title: string;
  description: string;
}

/**
 * Phase 0 placeholder. Each tab shows a card explaining what's coming and
 * offers a one-click escape hatch back to the classic shell (via `?classic=1`,
 * which the router honours without touching the beta flag).
 */
export function PlaceholderTab({ projectId, title, description }: Props) {
  return (
    <div className="mx-auto w-full max-w-2xl py-10">
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <Button asChild variant="outline" size="sm">
            <Link to={`/projects/${projectId}?classic=1`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Open classic view
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
