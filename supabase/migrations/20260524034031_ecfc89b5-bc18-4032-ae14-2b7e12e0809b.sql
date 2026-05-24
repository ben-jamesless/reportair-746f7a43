-- Restrict sensitive Stripe identifiers from client roles (edge functions use service role and are unaffected)
REVOKE SELECT (stripe_customer_id, stripe_subscription_id) ON public.teams FROM authenticated, anon;

-- Restrict invite tokens from client roles
REVOKE SELECT (token) ON public.project_invites FROM authenticated, anon;

-- Restrict share-link token and password_hash from client roles
REVOKE SELECT (token, password_hash) ON public.share_links FROM authenticated, anon;