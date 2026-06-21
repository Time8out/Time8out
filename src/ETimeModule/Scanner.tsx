import { useState } from 'react';

const tiles = [
  {
    id: 'barcode',
    label: 'Barcode Scanner',
    description: 'Scan 1D barcodes including UPC, EAN, Code 128, and more.',
    route: '/scanner/barcode',
    icon: (
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="4"  y="10" width="4"  height="28" rx="1.5" fill="currentColor"/>
        <rect x="11" y="10" width="2"  height="28" rx="1"   fill="currentColor" opacity=".7"/>
        <rect x="16" y="10" width="5"  height="28" rx="1.5" fill="currentColor"/>
        <rect x="24" y="10" width="2"  height="28" rx="1"   fill="currentColor" opacity=".7"/>
        <rect x="29" y="10" width="4"  height="28" rx="1.5" fill="currentColor"/>
        <rect x="36" y="10" width="2"  height="28" rx="1"   fill="currentColor" opacity=".7"/>
        <rect x="41" y="10" width="3"  height="28" rx="1.5" fill="currentColor"/>
        <rect x="2" y="23" width="44" height="2" rx="1" fill="url(#sl1)" opacity=".85"/>
        <defs>
          <linearGradient id="sl1" x1="2" y1="24" x2="46" y2="24" gradientUnits="userSpaceOnUse">
            <stop stopColor="#e9520e" stopOpacity="0"/>
            <stop offset=".5" stopColor="#e9520e"/>
            <stop offset="1" stopColor="#e9520e" stopOpacity="0"/>
          </linearGradient>
        </defs>
      </svg>
    ),
    accent: '#e9520e',
    accentLight: '#fff0e8',
    accentMuted: '#fddcc9',
  },
  {
    id: 'qr',
    label: 'QR Code Scanner',
    description: 'Scan QR codes and Data Matrix codes instantly with your camera.',
    route: '/scanner/qr',
    icon: (
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="4"  y="4"  width="16" height="16" rx="2.5" stroke="currentColor" strokeWidth="3" fill="none"/>
        <rect x="9"  y="9"  width="6"  height="6"  rx="1"   fill="currentColor"/>
        <rect x="28" y="4"  width="16" height="16" rx="2.5" stroke="currentColor" strokeWidth="3" fill="none"/>
        <rect x="33" y="9"  width="6"  height="6"  rx="1"   fill="currentColor"/>
        <rect x="4"  y="28" width="16" height="16" rx="2.5" stroke="currentColor" strokeWidth="3" fill="none"/>
        <rect x="9"  y="33" width="6"  height="6"  rx="1"   fill="currentColor"/>
        <rect x="28" y="28" width="5" height="5" rx="1" fill="currentColor"/>
        <rect x="35" y="28" width="5" height="5" rx="1" fill="currentColor" opacity=".6"/>
        <rect x="28" y="35" width="5" height="5" rx="1" fill="currentColor" opacity=".6"/>
        <rect x="35" y="35" width="5" height="5" rx="1" fill="currentColor"/>
        <rect x="2" y="23" width="44" height="2" rx="1" fill="url(#sl2)" opacity=".85"/>
        <defs>
          <linearGradient id="sl2" x1="2" y1="24" x2="46" y2="24" gradientUnits="userSpaceOnUse">
            <stop stopColor="#0ea5e9" stopOpacity="0"/>
            <stop offset=".5" stopColor="#0ea5e9"/>
            <stop offset="1" stopColor="#0ea5e9" stopOpacity="0"/>
          </linearGradient>
        </defs>
      </svg>
    ),
    accent: '#0ea5e9',
    accentLight: '#e0f4fd',
    accentMuted: '#bae6fd',
  },
  {
    id: 'rfid',
    label: 'RFID Scanner',
    description: 'Read RFID tags and NFC chips for asset tracking and access control.',
    route: '/scanner/rfid',
    icon: (
      <svg width="48" height="48" viewBox="0 0 48 48" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect x="16" y="16" width="16" height="16" rx="3" fill="currentColor"/>
        <rect x="19" y="19" width="10" height="10" rx="1.5" fill="white" opacity=".25"/>
        <rect x="12" y="20" width="4"  height="2.5" rx="1" fill="currentColor" opacity=".6"/>
        <rect x="12" y="25.5" width="4"  height="2.5" rx="1" fill="currentColor" opacity=".6"/>
        <rect x="32" y="20" width="4"  height="2.5" rx="1" fill="currentColor" opacity=".6"/>
        <rect x="32" y="25.5" width="4"  height="2.5" rx="1" fill="currentColor" opacity=".6"/>
        <rect x="20" y="12" width="2.5" height="4"  rx="1" fill="currentColor" opacity=".6"/>
        <rect x="25.5" y="12" width="2.5" height="4"  rx="1" fill="currentColor" opacity=".6"/>
        <rect x="20" y="32" width="2.5" height="4"  rx="1" fill="currentColor" opacity=".6"/>
        <rect x="25.5" y="32" width="2.5" height="4"  rx="1" fill="currentColor" opacity=".6"/>
        <path d="M8 24 C8 15.2 15.2 8 24 8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity=".4"/>
        <path d="M40 24 C40 15.2 32.8 8 24 8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity=".4"/>
        <path d="M8 24 C8 32.8 15.2 40 24 40" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity=".4"/>
        <path d="M40 24 C40 32.8 32.8 40 24 40" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none" opacity=".4"/>
        <path d="M3 24 C3 12 12 3 24 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" opacity=".2"/>
        <path d="M45 24 C45 12 36 3 24 3" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" opacity=".2"/>
        <path d="M3 24 C3 36 12 45 24 45" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" opacity=".2"/>
        <path d="M45 24 C45 36 36 45 24 45" stroke="currentColor" strokeWidth="2" strokeLinecap="round" fill="none" opacity=".2"/>
      </svg>
    ),
    accent: '#e9520e',
    accentLight: '#fff0e8',
    accentMuted: '#fddcc9',
  },
];

