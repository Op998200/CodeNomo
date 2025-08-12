# Cashivo — Income & Expense Tracker (Supabase + Vanilla JS)

Cashivo is a production-ready web app using only HTML5, Vanilla JS, Tailwind CSS (CDN), Supabase (Auth, DB, Storage, Edge Functions) and Razorpay for payments.

## Tech
- Frontend: HTML, Vanilla JS (ES modules), Tailwind (CDN), Chart.js, day.js, PapaParse
- Backend: Supabase (Auth, Postgres, Storage, Edge Functions)
- Payments: Razorpay Checkout (test key client-side; secret server-side)

## Supabase Setup
1. Create a Supabase project.
2. Run SQL schema in `sql/schema.sql` (SQL Editor).
3. Create a Storage bucket named `images` (public).
4. Auth settings: enable email/password. Optionally enable Google OAuth.
5. Set site URL to your deployed domain for auth redirects.

## Edge Functions
Create two functions and set secrets.

- `edge_functions/razorpay_create_order.js`
- `edge_functions/razorpay_webhook.js`

Deploy (from Supabase CLI or Dashboard):
```bash
supabase functions deploy razorpay_create_order
supabase functions deploy razorpay_webhook
```

Set secrets:
```bash
supabase secrets set \
  SUPABASE_URL=YOUR_SUPABASE_URL \
  SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY \
  RAZORPAY_KEY_ID=YOUR_RAZORPAY_KEY_ID \
  RAZORPAY_SECRET=YOUR_RAZORPAY_SECRET \
  RAZORPAY_WEBHOOK_SECRET=YOUR_RAZORPAY_WEBHOOK_SECRET
```

IMPORTANT: Do not expose service role or Razorpay secrets on the client.

## Frontend Config
Edit `js/supabase.js` to set:
- `SUPABASE_URL` and `SUPABASE_PUBLIC_ANON_KEY` (OK to be public)

Razorpay client key is used in `js/payment.js` (test key provided). Replace for production.

## Running Locally
Serve `/workspace` directory with any static server (CORS allowed to Supabase):
```bash
python3 -m http.server 5173 --directory /workspace
# or
npx serve /workspace -l 5173
```
Open `http://localhost:5173`.

## Pages
- `index.html` — login/signup/reset
- `dashboard.html` — charts, filters, list, export CSV
- `add-transaction.html` — add new transaction
- `payment.html` — add funds via Razorpay
- `admin.html` — admin tools
- `profile.html` — update profile

## Webhooks
Create a Razorpay webhook pointing to:
- `https://<your-project-ref>.functions.supabase.co/razorpay_webhook`
Events: `order.paid`, `payment.captured`, `payment.failed`.
Use the webhook secret set in function secrets.

## Security Notes
- Use RLS policies in `sql/schema.sql` (owners-only access; admin exceptions).
- Serve over HTTPS and set strict CSP (example added in `index.html`).
- Never expose `RAZORPAY_SECRET` or service role keys.

## Testing Payments
- Use Razorpay test mode and test key.
- Use test cards/UPI from Razorpay docs.
- Confirm that webhook updates `payments` to `captured` and inserts a `Wallet Top-up` transaction.

## Production
- Replace all placeholders with your secrets.
- Consider building Tailwind to a static CSS for performance (optional).
- Configure a custom domain and set Supabase Auth site URL.

## License
MIT