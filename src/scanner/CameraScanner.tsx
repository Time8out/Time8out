import { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { BarcodeFormat, DecodeHintType, NotFoundException } from '@zxing/library';
import type { ScanFormat } from './scanFormats';

const FORMAT_MAP: Record<ScanFormat, BarcodeFormat> = {
  QR_CODE: BarcodeFormat.QR_CODE,
  CODE_128: BarcodeFormat.CODE_128,
  EAN_13: BarcodeFormat.EAN_13,
  EAN_8: BarcodeFormat.EAN_8,
  UPC_A: BarcodeFormat.UPC_A,
  UPC_E: BarcodeFormat.UPC_E,
  CODE_39: BarcodeFormat.CODE_39,
  ITF: BarcodeFormat.ITF,
  CODABAR: BarcodeFormat.CODABAR,
};

type Props = {
  formats: ScanFormat[];
  accentColor: string;
  /** Suppress new decodes while a scan is being processed / the result modal is showing. */
  paused: boolean;
  onDecode: (value: string) => void;
};

export default function CameraScanner({ formats, accentColor, paused, onDecode }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);
  const onDecodeRef = useRef(onDecode);
  onDecodeRef.current = onDecode;
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  const [cameraError, setCameraError] = useState<string | null>(null);

  useEffect(() => {
    const video = videoRef.current;
    if (!video) return;

    const hints = new Map();
    hints.set(DecodeHintType.POSSIBLE_FORMATS, formats.map(f => FORMAT_MAP[f]));
    const reader = new BrowserMultiFormatReader(hints);
    let cancelled = false;

    reader
      .decodeFromVideoDevice(undefined, video, (result, err, controls) => {
        if (cancelled) return;
        controlsRef.current = controls;
        if (result && !pausedRef.current) {
          onDecodeRef.current(result.getText());
        }
        if (err && !(err instanceof NotFoundException)) {
          // NotFoundException fires on every frame with no code in view — expected, not an error.
          console.error('[CameraScanner] decode error:', err);
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        console.error('[CameraScanner] camera init failed:', err);
        setCameraError('Could not access the camera. Please allow camera access and reload the page.');
      });

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
    };
  }, [formats]);

  if (cameraError) {
    return (
      <div style={{
        width: '100%', maxWidth: 320, padding: '20px 16px', borderRadius: 16,
        background: '#fef2f2', border: '1.5px solid #fca5a5', color: '#991b1b',
        fontSize: 13, textAlign: 'center', lineHeight: 1.6,
      }}>
        {cameraError}
      </div>
    );
  }

  return (
    <div style={{
      position: 'relative', width: '100%', maxWidth: 320, aspectRatio: '1',
      borderRadius: 16, overflow: 'hidden', background: '#111827',
    }}>
      <video ref={videoRef} muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      <div style={{
        position: 'absolute', inset: 20, border: `3px solid ${accentColor}`,
        borderRadius: 12, pointerEvents: 'none',
        boxShadow: '0 0 0 999px rgba(0,0,0,0.25)',
      }} />
    </div>
  );
}
