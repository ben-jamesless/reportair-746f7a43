# Make BuildSlides crawlable by AI bots

## Diagnosis

The site **is** public (`publish_visibility: public`, robots.txt allows `/`). The actual problem is that BuildSlides is a client-rendered React SPA. The HTML served at `https://www.buildslides.com/` is essentially:

```html
<head>...meta tags...</head>
<body>
  <div id="root"></div>
  <script type="module" src="/src/main.tsx"></script>
</body>
```

Googlebot executes JS so it sees the rendered marketing page. **Perplexity, ChatGPT's browser, Claude's fetcher, and most LLM crawlers do NOT execute JS** — they see an empty body and report "not publicly accessible / behind a login wall."

Lovable hosting doesn't support SSR, so the fix is to ship static, human/bot-readable marketing content directly inside `index.html`. Real users still get the React app (it mounts into `#root` and takes over the page); bots get real content to index.

## What to build

Update `index.html` to include a `<noscript>`-style marketing fallback inside `<body>` that is rendered server-side as static HTML. React will replace `#root`'s contents on mount, so users never see it; crawlers do.

### Content to inline (sourced from existing marketing components)

Pull copy from `src/components/marketing/` (`HeroSection`, `UseCasesSection`, `HowItWorksSection`, `PricingSection`, `FAQSection`) and flatten it into a single static block:

1. **H1** + subheadline (hero)
2. **Who it's for** (use cases: event-build crews, activations, exhibitions, conferences)
3. **How it works** (3–4 steps, plain text)
4. **Pricing tiers** (names, prices, key bullets)
5. **FAQ** (questions + short answers — high value for LLM grounding)
6. **Footer links** (pricing, sign in, contact, legal) as plain `<a>` tags so crawlers discover routes

### Structure

```text
<body>
  <div id="root">
    <!-- Static crawlable marketing content -->
    <header>...logo + nav links...</header>
    <main>
      <section><h1>...</h1><p>...</p></section>
      <section><h2>Who it's for</h2>...</section>
      <section><h2>How it works</h2>...</section>
      <section><h2>Pricing</h2>...</section>
      <section><h2>FAQ</h2>...</section>
    </main>
    <footer>...</footer>
  </div>
  <script type="module" src="/src/main.tsx"></script>
</body>
```

React's `createRoot(...).render(<App />)` clears `#root` before mounting, so end users never see the static block — only a brief flash at worst (mitigated by it being above-the-fold-shaped and styled minimally / hidden via a quick inline CSS rule like `#root > .static-fallback { display: none }` toggled by an inline script once JS runs; or simpler: rely on React's mount to replace it).

### Files

- `index.html` — add the static marketing block inside `#root`, plus a small `<style>` for readable typography (no Tailwind available here — use a tiny inline stylesheet).

### Verification

1. After deploy, run `curl -s https://www.buildslides.com/ | grep -i "report in 10 minutes"` — should return the H1 text.
2. Ask Perplexity to re-analyze `www.buildslides.com` and confirm it now reads the content.
3. Load the site in a normal browser — confirm the React app still renders identically (the static block should be replaced on mount, no visible flash beyond initial paint).
4. Lighthouse / view-source to confirm no layout regressions.

### Out of scope

- Per-route prerendering (pricing page, etc.). The homepage carries 90% of the value for LLM grounding. We can extend later if needed.
- Switching frameworks or adding SSR.

## Confirm before I build

- OK to inline the marketing copy (hero, use cases, how-it-works, pricing, FAQ) from the existing components into `index.html`? I'll keep the copy verbatim so it matches the rendered site.
- Any pages besides `/` you want crawlable in this pass? (e.g. `/pricing` if it has a dedicated route — I'll check, but I don't think it does.)
