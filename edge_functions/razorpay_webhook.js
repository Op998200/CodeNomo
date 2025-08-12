// Deno / Supabase Edge Function: razorpay_webhook
// Endpoint: /functions/v1/razorpay_webhook
// Secrets: RAZORPAY_WEBHOOK_SECRET, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.1';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const WEBHOOK_SECRET = Deno.env.get('RAZORPAY_WEBHOOK_SECRET');

async function verifySignature(rawBody, signature) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(WEBHOOK_SECRET),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const mac = await crypto.subtle.sign('HMAC', key, enc.encode(rawBody));
  const digest = Array.from(new Uint8Array(mac)).map((b) => b.toString(16).padStart(2, '0')).join('');
  return digest === signature;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });
  const signature = req.headers.get('x-razorpay-signature') || req.headers.get('X-Razorpay-Signature');
  const rawBody = await req.text();

  try {
    if (!signature) throw new Error('Missing signature');
    const valid = await verifySignature(rawBody, signature);
    if (!valid) throw new Error('Invalid signature');

    const payload = JSON.parse(rawBody);
    const event = payload.event || '';

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Extract payment/order info
    let orderId = payload?.payload?.order?.entity?.id || payload?.payload?.payment?.entity?.order_id;
    let paymentId = payload?.payload?.payment?.entity?.id;
    let amount = (payload?.payload?.payment?.entity?.amount || 0) / 100.0;
    let currency = payload?.payload?.payment?.entity?.currency || 'INR';

    if (!orderId) throw new Error('Missing order id');

    if (event === 'order.paid' || event === 'payment.captured') {
      // Update payment record
      const { data: pay, error: payErr } = await supabase
        .from('payments')
        .update({ status: 'captured', razorpay_payment_id: paymentId })
        .eq('razorpay_order_id', orderId)
        .select('*')
        .single();
      if (payErr) throw payErr;

      // Create a wallet top-up transaction for the user
      const { data: cat } = await supabase
        .from('categories')
        .select('id')
        .eq('name', 'Wallet Top-up')
        .eq('type', 'income')
        .is('owner_id', null)
        .single();

      await supabase.from('transactions').insert({
        owner_id: pay.owner_id,
        type: 'income',
        title: 'Wallet Top-up',
        amount: pay.amount || amount,
        category_id: cat?.id || null,
        date: new Date().toISOString().slice(0,10),
        payment_method: 'Razorpay',
        notes: `Razorpay payment ${paymentId}`
      });

      await supabase.from('audit_logs').insert({
        owner_id: pay.owner_id,
        action: 'payment_captured',
        meta: { orderId, paymentId, amount, currency }
      });
    } else if (event === 'payment.failed') {
      await supabase.from('payments').update({ status: 'failed' }).eq('razorpay_order_id', orderId);
    }

    return new Response('OK', { status: 200 });
  } catch (e) {
    return new Response(e.message, { status: 400 });
  }
});