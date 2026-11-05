# wa.m-eitan.co.il

A thin Vercel proxy in front of the `wa-mcp` Supabase Edge Function, so the connector URL in Claude is
`https://wa.m-eitan.co.il` and Claude shows the WA Reader icon (served here as `/favicon.ico`) instead of Supabase's.

- `/favicon.ico` → static file; `/icon.png` → proxied from GitHub Pages (`docs/icon.png`)
- `GET /` from a browser → `home.html` (redirects to the project site)
- everything else → `https://igmqqdexoqwulvknvrnj.supabase.co/functions/v1/wa-mcp/<path>?_via=wa`
  (`_via=wa` tells the function to advertise its OAuth URLs on this domain)

Nothing is stored or logged here; it's a pass-through rewrite. Deploy: Vercel project `wa-reader`, root directory `vercel/`.
