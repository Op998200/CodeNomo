import { supabase, toast, formatINR } from './supabase.js';
import { uploadImage, deleteImage } from './storage.js';

const PAGE_SIZE = 20;

export const AutoCategoryRules = [
  { keyword: 'salary', type: 'income', category: 'Salary' },
  { keyword: 'interest', type: 'income', category: 'Interest' },
  { keyword: 'rent', type: 'expense', category: 'Rent' },
  { keyword: 'grocery', type: 'expense', category: 'Groceries' },
  { keyword: 'uber', type: 'expense', category: 'Transport' },
  { keyword: 'swiggy', type: 'expense', category: 'Food' },
  { keyword: 'zomato', type: 'expense', category: 'Food' },
  { keyword: 'electricity', type: 'expense', category: 'Utilities' },
  { keyword: 'recharge', type: 'expense', category: 'Utilities' },
  { keyword: 'wallet', type: 'income', category: 'Wallet Top-up' }
];

export async function listCategories() {
  const { data, error } = await supabase
    .from('categories')
    .select('*')
    .or('owner_id.is.null,owner_id.eq.' + (await supabase.auth.getUser()).data.user.id)
    .order('name');
  if (error) throw error;
  return data;
}

export function autoCategorize({ title = '', notes = '' }) {
  const text = `${title} ${notes}`.toLowerCase();
  for (const rule of AutoCategoryRules) {
    if (text.includes(rule.keyword)) return rule;
  }
  return null;
}

export async function createTransaction({ title, amount, type, category_id, date, payment_method, image_file, notes }) {
  try {
    let image_url = null;
    if (image_file) image_url = await uploadImage(image_file);
    const { data: { user } } = await supabase.auth.getUser();
    const payload = { owner_id: user.id, title, amount: Number(amount), type, category_id, date, payment_method, image_url, notes, comments: [] };
    const { data, error } = await supabase.from('transactions').insert(payload).select().single();
    if (error) throw error;
    toast('Transaction added', 'success');
    return data;
  } catch (e) {
    toast(e.message || 'Failed to add', 'error');
    throw e;
  }
}

export async function updateTransaction(id, updates) {
  if (updates.image_file) {
    updates.image_url = await uploadImage(updates.image_file);
    delete updates.image_file;
  }
  updates.updated_at = new Date().toISOString();
  const { data, error } = await supabase.from('transactions').update(updates).eq('id', id).select().single();
  if (error) throw error;
  toast('Transaction updated', 'success');
  return data;
}

export async function deleteTransaction(id) {
  const { error } = await supabase.from('transactions').delete().eq('id', id);
  if (error) throw error;
  toast('Transaction deleted', 'success');
}

export async function addCommentToTransaction(id, comment) {
  const { data: tx, error: fetchErr } = await supabase.from('transactions').select('comments').eq('id', id).single();
  if (fetchErr) throw fetchErr;
  const comments = Array.isArray(tx.comments) ? tx.comments : [];
  comments.push({ id: crypto.randomUUID(), text: comment, at: new Date().toISOString() });
  const { data, error } = await supabase.from('transactions').update({ comments }).eq('id', id).select().single();
  if (error) throw error;
  return data;
}

export async function fetchTransactions({ from, to, category_id, type, search, page = 0 }) {
  let query = supabase.from('transactions').select('*').order('date', { ascending: false }).order('created_at', { ascending: false });
  if (from) query = query.gte('date', from);
  if (to) query = query.lte('date', to);
  if (category_id) query = query.eq('category_id', category_id);
  if (type) query = query.eq('type', type);
  if (search) query = query.ilike('title', `%${search}%`);
  const fromIdx = page * PAGE_SIZE;
  const toIdx = fromIdx + PAGE_SIZE - 1;
  const { data, error } = await query.range(fromIdx, toIdx);
  if (error) throw error;
  return data;
}

export async function computeSummary({ from, to }) {
  let q = supabase.from('transactions').select('amount,type');
  if (from) q = q.gte('date', from);
  if (to) q = q.lte('date', to);
  const { data, error } = await q;
  if (error) throw error;
  const totals = data.reduce((acc, t) => {
    if (t.type === 'income') acc.income += Number(t.amount);
    else acc.expense += Number(t.amount);
    return acc;
  }, { income: 0, expense: 0 });
  return { ...totals, balance: totals.income - totals.expense };
}

export function renderTransactionRow(t) {
  const amountClass = t.type === 'income' ? 'text-green-600' : 'text-red-600';
  return `
  <div class="flex items-center justify-between border-b py-3">
    <div>
      <div class="font-medium">${t.title}</div>
      <div class="text-xs text-gray-500">${t.date} • ${t.payment_method || '-'}${t.category_name ? ' • ' + t.category_name : ''}</div>
    </div>
    <div class="${amountClass}">${formatINR(t.amount)}</div>
  </div>`;
}

export async function exportCsv(transactions) {
  const rows = transactions.map(t => ({
    id: t.id,
    date: t.date,
    type: t.type,
    title: t.title,
    amount: t.amount,
    category_id: t.category_id,
    payment_method: t.payment_method,
    notes: t.notes || ''
  }));
  const csv = Papa.unparse(rows);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `cashivo-transactions-${new Date().toISOString().slice(0,10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}