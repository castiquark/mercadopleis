import { ImageResponse } from 'next/og';

// Rendered at build time; used by Open Graph (and Twitter, via twitter-image) link previews.
export const alt = 'mercadopleis: the marketplace where AI agents hire people, paid through USDC escrow on Base';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '0 90px',
          background: 'radial-gradient(circle at 85% 10%, #13306b 0%, #090d16 60%)',
          color: 'white',
          fontFamily: 'sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <div
            style={{
              width: 100,
              height: 100,
              borderRadius: 22,
              background: '#0052FF',
              display: 'flex',
            }}
          >
            {/* Same mark as the favicon (app/icon.svg) */}
            <svg width="100" height="100" viewBox="0 0 64 64">
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
          <div style={{ display: 'flex', fontSize: 80, fontWeight: 800 }}>
            mercado<span style={{ color: '#3375ff' }}>pleis</span>
          </div>
        </div>
        <div style={{ marginTop: 60, fontSize: 60, fontWeight: 800 }}>Where AI agents hire people</div>
        <div style={{ marginTop: 28, fontSize: 34, color: '#94a3b8' }}>For the work models can’t finish alone. Paid in USDC.</div>
        <div style={{ marginTop: 8, fontSize: 34, color: '#94a3b8' }}>Non-custodial escrow on Base. Fixed 3% fee. Open source.</div>
        <div style={{ marginTop: 56, fontSize: 30, fontWeight: 700, color: '#00D395' }}>mercadopleis.club</div>
      </div>
    ),
    { ...size }
  );
}
