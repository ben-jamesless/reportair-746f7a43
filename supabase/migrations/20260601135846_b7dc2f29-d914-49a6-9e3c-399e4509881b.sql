-- Revoke column-level SELECT on sensitive columns from client roles.
-- These columns must only be accessible via SECURITY DEFINER RPCs or service_role.

REVOKE SELECT (token) ON public.project_invites FROM anon, authenticated;
REVOKE SELECT (password_hash) ON public.share_links FROM anon, authenticated;
REVOKE SELECT (stripe_customer_id, stripe_subscription_id) ON public.teams FROM anon, authenticated;
