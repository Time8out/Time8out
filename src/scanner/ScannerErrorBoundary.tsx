import { Component, type ReactNode } from 'react';

type Props = {
  children: ReactNode;
  fallback: ReactNode;
  /** Changing this remounts the boundary fresh, clearing any caught error. */
  resetKey: number | string;
};

type State = { hasError: boolean; erroredKey: number | string | null };

/**
 * The app has no top-level error boundary, so an uncaught error anywhere
 * (e.g. inside the camera-scanning effect on some phone/browser combo) blanks
 * the entire page to white. This contains that to just the camera view —
 * everything else on the scanner page (company badge, hardware-scanner
 * hidden input, sign out) keeps working, and we fall back to the plain
 * static icon instead of a live camera.
 */
export default class ScannerErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, erroredKey: null };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: unknown, info: unknown) {
    console.error('[ScannerErrorBoundary] Camera view crashed:', error, info);
    this.setState({ erroredKey: this.props.resetKey });
  }

  render() {
    if (this.state.hasError && this.state.erroredKey === this.props.resetKey) {
      return this.props.fallback;
    }
    if (this.state.hasError) {
      // resetKey changed since the error — try rendering children again.
      this.state = { hasError: false, erroredKey: null };
    }
    return this.props.children;
  }
}
