import { useState, useEffect, useRef } from 'react';

function BarcodeScanner() {
  const [lastScanned, setLastScanned] = useState<string>('');
  const [history, setHistory] = useState<{ value: string; time: string }[]>([]);
  const [flash, setFlash] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const bufferRef = useRef('');
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep focus on the hidden input at all times
  useEffect(() => {
    const refocus = () => inputRef.current?.focus();
    refocus();
    window.addEventListener('click', refocus);
    return () => window.removeEventListener('click', refocus);
  }, []);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // Scanners send characters rapidly then terminate with Enter
    if (e.key === 'Enter') {
      const value = bufferRef.current.trim();
      if (value) {
        console.log('[BarcodeScanner] Scanned:', value);
        setLastScanned(value);
        setHistory(prev => [{ value, time: new Date().toLocaleTimeString() }, ...prev].slice(0, 50));
        setFlash(true);
        setTimeout(() => setFlash(false), 600);
      }
      bufferRef.current = '';
      // Clear the visible input value
      if (inputRef.current) inputRef.current.value = '';
      return;
    }

    // Accumulate characters; reset buffer if gap > 100ms (human typing)
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => {
      bufferRef.current = '';
    }, 100);

    if (e.key.length === 1) {
      bufferRef.current += e.key;
    }
  };

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
      {/* Hidden input that captures all scanner keystrokes */}
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
            {flash ? (
              <span style={{ color: '#e9520e', fontWeight: 700 }}>Scanned!</span>
            ) : (
              'Ready — scan a barcode now'
            )}
          </p>

          {/* Last scanned value */}
          {lastScanned && (
            <div style={{
              width: '100%',
              background: '#f9fafb',
              border: '1.5px solid #e5e7eb',
              borderRadius: 10,
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 10,
            }}>
              <span style={{ fontSize: 12, color: '#9ca3af', fontWeight: 600, letterSpacing: '0.05em', textTransform: 'uppercase', flexShrink: 0 }}>Last</span>
              <span style={{ fontSize: 16, fontWeight: 700, color: '#111827', fontFamily: 'monospace', flex: 1, textAlign: 'right', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {lastScanned}
              </span>
            </div>
          )}
        </div>

        {/* History */}
        {history.length > 0 && (
          <div style={{
            background: '#ffffff',
            border: '1.5px solid #e5e7eb',
            borderRadius: 16,
            overflow: 'hidden',
            boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
          }}>
            <div style={{
              padding: '12px 16px',
              borderBottom: '1px solid #f3f4f6',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>
                Scan History
              </span>
              <span style={{ fontSize: 12, color: '#9ca3af' }}>
                {history.length} scan{history.length !== 1 ? 's' : ''}
              </span>
            </div>
            <div style={{ maxHeight: 280, overflowY: 'auto' }}>
              {history.map((item, i) => (
                <div
                  key={i}
                  style={{
                    padding: '10px 16px',
                    borderBottom: i < history.length - 1 ? '1px solid #f3f4f6' : 'none',
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    background: i === 0 ? '#fff9f7' : 'transparent',
                  }}
                >
                  <span style={{ fontSize: 11, color: '#9ca3af', flexShrink: 0, width: 60 }}>{item.time}</span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: '#111827', fontFamily: 'monospace', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {item.value}
                  </span>
                  {i === 0 && (
                    <span style={{ fontSize: 10, fontWeight: 700, color: '#e9520e', background: '#fff0e8', padding: '2px 8px', borderRadius: 99, flexShrink: 0 }}>NEW</span>
                  )}
                </div>
              ))}
            </div>
            {history.length > 0 && (
              <div style={{ padding: '10px 16px', borderTop: '1px solid #f3f4f6' }}>
                <button
                  onClick={e => { e.stopPropagation(); setHistory([]); setLastScanned(''); }}
                  style={{
                    all: 'unset',
                    cursor: 'pointer',
                    fontSize: 12,
                    color: '#9ca3af',
                    fontWeight: 600,
                  }}
                  onMouseEnter={e => (e.currentTarget.style.color = '#dc2626')}
                  onMouseLeave={e => (e.currentTarget.style.color = '#9ca3af')}
                >
                  Clear history
                </button>
              </div>
            )}
          </div>
        )}

        {/* Status pill */}
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 6,
            fontSize: 12,
            color: '#6b7280',
            background: '#f3f4f6',
            padding: '6px 14px',
            borderRadius: 99,
          }}>
            <span style={{
              width: 7, height: 7, borderRadius: '50%',
              background: '#16a34a',
              boxShadow: '0 0 0 2px rgba(22,163,74,0.2)',
              display: 'inline-block',
            }}/>
            Listening for scanner input
          </div>
        </div>
      </div>
    </div>
  );
}

export default BarcodeScanner;