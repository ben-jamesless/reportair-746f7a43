import { useState } from "react";
import AdminEarlyAccess from "./AdminEarlyAccess";
import AdminLeadMagnet from "./AdminLeadMagnet";
import { Button } from "@/components/ui/button";

/** Access requests first; the old marketing PDF signups tucked away below. */
export default function AdminRequests() {
  const [showMarketing, setShowMarketing] = useState(false);
  return (
    <div className="space-y-8">
      <AdminEarlyAccess />
      <div className="space-y-4 border-t border-border pt-4">
        <Button variant="link" className="px-0 text-muted-foreground" onClick={() => setShowMarketing((v) => !v)}>
          {showMarketing ? "Hide marketing signups" : "Show marketing signups"}
        </Button>
        {showMarketing && <AdminLeadMagnet />}
      </div>
    </div>
  );
}
