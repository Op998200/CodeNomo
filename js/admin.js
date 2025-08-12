import { supabase, requireAdmin, toast, formatINR } from './supabase.js';

export async function initAdmin() {
  const user = await requireAdmin('/index.html');
  if (!user) return;
  await Promise.all([loadUsers(), loadTransactions()]);
  wireAdminActions();
  const search = document.getElementById('user-search');
  if (search) {
    let t;
    search.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(() => loadUsers(search.value.trim()), 300);
    });
  }
}

async function loadUsers(search = '') {
  let q = supabase.from('profiles').select('id, full_name, email, role, status, created_at').order('created_at', { ascending: false });
  if (search) q = q.ilike('email', `%${search}%`);
  const { data, error } = await q;
  if (error) { toast(error.message, 'error'); return; }
  const container = document.getElementById('admin-users');
  container.innerHTML = data.map(u => `
    <tr>
      <td class="px-3 py-2 text-sm">${u.full_name || '-'}</td>
      <td class="px-3 py-2 text-sm">${u.email}</td>
      <td class="px-3 py-2 text-sm">${u.role}</td>
      <td class="px-3 py-2 text-sm">${u.status}</td>
      <td class="px-3 py-2 text-sm">
        <button data-id="${u.id}" data-action="make-admin" class="text-blue-600">Make Admin</button>
        <button data-id="${u.id}" data-action="suspend" class="text-amber-600 ml-2">${u.status === 'active' ? 'Suspend' : 'Activate'}</button>
        <button data-id="${u.id}" data-action="delete-user" class="text-red-600 ml-2">Delete</button>
      </td>
    </tr>
  `).join('');
}

async function loadTransactions() {
  const { data, error } = await supabase
    .from('transactions')
    .select('id, owner_id, title, amount, type, date, created_at')
    .order('created_at', { ascending: false })
    .limit(100);
  if (error) { toast(error.message, 'error'); return; }
  const container = document.getElementById('admin-transactions');
  container.innerHTML = data.map(t => `
    <tr>
      <td class="px-3 py-2 text-sm">${t.id}</td>
      <td class="px-3 py-2 text-sm">${t.owner_id}</td>
      <td class="px-3 py-2 text-sm">${t.title}</td>
      <td class="px-3 py-2 text-sm">${t.type}</td>
      <td class="px-3 py-2 text-sm">${formatINR(t.amount)}</td>
      <td class="px-3 py-2 text-sm">${t.date}</td>
    </tr>
  `).join('');
}

function wireAdminActions() {
  const container = document.getElementById('admin-users');
  container?.addEventListener('click', async (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;
    const id = btn.getAttribute('data-id');
    const action = btn.getAttribute('data-action');
    try {
      if (action === 'make-admin') {
        await supabase.from('profiles').update({ role: 'admin' }).eq('id', id);
        toast('Role updated', 'success');
      } else if (action === 'suspend') {
        const { data } = await supabase.from('profiles').select('status').eq('id', id).single();
        const next = data.status === 'active' ? 'suspended' : 'active';
        await supabase.from('profiles').update({ status: next }).eq('id', id);
        toast('Status updated', 'success');
      } else if (action === 'delete-user') {
        await supabase.from('profiles').delete().eq('id', id);
        toast('User deleted (profile row). Consider deleting auth user via Admin UI).', 'success');
      }
      await loadUsers();
    } catch (err) {
      toast(err.message, 'error');
    }
  });

  const exportBtn = document.getElementById('export-all-csv');
  exportBtn?.addEventListener('click', async () => {
    const { data, error } = await supabase.from('transactions').select('*').limit(10000);
    if (error) return toast(error.message, 'error');
    const csv = Papa.unparse(data);
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'cashivo-all-transactions.csv'; a.click(); URL.revokeObjectURL(url);
  });
}