import { ImageResponse } from 'next/og';

// Same mark as icon.svg. iOS adds its own rounded corners, so the square is full-bleed.
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div style={{ width: '100%', height: '100%', display: 'flex', background: '#0052FF' }}>
        <svg width="180" height="180" viewBox="0 0 64 64">
          <path
            d="M17 45V31a7.5 7.5 0 0 1 15 0v14M32 31a7.5 7.5 0 0 1 15 0v14"
            fill="none"
            stroke="#fff"
            strokeWidth="6"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    ),
    { ...size }
  );
}
