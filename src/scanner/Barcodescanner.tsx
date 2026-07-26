import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../utils/supabase';
import ScannedProfile from './ScannedProfile';
import { handleScan } from './ScannerLogic';
import type { StampResult } from './inputLiveStamp';

type AuthState = 'idle' | 'verifying' | 'granted' | 'denied';

function BarcodeScanner() {
  // ── Auth state ──────────────────────────────────────────
  const [authState, setAuthState] = useState<AuthState>('idle');
  const [companyCodeInput, setCompanyCodeInput] = useState('');
  const [companyCode, setCompanyCode] = useState<string>('');
  const [authError, setAuthError] = useState('');

  // ── Scanner state ────────────────────────────────────────
  const [flash, setFlash] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [scannedValue, setScannedValue] = useState('');
  const [stampResult, setStampResult] = useState<StampResult | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const bufferRef = useRef('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const closeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const codeInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus the company code input on mount
  useEffect(() => {
    codeInputRef.current?.focus();
  }, []);

  // Keep scanner input focused once granted
  useEffect(() => {
    if (authState !== 'granted') return;
    const refocus = () => inputRef.current?.focus();
    refocus();
    window.addEventListener('click', refocus);
    return () => window.removeEventListener('click', refocus);
  }, [authState]);

  // ── Company code verification ────────────────────────────
  async function handleVerify() {
    const code = companyCodeInput.trim();
    if (!code) return;

    setAuthState('verifying');
    setAuthError('');

    const { data, error } = await supabase
      .from('users')
      .select('CompanyCode')
      .eq('CompanyCode', code)
      .limit(1)
      .single();

    if (error || !data) {
      setAuthState('denied');
      setAuthError('Invalid company code. Please try again.');
      setCompanyCodeInput('');
      setTimeout(() => {
        setAuthState('idle');
        codeInputRef.current?.focus();
      }, 1800);
    } else {
      setCompanyCode(data.CompanyCode);
      console.log('[BarcodeScanner] Company verified:', data.CompanyCode);
      setAuthState('granted');
    }
  }

  // ── Scanner keystroke capture ────────────────────────────
  const processingRef = useRef(false);

  const handleKeyDown = async (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Scanners send characters rapidly then terminate with Enter
    if (e.key === 'Enter') {
      if (processingRef.current) return;
      processingRef.current = true;
      setTimeout(() => { processingRef.current = false; }, 50);

      const value = bufferRef.current.trim();
      if (value) {
        // Clear any existing close timer
        if (closeTimerRef.current) clearTimeout(closeTimerRef.current);

        // Show modal immediately with processing state
        setScannedValue(value);
        setStampResult(null);
        setShowModal(true);
        setFlash(true);
        setTimeout(() => setFlash(false), 600);

        // Wait for result then start the 4s countdown
        const result = await handleScan(value, companyCode);
        setStampResult(result);

        closeTimerRef.current = setTimeout(() => setShowModal(false), 6000);
      }
      bufferRef.current = '';
      if (inputRef.current) inputRef.current.value = '';
      return;
    }

    // Accumulate characters; reset buffer if gap > 100ms (human typing)
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { bufferRef.current = ''; }, 100);
    if (e.key.length === 1) bufferRef.current += e.key;
  };

  // ── Company code gate ────────────────────────────────────
  if (authState !== 'granted') {
    return (
      <div style={{
        minHeight: '100vh',
        background: '#f9fafb',
        fontFamily: "'DM Sans', sans-serif",
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}>
        <div style={{
          width: '100%',
          maxWidth: 400,
          background: '#ffffff',
          border: `2px solid ${authState === 'denied' ? '#fca5a5' : '#e5e7eb'}`,
          borderRadius: 20,
          padding: '40px 32px 32px',
          boxShadow: authState === 'denied'
            ? '0 0 0 4px rgba(220,38,38,0.08), 0 4px 16px rgba(0,0,0,0.08)'
            : '0 4px 16px rgba(0,0,0,0.08)',
          transition: 'all 0.2s ease',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 24,
        }}>
          {/* Icon */}
          <div style={{
            width: 56, height: 56,
            borderRadius: 14,
            background: authState === 'denied' ? '#fee2e2' : '#fff0e8',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            transition: 'all 0.2s',
          }}>
            {authState === 'denied' ? (
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <line x1="15" y1="9" x2="9" y2="15"/>
                <line x1="9" y1="9" x2="15" y2="15"/>
              </svg>
            ) : (
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#e9520e" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
                <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
              </svg>
            )}
          </div>

          {/* Title */}
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: '0 0 6px', letterSpacing: '-0.02em' }}>
              Scanner Access
            </h2>
            <p style={{ fontSize: 14, color: '#6b7280', margin: 0, lineHeight: 1.55 }}>
              Enter your company code to activate the barcode scanner.
            </p>
          </div>

          {/* Input */}
          <div style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input
              ref={codeInputRef}
              type="text"
              placeholder="e.g. ACME-2024"
              value={companyCodeInput}
              onChange={e => { setCompanyCodeInput(e.target.value); setAuthError(''); }}
              onKeyDown={e => e.key === 'Enter' && handleVerify()}
              disabled={authState === 'verifying' || authState === 'denied'}
              spellCheck={false}
              autoCapitalize="characters"
              style={{
                width: '100%',
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 16,
                fontWeight: 600,
                color: '#111827',
                background: '#f9fafb',
                border: `1.5px solid ${authError ? '#fca5a5' : '#e5e7eb'}`,
                borderRadius: 10,
                padding: '12px 16px',
                outline: 'none',
                textAlign: 'center',
                letterSpacing: '0.05em',
                transition: 'border-color 0.15s',
                boxSizing: 'border-box',
              }}
              onFocus={e => { if (!authError) e.target.style.borderColor = '#e9520e'; }}
              onBlur={e => { if (!authError) e.target.style.borderColor = '#e5e7eb'; }}
            />

            {authError && (
              <p style={{ fontSize: 13, color: '#dc2626', fontWeight: 600, margin: 0, textAlign: 'center' }}>
                {authError}
              </p>
            )}
          </div>

          {/* Button */}
          <button
            onClick={handleVerify}
            disabled={!companyCodeInput.trim() || authState === 'verifying' || authState === 'denied'}
            style={{
              all: 'unset',
              cursor: companyCodeInput.trim() && authState === 'idle' ? 'pointer' : 'not-allowed',
              width: '100%',
              boxSizing: 'border-box',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              padding: '12px 24px',
              borderRadius: 10,
              background: companyCodeInput.trim() && authState === 'idle'
                ? 'linear-gradient(135deg, #e9520e, #f2884d)'
                : '#e5e7eb',
              color: companyCodeInput.trim() && authState === 'idle' ? '#ffffff' : '#9ca3af',
              fontSize: 15,
              fontWeight: 700,
              transition: 'all 0.15s ease',
              boxShadow: companyCodeInput.trim() && authState === 'idle'
                ? '0 4px 16px rgba(233,82,14,0.3)'
                : 'none',
            }}
          >
            {authState === 'verifying' ? (
              <>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{ animation: 'spin 0.8s linear infinite' }}>
                  <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                </svg>
                Verifying…
              </>
            ) : authState === 'denied' ? (
              'Invalid Code'
            ) : (
              <>
                Activate Scanner
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </>
            )}
          </button>

          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      </div>
    );
  }

  // ── Scanner UI (after auth) ──────────────────────────────
  return (
    <div
      style={{
        minHeight: '100vh',
        background: '#f9fafb',
        fontFamily: "'DM Sans', sans-serif",
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
      onClick={() => inputRef.current?.focus()}
    >
      {/* Hidden input capturing all USB scanner keystrokes */}
      <input
        ref={inputRef}
        onKeyDown={handleKeyDown}
        autoFocus
        readOnly
        style={{
          position: 'fixed',
          opacity: 0,
          pointerEvents: 'none',
          width: 1,
          height: 1,
          top: 0,
          left: 0,
        }}
      />

      <div style={{ width: '100%', maxWidth: 480, display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Company badge */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
            fontWeight: 700,
            color: '#c2410c',
            background: '#fff0e8',
            padding: '5px 12px',
            borderRadius: 99,
            letterSpacing: '0.04em',
          }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
            </svg>
            {companyCode}
          </div>

          <button
            onClick={() => {
              setAuthState('idle');
              setCompanyCode('');
              setCompanyCodeInput('');
            }}
            style={{
              all: 'unset',
              cursor: 'pointer',
              fontSize: 12,
              fontWeight: 600,
              color: '#9ca3af',
            }}
            onMouseEnter={e => (e.currentTarget.style.color = '#dc2626')}
            onMouseLeave={e => (e.currentTarget.style.color = '#9ca3af')}
          >
            Sign out
          </button>
        </div>

        {/* Scan target */}
        <div style={{
          background: flash ? '#fff0e8' : '#ffffff',
          border: `2px solid ${flash ? '#e9520e' : '#e5e7eb'}`,
          borderRadius: 16,
          padding: '32px 24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 16,
          transition: 'all 0.15s ease',
          boxShadow: flash ? '0 0 0 4px rgba(233,82,14,0.12)' : '0 2px 8px rgba(0,0,0,0.06)',
        }}>
          {/* Barcode icon */}
          <div style={{
            color: flash ? '#e9520e' : '#9ca3af',
            transition: 'color 0.15s',
          }}>
            <svg width="64" height="64" viewBox="0 0 48 48" fill="none">
              <rect x="4"  y="10" width="4"  height="28" rx="1.5" fill="currentColor"/>
              <rect x="11" y="10" width="2"  height="28" rx="1"   fill="currentColor" opacity=".7"/>
              <rect x="16" y="10" width="5"  height="28" rx="1.5" fill="currentColor"/>
              <rect x="24" y="10" width="2"  height="28" rx="1"   fill="currentColor" opacity=".7"/>
              <rect x="29" y="10" width="4"  height="28" rx="1.5" fill="currentColor"/>
              <rect x="36" y="10" width="2"  height="28" rx="1"   fill="currentColor" opacity=".7"/>
              <rect x="41" y="10" width="3"  height="28" rx="1.5" fill="currentColor"/>
              <rect x="2"  y="23" width="44" height="2"  rx="1"   fill="url(#sl)" opacity=".9"/>
              <defs>
                <linearGradient id="sl" x1="2" y1="24" x2="46" y2="24" gradientUnits="userSpaceOnUse">
                  <stop stopColor="#e9520e" stopOpacity="0"/>
                  <stop offset=".5" stopColor="#e9520e"/>
                  <stop offset="1" stopColor="#e9520e" stopOpacity="0"/>
                </linearGradient>
              </defs>
            </svg>
          </div>

          <p style={{ fontSize: 15, color: '#6b7280', margin: 0, textAlign: 'center', lineHeight: 1.5 }}>
            {flash
              ? <span style={{ color: '#e9520e', fontWeight: 700 }}>Scanned!</span>
              : 'Ready — scan a barcode now'
            }
          </p>
        </div>

        {/* Status pill */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#6b7280', background: '#f3f4f6', padding: '6px 14px', borderRadius: 99 }}>
            <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#16a34a', boxShadow: '0 0 0 2px rgba(22,163,74,0.2)', display: 'inline-block' }}/>
            Listening for scanner input
          </div>
        </div>
      </div>

      {/* ── Scan result modal ── */}
      {showModal && (
        <div
          onClick={() => {
            if (closeTimerRef.current) clearTimeout(closeTimerRef.current);
            setShowModal(false);
          }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.45)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: 24,
            animation: 'bc-fade 0.15s ease',
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: '#ffffff',
              borderRadius: 20,
              padding: '32px 28px 24px',
              width: '100%',
              maxWidth: 340,
              boxShadow: '0 16px 48px rgba(0,0,0,0.18)',
              display: 'flex',
              flexDirection: 'column',
              gap: 20,
              animation: 'bc-up 0.22s cubic-bezier(0.22,1,0.36,1)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            {/* Top accent */}
            <div style={{
              position: 'absolute',
              top: 0, left: 0, right: 0,
              height: 4,
              background: stampResult && !stampResult.success
                ? 'linear-gradient(90deg, #ef4444, #f87171)'
                : 'linear-gradient(90deg, #e9520e, #f2884d)',
              borderRadius: '20px 20px 0 0',
            }}/>

            {/* ScannedProfile content */}
            <ScannedProfile
              scannedValue={scannedValue}
              companyCode={companyCode}
              stampResult={stampResult}
            />

            {/* 4s countdown bar — only starts after stampResult is received */}
            {stampResult && (
              <div style={{ width: '100%', height: 3, background: '#f3f4f6', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  background: stampResult && !stampResult.success
                    ? 'linear-gradient(90deg, #ef4444, #f87171)'
                    : 'linear-gradient(90deg, #e9520e, #f2884d)',
                  borderRadius: 99,
                  animation: 'bc-countdown 4s linear forwards',
                }}/>
              </div>
            )}
          </div>

          <style>{`
            @keyframes bc-fade { from { opacity: 0; } to { opacity: 1; } }
            @keyframes bc-up   { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
            @keyframes bc-countdown { from { width: 100%; } to { width: 0%; } }
          `}</style>
        </div>
      )}
    </div>
  );
}

export default BarcodeScanner;
