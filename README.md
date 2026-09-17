# Laholm Combat Sports

Produktionsfiler för Laholm Combat Sports webbplats och medlemsportal.

## Publicera med GitHub Pages

1. Ladda upp innehållet i den här mappen till roten av ett GitHub-repository.
2. Öppna **Settings → Pages** i GitHub.
3. Välj **Deploy from a branch**, välj `main` och mappen `/(root)`.
4. Webbplatsens produktionsadress är
   `https://www.laholmcombatsports.com`.

Alla webbplatslänkar är relativa och fungerar därför även när sidan ligger under
ett reponamn. Filen `.nojekyll` säkerställer att GitHub serverar innehållet som en
vanlig statisk webbplats.

## Konfigurera Supabase efter publicering

Använd den egna domänen i Supabase:

- Edge Function-hemligheten `SITE_URL` ska vara
  `https://www.laholmcombatsports.com`.
- Edge Function-hemligheten `ALLOWED_ORIGINS` ska innehålla
  `https://www.laholmcombatsports.com,https://laholmcombatsports.com,https://fiddelish.github.io`.
- Auth **Site URL** ska vara `https://www.laholmcombatsports.com`.
- Lägg till `https://www.laholmcombatsports.com/**` och
  `https://laholmcombatsports.com/**` under Auth Redirect URLs.

Supabase används för Auth och databas. Stripe Checkout anropas genom den redan
publicerade Edge Functionen `stripe-payments`. Stripe-hemligheter och Supabase
service-role-nyckeln ska endast finnas i Supabase och får aldrig läggas i repot.

Stripe-webhooken måste också vara skapad och dess signing secret (`whsec_...`)
sparad som en Supabase-hemlighet innan betalningsstatus kan uppdateras automatiskt.

## Innehåll

- Publik startsida, medlemsansökan och prova-på-formulär
- Login, lösenordsåterställning och medlemsdashboard
- Adminpanel
- Integritetspolicy och medlemsvillkor
- Bilder och klubbens styling

Produktionsschema och Edge Function-källkod ingår inte i publiceringsmappen och
hanteras separat i Supabase.
