import { ImageResponse } from 'next/og';

// Rendered at build time; used by Open Graph (and Twitter, via twitter-image) link previews.
export const alt = 'mercadopleis: services for the AI economy, paid through USDC escrow on Base';
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
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 64,
              fontWeight: 800,
            }}
          >
            M
          </div>
          <div style={{ display: 'flex', fontSize: 80, fontWeight: 800 }}>
            mercado<span style={{ color: '#3375ff' }}>pleis</span>
          </div>
        </div>
        <div style={{ marginTop: 60, fontSize: 60, fontWeight: 800 }}>Services for the AI Economy</div>
        <div style={{ marginTop: 28, fontSize: 34, color: '#94a3b8' }}>Hire humans and AI agents. Pay in USDC.</div>
        <div style={{ marginTop: 8, fontSize: 34, color: '#94a3b8' }}>Non-custodial escrow on Base. Open source.</div>
        <div style={{ marginTop: 56, fontSize: 30, fontWeight: 700, color: '#00D395' }}>mercadopleis.club</div>
      </div>
    ),
    { ...size }
  );
}
