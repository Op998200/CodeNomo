import { supabase, toast } from './supabase.js';

const RAZORPAY_KEY_ID = 'rzp_test_kRHtTWCOZrDvog'; // Replace in production

export async function addFunds(amount) {
  if (!amount || Number(amount) <= 0) {
    toast('Enter a valid amount', 'error');
    return;
  }
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase.functions.invoke('razorpay_create_order', {
      body: { owner_id: user.id, amount: Number(amount), currency: 'INR', metadata: { reason: 'wallet_topup' } }
    });
    if (error) throw error;

    const { order_id, amount_paise, currency } = data;

    const options = {
      key: RAZORPAY_KEY_ID,
      amount: amount_paise,
      currency,
      name: 'Cashivo Wallet',
      description: 'Add funds to wallet',
      order_id,
      handler: async function (response) {
        // Optionally record provisional success; webhook will finalize
        try {
          await supabase.from('payments').update({ razorpay_payment_id: response.razorpay_payment_id }).eq('razorpay_order_id', order_id);
        } catch (_e) {}
        toast('Payment initiated. We will confirm shortly.', 'success');
        window.location.href = '/dashboard.html';
      },
      prefill: {
        email: user.email
      },
      theme: { color: '#0ea5e9' }
    };

    const rzp = new Razorpay(options);
    rzp.on('payment.failed', function (resp) {
      toast(resp.error?.description || 'Payment failed', 'error');
    });
    rzp.open();
  } catch (e) {
    toast(e.message || 'Failed to create order', 'error');
  }
}

export function wirePaymentForm() {
  const form = document.getElementById('add-funds-form');
  if (!form) return;
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const amount = Number(new FormData(form).get('amount'));
    await addFunds(amount);
  });
}