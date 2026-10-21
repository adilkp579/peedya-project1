# Peedya store

A static storefront and admin panel powered by [Supabase](https://supabase.com).
No build step, no framework: upload the folder to any static host.

```
peedya-project/
├── index.html              Storefront page (markup only)
├── sitemap.xml, llms.txt   SEO / AI-search files
├── robots.txt              Search engine rules (sitemap, AI crawlers)
├── assets/
│   ├── css/styles.css      Storefront styles
│   └── js/
│       ├── config.js       ← YOUR Supabase URL + anon key go here
│       ├── content.js      Editable reviews and FAQ text
│       └── app.js          Storefront logic (catalogue, cart, OTP checkout, profile)
├── adilwebkit/
│   ├── index.html          Admin panel (open /adilwebkit/)
│   ├── admin.css
│   └── admin.js            Products, categories, orders, customers
└── supabase/
    └── schema.sql          Database tables, security rules, image storage (no demo data)
```

The store starts **empty**. Only products you add in the admin appear on the site.

## Setup (once)

1. **Create a Supabase project** at supabase.com.
2. **Database:** Supabase → *SQL Editor* → paste all of `supabase/schema.sql` → *Run*.
3. **Admin user:** *Authentication → Users → Add user*. Use the email from `ADMIN_EMAIL`
   in `assets/js/config.js` (default `admin@webkit.store`), choose a strong password and tick
   *Auto Confirm User*. Then run the last statement of `schema.sql` again (it makes that user an admin).
   You log in at `/adilwebkit/` with username `admin` and that password.
4. **Customer OTP login:** *Authentication → Providers → Phone* → enable it and connect an SMS
   provider (for example Twilio). In India, SMS providers require DLT registration.
   While building, use *Test phone numbers* with fixed OTPs.
5. **Disable public email sign-ups:** *Authentication → Providers → Email → turn off "Allow new users to sign up"*
   (the admin user already exists).
6. **Keys:** *Project Settings → API*. Put the *Project URL* and *anon public* key into
   `assets/js/config.js`. Never put the `service_role` key in any file here.
7. **Deploy:** upload the folder to Netlify, Vercel, Cloudflare Pages or GitHub Pages
   (drag and drop works). Open `/adilwebkit/`, add categories and products. They appear on the store instantly.

## Day to day

| Task | Where |
| --- | --- |
| Add / edit / hide / delete products (up to 3 photos each), mark Featured or Best seller | Admin → Products |
| Add categories, choose which show as home page cards | Admin → Categories |
| Accept or reject new orders, update tracking | Admin → Dashboard / Orders |
| Up to 10 promo photos under the hero buttons, each opening a page you choose | Admin → Promo Banners |
| Slider under Featured Picks: up to 10 photos, each with its own text and a link to any page | Admin → Slider |
| Rename, add or delete the Explore Our Products tabs (Boys / Girls / Adults …) | Admin → Explore Tabs |
| Choose which products appear in Explore Our Products (tick "Show in Explore Our Products", or tap the Explore chip in the list) | Admin → Products |
| Change the order of Featured Picks, Shop by Category, Explore Our Products, Best Sellers and the Shop Now page (type position numbers) | Admin → Positions |
| Message a customer (they see it under the message icon in the header) | Admin → Messages |
| See subscribed mobile numbers, download as CSV | Admin → Subscribers |
| Edit reviews and FAQ text | `assets/js/content.js` |
| Footer contact details, About text | `index.html` |

## How it works

- Visitors read products and categories (only visible ones) directly from Supabase. Admin changes reach open pages live.
- Customers log in with a mobile OTP. Their profile and orders are tied to that account, so they see
  the same orders on any device.
- Order totals are calculated by the database from your current prices, not by the browser.
  New orders wait as *pending* until you accept them; tracking starts on acceptance.
- Row Level Security lets only the admin change products, categories and order status.
- The browser keeps only the cart and a cached copy of the last product list.

## Before going live

- Replace the placeholder reviews in `content.js` with real ones, or empty the list.
- Update the statistics shown on the page (hero badge, About numbers, product page trust strip),
  the footer contact details, and your return / delivery policy wording so they match reality.
- Add real Privacy Policy, Terms and Returns pages and link them in the footer.


## Sellers

1. **Re-run `supabase/schema.sql`** in Supabase > SQL Editor (safe to re-run).
2. Sellers use their own page at **`/seller/`** (separate from the store, like the admin page). It is not linked from the store.
3. A seller opens `/seller/` > **Create a seller account**, fills in the business details and picks an email + password. The application goes to **Admin > Sellers > Seller applications**.
4. Admin taps **Accept seller** (or **Reject** with a reason). After acceptance the seller logs in with email + password and gets the seller dashboard (Dashboard, Add Product, My Products, Orders, Payments, Settings).
5. Sellers add products (category from the admin's list, size type letters/numbers, colours, stock, description). Each product appears under **Admin > Sellers > Products waiting for approval**. **Approve & list in store** puts it live; **Reject** sends it back with a reason. Sellers cannot set ratings, featured/best seller or audience, or create categories.
6. Products with sizes or colours make customers pick them on the product page; the choice is saved on the order and shown to the seller. Stock goes down automatically on each order.

**Supabase setting:** Authentication > Providers > Email must be enabled. For instant sign-up turn **off** "Confirm email". If you keep it on, sellers get a confirmation email first and their application is sent when they log in after confirming.

## Payment options (new)
- Each product has **Cash on Delivery** and **UPI / Card** switches (the seller sets them when adding a product; admin products are Cash on Delivery only).
- Both on: the buyer picks either at checkout. Only UPI / Card on: checkout shows Cash on Delivery as *not available*, and the product page says so.
- If the cart mixes a COD-only item with an online-only item, checkout asks the buyer to order them separately.
- **UPI / Card uses Razorpay Standard Checkout with server-side verification** (see the Razorpay section below). The payment ID is saved on the order (`pay_ref`) and shown in **Admin > Orders**.


## Razorpay (UPI / Card) setup
The site is static, so the Razorpay secret lives in two Supabase Edge Functions (`supabase/functions/`):
- `create-order` works out the amount from the real product prices and creates the Razorpay order.
- `verify-payment` checks the signature (HMAC-SHA256 of `order_id|payment_id` with the key secret). Only a matching payment is saved, and the `orders` table accepts it once, for the same customer and the same amount.

Steps (one time):
1. Re-run `supabase/schema.sql` in the SQL Editor (adds the `payments` table and the order check).
2. Put your keys in `supabase/functions/.env` (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`; a template is in `.env.example`). This file is in `.gitignore`. **Do not upload it to your website host.**
3. With the Supabase CLI: `supabase link --project-ref <your-ref>`, then
   `supabase secrets set --env-file supabase/functions/.env`, then
   `supabase functions deploy create-order` and `supabase functions deploy verify-payment`.
4. Test: add a product with the **UPI / Card** switch on, put it in the cart, log in, choose **Pay now (UPI / Card)**. Test card: `4111 1111 1111 1111`, any future date, any CVV; or use the test UPI ID `success@razorpay`.
5. Going live: create live keys in the Razorpay dashboard, run step 2 and 3 again with the live keys.

## Security notes
- **Real protection is in the database.** `/adilwebkit/` and `/seller/` are public web pages that only show a login form. Everything private (orders, customers, payouts) is guarded by Row Level Security in `supabase/schema.sql`, so opening a URL or editing the page in the browser shows no data without a valid admin / seller login.
- Re-run `supabase/schema.sql` after every update (section 15 adds upload limits, size limits and an order rate limit).
- Every page has a Content-Security-Policy (no inline scripts allowed). If you use a custom Supabase domain, add it to `connect-src` in the `<meta http-equiv="Content-Security-Policy">` tag of each HTML file.
- `_headers`, `_redirects` and `vercel.json` add security headers and hide `/supabase/` and `README.md` on Netlify, Cloudflare Pages and Vercel. **Upload only the website files** (index.html, assets, adilwebkit, seller, privacy/terms, manifest) to your host; keep the `supabase/` folder and `.env` on your computer.
- In the Supabase dashboard: set sensible **rate limits** for Auth, use a long admin password and enable **MFA**, and keep "Confirm email" settings as you need.

## Customer login without OTP (temporary)
OTP is switched off for now. When a customer enters a 10-digit mobile number (at checkout or on the login screen) the site signs them in with a Supabase **anonymous account** and remembers the number on it. To make this work, open Supabase > **Authentication > Providers** and turn on **Anonymous sign-ins**.
- Nothing proves the number belongs to the customer yet, and a customer who clears their browser or logs out gets a fresh account (old orders are not shown again).
- To bring OTP back: set `OTP_ON=true` at the top of `assets/js/app.js` and enable the **Phone** provider in Supabase.
