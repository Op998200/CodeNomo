import { supabase, toast } from './supabase.js';

export async function signUp({ email, password, full_name }) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${window.location.origin}/dashboard.html`,
      data: { full_name }
    }
  });
  if (error) throw error;
  await ensureProfile();
  return data;
}

export async function signIn({ email, password }) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) throw error;
  try { await ensureProfile(); } catch (_) {}
  return data;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

export async function resetPassword(email) {
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/profile.html#password-updated`
  });
  if (error) throw error;
  return data;
}

export async function getProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase.from('profiles').select('*').eq('id', user.id).maybeSingle();
  if (error) throw error;
  return data;
}

export async function updateProfile({ full_name, avatar_url, email }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Not authenticated');
  const updates = { id: user.id, full_name, avatar_url };
  if (email && email !== user.email) {
    const { error: emailErr } = await supabase.auth.updateUser({ email });
    if (emailErr) throw emailErr;
    updates.email = email;
  }
  const { data, error } = await supabase.from('profiles').upsert(updates).select().single();
  if (error) throw error;
  return data;
}

async function ensureProfile() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { data: existing } = await supabase.from('profiles').select('id').eq('id', user.id).maybeSingle();
  if (!existing) {
    await supabase.from('profiles').insert({ id: user.id, email: user.email, full_name: user.user_metadata?.full_name || '', role: 'user' });
  }
}

// Wire default forms if present
export function wireAuthForms() {
  const loginForm = document.getElementById('login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = new FormData(loginForm);
      try {
        await signIn({ email: form.get('email'), password: form.get('password') });
        toast('Logged in!', 'success');
        window.location.href = '/dashboard.html';
      } catch (err) {
        toast(err.message || 'Login failed', 'error');
      }
    });
  }

  const signupForm = document.getElementById('signup-form');
  if (signupForm) {
    signupForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const form = new FormData(signupForm);
      try {
        await signUp({ email: form.get('email'), password: form.get('password'), full_name: form.get('full_name') });
        toast('Signup successful. Please verify your email.', 'success');
      } catch (err) {
        toast(err.message || 'Signup failed', 'error');
      }
    });
  }

  const resetForm = document.getElementById('reset-form');
  if (resetForm) {
    resetForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = new FormData(resetForm).get('email');
      try {
        await resetPassword(email);
        toast('Reset email sent', 'success');
      } catch (err) {
        toast(err.message || 'Reset failed', 'error');
      }
    });
  }

  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      try {
        await signOut();
        window.location.href = '/index.html';
      } catch (err) {
        toast(err.message || 'Error logging out', 'error');
      }
    });
  }
}