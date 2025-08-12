import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.1';

export const SUPABASE_URL = 'https://bgdtmceusndgtscnqxwk.supabase.co';
export const SUPABASE_PUBLIC_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJnZHRtY2V1c25kZ3RzY25xeHdrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MjMwNjg0NTIsImV4cCI6MjAzODY0NDQ1Mn0.H-f4gW25kJ1m-4WcQeyN4qNQyoM2hWbG95A2AHzEVxY';

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLIC_ANON_KEY, {
  auth: {
    persistSession: true,
    detectSessionInUrl: true
  }
});

export async function getCurrentUser() {
  const { data } = await supabase.auth.getUser();
  return data?.user ?? null;
}

export async function requireAuth(redirectTo = '/index.html') {
  const user = await getCurrentUser();
  if (!user) {
    window.location.href = redirectTo;
    return null;
  }
  return user;
}

export async function requireAdmin(redirectTo = '/dashboard.html') {
  const user = await requireAuth();
  if (!user) return null;
  const { data, error } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  if (error || !data || data.role !== 'admin') {
    window.location.href = redirectTo;
    return null;
  }
  return user;
}

export function onAuthChanged(callback) {
  return supabase.auth.onAuthStateChange((_event, session) => callback(session));
}

export function toast(message, type = 'info') {
  const id = `toast-${Date.now()}`;
  const el = document.createElement('div');
  el.id = id;
  el.className = `fixed right-4 top-4 z-50 rounded-md px-4 py-2 shadow text-sm ${
    type === 'success' ? 'bg-green-600 text-white' : type === 'error' ? 'bg-red-600 text-white' : 'bg-gray-800 text-white'
  }`;
  el.textContent = message;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

export function formatINR(amount) {
  try {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(Number(amount || 0));
  } catch (e) {
    return `₹${Number(amount || 0).toFixed(2)}`;
  }
}

export function saveThemePreference(theme) {
  localStorage.setItem('theme', theme);
  document.documentElement.classList.toggle('dark', theme === 'dark');
}

export function initTheme() {
  const saved = localStorage.getItem('theme');
  const prefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  const theme = saved || (prefersDark ? 'dark' : 'light');
  document.documentElement.classList.toggle('dark', theme === 'dark');
}