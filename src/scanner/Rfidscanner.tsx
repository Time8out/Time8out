function RFIDScanner() {
  return (
    <div style={{
      minHeight: '100vh',
      background: '#f9fafb',
      fontFamily: "'DM Sans', sans-serif",
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }}>
      <div style={{
        background: '#ffffff',
        border: '1.5px solid #e5e7eb',
        borderRadius: 16,
        padding: 40,
        boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 20,
        minWidth: 320,
      }}>
        <div style={{
          width: 160, height: 160,
          borderRadius: '50%',
          border: '2px dashed #fddcc9',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'relative',
          background: '#fff0e8',
        }}>
          <span style={{ fontSize: 13, color: '#e9520e', fontWeight: 600 }}>RFID Ready</span>
        </div>
        <p style={{ fontSize: 14, color: '#9ca3af', margin: 0 }}>
          RFID / NFC scanning logic goes here
        </p>
      </div>
    </div>
  );
}

export default RFIDScanner;