# Local Multi-Competition Testing

## Quick Start (single host)

The hub page and comp switching work on a single `localhost` since all
routes are served by the same Next.js app. No `/etc/hosts` edits needed
for basic testing.

1. Run `npm run dev`
2. Sign in at `http://localhost:3000/login`
3. Visit `http://localhost:3000/hub` to see your competitions
4. Click a card — the `/api/hub/switch` route sets `last-comp` and
   redirects to `/tips`

## Testing subdomain resolution

Middleware maps hostnames to competitions. To test locally:

```
# /etc/hosts
127.0.0.1  taranaki
127.0.0.1  bridlington
127.0.0.1  waikato
```

These bare hostnames are already in `HOST_TO_COMPETITION_ID` in
`src/middleware.ts` (the `taranaki` and `bridlington` entries). Add
`waikato` if needed.

Then visit `http://taranaki:3000` or `http://bridlington:3000`.

## Cookie sharing

Cross-subdomain cookie sharing (`.clubrugbytipping.com`) only works in
production. Locally, each bare hostname gets its own cookies. This means:

- Auth sessions are per-host in local dev
- The `last-comp` cookie set on one host is invisible to another

This is fine for testing the hub page itself. To test actual
cross-subdomain login sharing, deploy to a preview branch on Vercel and
use the real subdomains.

## What to verify

- [ ] Logged-in user with 2+ comps at root → redirects to `/hub`
- [ ] Logged-in user with 1 comp (NPC) at root → shows NPC homepage
- [ ] Logged-in user with 1 non-NPC comp at root → redirects to comp site
- [ ] Hub cards show correct accent colour, logo, deadline, tip status
- [ ] Clicking a hub card sets `last-comp` cookie and lands on `/tips`
- [ ] After choosing a comp, revisiting root skips hub (uses `last-comp`)
- [ ] "Switch Comp" link appears in navbar for users in 2+ comps
- [ ] Joining from hub refreshes the page and shows the new card
- [ ] 0 joined comps → "Available Competitions" section with join buttons
