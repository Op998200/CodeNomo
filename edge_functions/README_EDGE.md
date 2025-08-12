# Supabase Edge Functions for Cashivo

## Deploy
```
supabase functions deploy razorpay_create_order
supabase functions deploy razorpay_webhook
```

## Secrets
```
supabase secrets set \
  SUPABASE_URL=YOUR_SUPABASE_URL \
  SUPABASE_SERVICE_ROLE_KEY=YOUR_SERVICE_ROLE_KEY \
  RAZORPAY_KEY_ID=rzp_test_kRHtTWCOZrDvog \
  RAZORPAY_SECRET=YOUR_RAZORPAY_SECRET \
  RAZORPAY_WEBHOOK_SECRET=YOUR_RAZORPAY_WEBHOOK_SECRET
```

## Test Create Order
```
curl -X POST \
  -H "Authorization: Bearer <USER_JWT>" \
  -H "Content-Type: application/json" \
  -d '{"owner_id": "<auth.uid>", "amount": 99, "currency": "INR"}' \
  https://<project-ref>.functions.supabase.co/razorpay_create_order
```

## Webhook URL
Set in Razorpay dashboard:
- `https://<project-ref>.functions.supabase.co/razorpay_webhook`