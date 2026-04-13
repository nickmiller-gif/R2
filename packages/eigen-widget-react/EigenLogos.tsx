/**
 * EigenLogos — shared logo components for all Lovable frontends.
 *
 * Usage:
 *   import { EigenLogo, EigenXLogo, EigenXLogoFull } from '@/components/EigenLogos';
 *
 *   <EigenLogo size={24} />         // White square + eigenvector
 *   <EigenXLogo size={24} />        // Amber circle + X
 *   <EigenXLogoFull size={200} />   // Full mark with glow, ticks, chevrons
 */
import { useEffect, useId } from 'react';

interface LogoProps {
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

// Ensure @keyframes eigen-pulse-dot is injected into the document once.
let _pulseDotStyleInjected = false;
function usePulseDotStyle() {
  useEffect(() => {
    if (_pulseDotStyleInjected || typeof document === 'undefined') return;
    _pulseDotStyleInjected = true;
    const el = document.createElement('style');
    el.textContent =
      '@keyframes eigen-pulse-dot{0%,100%{transform:scale(1);opacity:.4}50%{transform:scale(1.9);opacity:0}}';
    document.head.appendChild(el);
  }, []);
}

/**
 * Eigen — square frame + diagonal eigenvector. White on dark.
 */
export function EigenLogo({ size = 24, className, style }: LogoProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      aria-hidden="true"
      focusable="false"
    >
      {/* Ghost axes */}
      <line x1="50" y1="8" x2="50" y2="92" stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
      <line x1="8" y1="50" x2="92" y2="50" stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
      {/* Outer square */}
      <rect x="18" y="18" width="64" height="64" stroke="#FFFFFF" strokeWidth="1.5" fill="none" />
      {/* Inner dashed echo */}
      <rect x="24" y="24" width="52" height="52" stroke="rgba(255,255,255,0.07)" strokeWidth="0.8" strokeDasharray="3 7" fill="none" />
      {/* Eigenvector */}
      <line x1="32" y1="68" x2="72" y2="30" stroke="#FFFFFF" strokeWidth="1.8" strokeLinecap="square" />
      {/* Arrow chevron */}
      <polyline points="65,29 72,30 68,37" fill="none" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="square" />
      {/* Scalar ticks */}
      <circle cx="42" cy="58" r="0.8" fill="rgba(255,255,255,0.2)" />
      <circle cx="62" cy="38" r="0.8" fill="rgba(255,255,255,0.2)" />
      {/* Origin crosshair */}
      <circle cx="50" cy="50" r="1.5" fill="none" stroke="#FFFFFF" strokeWidth="0.8" />
      <line x1="46" y1="50" x2="44" y2="50" stroke="rgba(255,255,255,0.25)" strokeWidth="0.8" />
      <line x1="54" y1="50" x2="56" y2="50" stroke="rgba(255,255,255,0.25)" strokeWidth="0.8" />
      <line x1="50" y1="46" x2="50" y2="44" stroke="rgba(255,255,255,0.25)" strokeWidth="0.8" />
      <line x1="50" y1="54" x2="50" y2="56" stroke="rgba(255,255,255,0.25)" strokeWidth="0.8" />
    </svg>
  );
}

/**
 * EigenX — circle + X crossing. Amber on dark.
 * Compact version for headers, tabs, FABs.
 */
export function EigenXLogo({ size = 24, className, style }: LogoProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      width={size}
      height={size}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="50" cy="50" r="36" stroke="#EF9F27" strokeWidth="1.5" />
      <line x1="25" y1="25" x2="75" y2="75" stroke="#EF9F27" strokeWidth="1.8" strokeLinecap="square" />
      <line x1="75" y1="25" x2="25" y2="75" stroke="#EF9F27" strokeWidth="1.8" strokeLinecap="square" />
      <circle cx="50" cy="50" r="2.5" fill="#EF9F27" />
    </svg>
  );
}

/**
 * EigenX Full — complete mark with glow, outer ring, ticks, chevrons.
 * For hero sections, splash screens, about pages.
 */
export function EigenXLogoFull({ size = 200, className, style }: LogoProps) {
  const uid = useId();
  const glowId = `eigenx-glow-${uid}`;
  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <radialGradient id={glowId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(239,159,39,0.08)" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
      </defs>
      {/* Ambient glow */}
      <circle cx="100" cy="100" r="85" fill={`url(#${glowId})`} />
      {/* Outer faint ring */}
      <circle cx="100" cy="100" r="80" fill="none" stroke="rgba(239,159,39,0.06)" strokeWidth="0.5" />
      {/* Primary circle */}
      <circle cx="100" cy="100" r="60" fill="none" stroke="#EF9F27" strokeWidth="1.5" />
      {/* Tick marks */}
      <line x1="100" y1="40" x2="100" y2="32" stroke="rgba(239,159,39,0.3)" strokeWidth="0.8" />
      <line x1="100" y1="160" x2="100" y2="168" stroke="rgba(239,159,39,0.3)" strokeWidth="0.8" />
      <line x1="40" y1="100" x2="32" y2="100" stroke="rgba(239,159,39,0.3)" strokeWidth="0.8" />
      <line x1="160" y1="100" x2="168" y2="100" stroke="rgba(239,159,39,0.3)" strokeWidth="0.8" />
      {/* X vectors */}
      <line x1="62" y1="62" x2="138" y2="138" stroke="#EF9F27" strokeWidth="2" strokeLinecap="square" />
      <line x1="138" y1="62" x2="62" y2="138" stroke="#EF9F27" strokeWidth="2" strokeLinecap="square" />
      {/* Chevrons */}
      <polyline points="130,60 138,62 132,70" fill="none" stroke="#EF9F27" strokeWidth="1.2" strokeLinecap="square" />
      <polyline points="70,130 62,138 68,140" fill="none" stroke="#EF9F27" strokeWidth="1.2" strokeLinecap="square" />
      <polyline points="70,60 62,62 68,70" fill="none" stroke="#EF9F27" strokeWidth="1.2" strokeLinecap="square" />
      <polyline points="130,140 138,138 132,130" fill="none" stroke="#EF9F27" strokeWidth="1.2" strokeLinecap="square" />
      {/* Center dot + ring */}
      <circle cx="100" cy="100" r="4" fill="#EF9F27" />
      <circle cx="100" cy="100" r="8" fill="none" stroke="rgba(239,159,39,0.2)" strokeWidth="0.8" />
    </svg>
  );
}

