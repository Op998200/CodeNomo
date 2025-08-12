// Deno Deploy / Supabase Edge Function: razorpay_create_order
// Endpoint: /functions/v1/razorpay_create_order
// Secrets required: RAZORPAY_KEY_ID (optional), RAZORPAY_SECRET

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.1';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const RAZORPAY_KEY_ID = Deno.env.get('RAZORPAY_KEY_ID');
const RAZORPAY_SECRET = Deno.env.get('RAZORPAY_SECRET');

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405 });

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    global: { headers: { Authorization: req.headers.get('Authorization') || '' } }
  });

  try {
    const body = await req.json();
    const amount = Number(body.amount);
    const currency = body.currency || 'INR';
    if (!amount || amount <= 0) throw new Error('Invalid amount');

    // Verify user
    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) throw new Error('Unauthorized');
    const owner_id = body.owner_id && body.owner_id === user.id ? body.owner_id : user.id;

    // Create Razorpay order (amount in paise)
    const orderResp = await fetch('https://api.razorpay.com/v1/orders', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + btoa(`${RAZORPAY_KEY_ID}:${RAZORPAY_SECRET}`)
      },
      body: JSON.stringify({
        amount: Math.round(amount * 100),
        currency,
        receipt: `cashivo_${owner_id}_${Date.now()}`,
        notes: body.metadata || {}
      })
    });

    if (!orderResp.ok) {
      const errJson = await orderResp.text();
      throw new Error(`Razorpay error: ${errJson}`);
    }
    const order = await orderResp.json();

    // Insert payment row
    const { error: payErr } = await supabase.from('payments').insert({
      owner_id,
      amount,
      currency,
      status: 'created',
      razorpay_order_id: order.id
    });
    if (payErr) throw payErr;

    return new Response(JSON.stringify({ order_id: order.id, amount_paise: order.amount, currency: order.currency }), {
      headers: { 'Content-Type': 'application/json' }
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }
});