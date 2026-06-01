import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { pageview } from "@/lib/analytics";

/** Fires a GA4 pageview on every client-side route change. No-op when
 * consent has not been granted or in non-production builds. */
export function RouteAnalytics() {
  const location = useLocation();
  useEffect(() => {
    pageview(location.pathname + location.search);
  }, [location.pathname, location.search]);
  return null;
}