/**
 * Eigen Full — complete mark with glow, axes, dashed echo.
 * For hero sections, splash screens, about pages.
 */
export function EigenLogoFull({ size = 200, className, style }: LogoProps) {
  const uid = useId();
  const glowId = `eigen-glow-${uid}`;
  return (
    <svg
      viewBox="0 0 200 200"
      width={size}
      height={size}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      style={style}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <radialGradient id={glowId} cx="50%" cy="50%" r="50%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.06)" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
      </defs>
      {/* Ambient glow */}
      <circle cx="100" cy="100" r="80" fill={`url(#${glowId})`} />
      {/* Ghost axes */}
      <line x1="100" y1="16" x2="100" y2="184" stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
      <line x1="16" y1="100" x2="184" y2="100" stroke="rgba(255,255,255,0.04)" strokeWidth="0.5" />
      {/* Outer square */}
      <rect x="36" y="36" width="128" height="128" fill="none" stroke="#FFFFFF" strokeWidth="1.5" />
      {/* Inner dashed echo */}
      <rect x="48" y="48" width="104" height="104" fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth="0.8" strokeDasharray="6 14" />
      {/* Eigenvector */}
      <line x1="64" y1="136" x2="144" y2="60" stroke="#FFFFFF" strokeWidth="2" strokeLinecap="square" />
      {/* Arrow chevron */}
      <polyline points="134,58 144,60 138,70" fill="none" stroke="#FFFFFF" strokeWidth="1.2" strokeLinecap="square" />
      {/* Scalar ticks */}
      <circle cx="84" cy="116" r="1.2" fill="rgba(255,255,255,0.2)" />
      <circle cx="124" cy="76" r="1.2" fill="rgba(255,255,255,0.2)" />
      {/* Origin crosshair */}
      <circle cx="100" cy="100" r="3" fill="none" stroke="#FFFFFF" strokeWidth="0.8" />
      <line x1="93" y1="100" x2="89" y2="100" stroke="rgba(255,255,255,0.25)" strokeWidth="0.8" />
      <line x1="107" y1="100" x2="111" y2="100" stroke="rgba(255,255,255,0.25)" strokeWidth="0.8" />
      <line x1="100" y1="93" x2="100" y2="89" stroke="rgba(255,255,255,0.25)" strokeWidth="0.8" />
      <line x1="100" y1="107" x2="100" y2="111" stroke="rgba(255,255,255,0.25)" strokeWidth="0.8" />
    </svg>
  );
}

/**
 * EigenX Wordmark — logo + "EIGENX" text label.
 * For headers and nav bars.
 */
export function EigenXWordmark({ size = 24, className, style }: LogoProps) {
  return (
    <span
      className={className}
      style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', ...style }}
    >
      <EigenXLogo size={size} />
      <span
        style={{
          fontFamily: "'IBM Plex Mono', 'Courier New', monospace",
          fontSize: `${Math.max(11, size * 0.54)}px`,
          fontWeight: 400,
          letterSpacing: '0.22em',
          textTransform: 'uppercase' as const,
          color: '#FFFFFF',
        }}
      >
        EigenX
      </span>
    </span>
  );
}

/**
 * Eigen Wordmark — logo + "EIGEN" text label.
 */
export function EigenWordmark({ size = 24, className, style }: LogoProps) {
  return (
    <span
      className={className}
      style={{ display: 'inline-flex', alignItems: 'center', gap: '10px', ...style }}
    >
      <EigenLogo size={size} />
      <span
        style={{
          fontFamily: "'IBM Plex Mono', 'Courier New', monospace",
          fontSize: `${Math.max(11, size * 0.54)}px`,
          fontWeight: 400,
          letterSpacing: '0.22em',
          textTransform: 'uppercase' as const,
          color: '#FFFFFF',
        }}
      >
        Eigen
      </span>
    </span>
  );
}

/**
 * Online pulse dot — 7px amber circle with breathing animation.
 * Place next to a status label.
 */
export function EigenPulseDot({ className, style }: Omit<LogoProps, 'size'>) {
  usePulseDotStyle();
  return (
    <span
      className={className}
      style={{ position: 'relative', display: 'inline-flex', width: 7, height: 7, ...style }}
    >
      <span
        style={{
          position: 'absolute',
          display: 'inline-flex',
          width: '100%',
          height: '100%',
          borderRadius: '50%',
          background: '#EF9F27',
          opacity: 0.4,
          animation: 'eigen-pulse-dot 2.4s ease-in-out infinite',
        }}
      />
      <span
        style={{
          position: 'relative',
          display: 'inline-flex',
          width: 7,
          height: 7,
          borderRadius: '50%',
          background: '#EF9F27',
        }}
      />
    </span>
  );
}
