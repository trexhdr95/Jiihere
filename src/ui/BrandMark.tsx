// Stylized recreation of the Jinan Haidar / Jiihere shield-and-laurel crest.
// Navy shield with a serif "J" monogram, a graduation cap on top, and gold
// laurel branches flanking. Sized to work cleanly from ~32 px upward.

export interface BrandMarkProps {
  size?: number;
  /** Override for where the mark sits on a dark background (sidebar) vs light. */
  onDark?: boolean;
  className?: string;
}

export function BrandMark({ size = 48, onDark = false, className }: BrandMarkProps) {
  const shieldFill = onDark ? '#ffffff' : '#172554';
  const shieldInk = onDark ? '#172554' : '#ffffff';
  const gold = '#d4af37';
  const goldLight = '#f5c64a';
  const capFill = onDark ? '#0b1730' : '#0b1730';

  return (
    <svg
      role="img"
      aria-label="Jiihere"
      viewBox="0 0 80 96"
      width={size}
      height={(size * 96) / 80}
      className={className}
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Laurel — two symmetric gold branches around the shield.
          Each branch is a curved backbone plus ~5 leaf shapes. */}
      <g fill={gold} stroke={gold} strokeLinecap="round" strokeLinejoin="round">
        {/* Left branch backbone */}
        <path
          d="M18 24 Q6 34 6 56 Q8 74 22 84"
          fill="none"
          strokeWidth="2"
        />
        {/* Left leaves */}
        <ellipse cx="10" cy="32" rx="4.5" ry="2" transform="rotate(-35 10 32)" />
        <ellipse cx="6" cy="42" rx="4.5" ry="2" transform="rotate(-60 6 42)" />
        <ellipse cx="6" cy="54" rx="4.5" ry="2" transform="rotate(-90 6 54)" />
        <ellipse cx="9" cy="66" rx="4.5" ry="2" transform="rotate(-115 9 66)" />
        <ellipse cx="16" cy="78" rx="4.5" ry="2" transform="rotate(-140 16 78)" />

        {/* Right branch backbone */}
        <path
          d="M62 24 Q74 34 74 56 Q72 74 58 84"
          fill="none"
          strokeWidth="2"
        />
        {/* Right leaves */}
        <ellipse cx="70" cy="32" rx="4.5" ry="2" transform="rotate(35 70 32)" />
        <ellipse cx="74" cy="42" rx="4.5" ry="2" transform="rotate(60 74 42)" />
        <ellipse cx="74" cy="54" rx="4.5" ry="2" transform="rotate(90 74 54)" />
        <ellipse cx="71" cy="66" rx="4.5" ry="2" transform="rotate(115 71 66)" />
        <ellipse cx="64" cy="78" rx="4.5" ry="2" transform="rotate(140 64 78)" />
      </g>

      {/* Connector ribbon at bottom */}
      <path
        d="M20 84 Q40 92 60 84"
        fill="none"
        stroke={goldLight}
        strokeWidth="2"
        strokeLinecap="round"
      />

      {/* Shield */}
      <path
        d="M22 28 L58 28 Q62 28 62 32 L62 58 Q62 72 40 82 Q18 72 18 58 L18 32 Q18 28 22 28 Z"
        fill={shieldFill}
      />

      {/* Subtle highlight stroke on shield */}
      <path
        d="M22 28 L58 28 Q62 28 62 32 L62 58 Q62 72 40 82 Q18 72 18 58 L18 32 Q18 28 22 28 Z"
        fill="none"
        stroke={gold}
        strokeWidth="1.5"
      />

      {/* J monogram */}
      <text
        x="40"
        y="62"
        textAnchor="middle"
        fill={shieldInk}
        fontFamily="Georgia, 'Times New Roman', serif"
        fontSize="30"
        fontWeight="700"
      >
        J
      </text>

      {/* Graduation cap */}
      <g fill={capFill}>
        {/* Mortarboard (flat top) */}
        <polygon points="40,6 18,14 40,22 62,14" />
        {/* Crown */}
        <path d="M30 16 L30 22 Q30 26 40 26 Q50 26 50 22 L50 16 L40 20 Z" />
      </g>
      {/* Tassel */}
      <g stroke={gold} strokeWidth="1.5" fill={gold} strokeLinecap="round">
        <line x1="58" y1="14" x2="58" y2="24" />
        <circle cx="58" cy="26" r="2" strokeWidth="0" />
      </g>
      {/* Button on cap top */}
      <circle cx="58" cy="14" r="1.5" fill={goldLight} />
    </svg>
  );
}
