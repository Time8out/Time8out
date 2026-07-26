/**
 * Lightweight, zero-dependency format identifiers shared between the scanner
 * pages and CameraScanner. Deliberately NOT importing anything from
 * @zxing/library here — that package has no `sideEffects:false`, so any
 * top-level import of it (even just the BarcodeFormat enum) drags the whole
 * decoding engine into whichever bundle chunk does the importing. Keeping
 * these as plain strings lets the scanner pages stay zxing-free, so the
 * library only ever loads inside CameraScanner's own lazy-loaded chunk.
 */
export type ScanFormat =
  | 'QR_CODE'
  | 'CODE_128'
  | 'EAN_13'
  | 'EAN_8'
  | 'UPC_A'
  | 'UPC_E'
  | 'CODE_39'
  | 'ITF'
  | 'CODABAR';