function LinkRow({ route, label }: { route: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const fullUrl = `${window.location.origin}${route}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(fullUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      gap: 10,
      padding: '10px 14px',
      background: '#f9fafb',
      border: '1.5px solid #e5e7eb',
      borderRadius: 10,
    }}>
      {/* Link icon */}
      <svg width="15" height="15" viewBox="0 0 16 16" fill="none" style={{ flexShrink: 0, color: '#9ca3af' }}>
        <path d="M6.5 9.5a3.5 3.5 0 0 0 4.95 0l2-2a3.5 3.5 0 0 0-4.95-4.95l-1 1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
        <path d="M9.5 6.5a3.5 3.5 0 0 0-4.95 0l-2 2a3.5 3.5 0 0 0 4.95 4.95l1-1" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
      </svg>

      {/* URL */}
      <span style={{
        fontSize: 13,
        color: '#374151',
        fontFamily: 'monospace',
        flex: 1,
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        whiteSpace: 'nowrap',
      }}>
        {fullUrl}
      </span>

      {/* Label badge */}
      <span style={{
        fontSize: 11,
        fontWeight: 600,
        color: '#6b7280',
        background: '#e5e7eb',
        padding: '2px 8px',
        borderRadius: 99,
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}>
        {label}
      </span>

      {/* Copy button */}
      <button
        onClick={handleCopy}
        title="Copy link"
        style={{
          all: 'unset',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 30,
          height: 30,
          borderRadius: 7,
          background: copied ? '#dcfce7' : '#ffffff',
          border: `1.5px solid ${copied ? '#86efac' : '#e5e7eb'}`,
          color: copied ? '#16a34a' : '#6b7280',
          transition: 'all 0.15s ease',
          flexShrink: 0,
        }}
        onMouseEnter={e => {
          if (!copied) {
            (e.currentTarget as HTMLButtonElement).style.background = '#f3f4f6';
            (e.currentTarget as HTMLButtonElement).style.color = '#111827';
          }
        }}
        onMouseLeave={e => {
          if (!copied) {
            (e.currentTarget as HTMLButtonElement).style.background = '#ffffff';
            (e.currentTarget as HTMLButtonElement).style.color = '#6b7280';
          }
        }}
      >
        {copied ? (
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <path d="M3 8l3.5 3.5L13 4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        ) : (
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
            <rect x="5" y="5" width="9" height="9" rx="2" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M5 5V4a2 2 0 0 1 2-2h5a2 2 0 0 1 2 2v7a2 2 0 0 1-2 2h-1" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
        )}
      </button>
    </div>
  );
}

function ScannerTile({ tile, index }: {
  tile: typeof tiles[0];
  index: number;
}) {
  const handleClick = () => {
    window.open(`${window.location.origin}${tile.route}`, '_blank', 'noopener,noreferrer');
  };

  return (
    <button
      onClick={handleClick}
      style={{
        all: 'unset',
        cursor: 'pointer',
        display: 'flex',
        flexDirection: 'column',
        background: '#ffffff',
        border: '1.5px solid #e5e7eb',
        borderRadius: 16,
        padding: '28px 24px 24px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        transition: 'all 0.22s ease',
        position: 'relative',
        overflow: 'hidden',
      }}
      onMouseEnter={e => {
        const el = e.currentTarget as HTMLButtonElement;
        el.style.transform = 'translateY(-3px)';
        el.style.boxShadow = '0 12px 32px rgba(0,0,0,0.12)';
        el.style.borderColor = tile.accentMuted;
      }}
      onMouseLeave={e => {
        const el = e.currentTarget as HTMLButtonElement;
        el.style.transform = 'translateY(0)';
        el.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)';
        el.style.borderColor = '#e5e7eb';
      }}
      onMouseDown={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-1px)'; }}
      onMouseUp={e => { (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-3px)'; }}
    >
      {/* Top accent bar */}
      <div style={{
        position: 'absolute',
        top: 0, left: 0, right: 0,
        height: 3,
        background: tile.id === 'qr'
          ? 'linear-gradient(90deg, #0ea5e9, #38bdf8)'
          : tile.id === 'rfid'
          ? 'linear-gradient(90deg, #e9520e, #0ea5e9)'
          : 'linear-gradient(90deg, #e9520e, #f97316)',
        borderRadius: '16px 16px 0 0',
      }}/>

      {/* External link badge */}
      <div style={{
        position: 'absolute',
        top: 14, right: 14,
        color: '#9ca3af',
      }}>
        <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
          <path d="M10 3h3v3M13 3l-6 6M6 4H4a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h7a1 1 0 0 0 1-1v-2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>

      {/* Icon */}
      <div style={{
        width: 72, height: 72,
        borderRadius: 14,
        background: tile.accentLight,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 20,
        color: tile.accent,
      }}>
        {tile.icon}
      </div>

      {/* Label */}
      <h2 style={{
        fontSize: 18,
        fontWeight: 700,
        color: '#111827',
        letterSpacing: '-0.01em',
        margin: '0 0 8px',
        lineHeight: 1.3,
      }}>
        {tile.label}
      </h2>

      {/* Description */}
      <p style={{
        fontSize: 14,
        color: '#6b7280',
        margin: '0 0 20px',
        lineHeight: 1.6,
        flexGrow: 1,
      }}>
        {tile.description}
      </p>

      {/* CTA */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 14,
        fontWeight: 600,
        color: tile.accent,
      }}>
        Open Scanner
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M3 8h10M9 4l4 4-4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </div>
    </button>
  );
}

function Scanner() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#f9fafb',
      fontFamily: "'DM Sans', sans-serif",
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Page header */}
      <div style={{
        background: '#ffffff',
        borderBottom: '1px solid #e5e7eb',
        padding: '20px 24px',
        boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
      }}>
        <div style={{ maxWidth: 960, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: 'linear-gradient(135deg, #e9520e, #0ea5e9)',
            }}/>
            <span style={{ fontSize: 12, fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6b7280' }}>
              Scanning Suite
            </span>
          </div>
          <h1 style={{ fontSize: 28, fontWeight: 700, color: '#111827', letterSpacing: '-0.02em', lineHeight: 1.2, margin: 0 }}>
            Choose a Scanner
          </h1>
          <p style={{ fontSize: 15, color: '#6b7280', margin: '6px 0 0', lineHeight: 1.6 }}>
            Select the scanning method that matches your use case.
          </p>
        </div>
      </div>

      <div style={{
        flex: 1,
        maxWidth: 960,
        width: '100%',
        margin: '0 auto',
        padding: '40px 24px',
        display: 'flex',
        flexDirection: 'column',
        gap: 32,
      }}>
        {/* Tiles */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 20,
        }}>
          {tiles.map((tile, i) => (
            <ScannerTile key={tile.id} tile={tile} index={i} />
          ))}
        </div>

        {/* Share links section */}
        <div style={{
          background: '#ffffff',
          border: '1.5px solid #e5e7eb',
          borderRadius: 16,
          padding: '24px',
          boxShadow: '0 2px 8px rgba(0,0,0,0.05)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" style={{ color: '#6b7280' }}>
              <circle cx="12" cy="3" r="1.5" stroke="currentColor" strokeWidth="1.5"/>
              <circle cx="12" cy="13" r="1.5" stroke="currentColor" strokeWidth="1.5"/>
              <circle cx="4"  cy="8"  r="1.5" stroke="currentColor" strokeWidth="1.5"/>
              <path d="M10.5 3.75 5.5 7.25M10.5 12.25 5.5 8.75" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round"/>
            </svg>
            <span style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>Share Scanner Links</span>
            <span style={{ fontSize: 12, color: '#9ca3af', marginLeft: 2 }}>— click to copy</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {tiles.map(tile => (
              <LinkRow key={tile.id} route={tile.route} label={tile.label} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Scanner;