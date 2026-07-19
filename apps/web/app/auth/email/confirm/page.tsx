'use client';

import { useState } from 'react';

export default function ConfirmPage() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [error, setError] = useState('');

  async function handleConfirm() {
    setStatus('loading');
    try {
      const res = await fetch('/auth/email/confirm', { method: 'POST' });
      if (res.redirected) {
        window.location.href = res.url;
        return;
      }
      const data = await res.json();
      if (!res.ok) {
        setStatus('error');
        setError(data.error ?? 'Login failed');
      }
    } catch {
      setStatus('error');
      setError('Network error. Please try again.');
    }
  }

  return (
    <div style={{ maxWidth: 400, margin: '40px auto', fontFamily: 'sans-serif' }}>
      <h1>Confirm login</h1>
      <p>Click the button below to complete your login.</p>
      {status === 'error' && (
        <p style={{ color: 'red' }}>{error}</p>
      )}
      <button
        onClick={handleConfirm}
        disabled={status === 'loading'}
        style={{ padding: '10px 20px', fontSize: 16 }}
      >
        {status === 'loading' ? 'Logging in...' : 'Confirm login'}
      </button>
    </div>
  );
}
