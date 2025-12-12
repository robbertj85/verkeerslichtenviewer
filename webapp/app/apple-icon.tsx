import { ImageResponse } from 'next/og'

export const runtime = 'edge'

export const size = {
  width: 180,
  height: 180,
}
export const contentType = 'image/png'

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#f3f4f6',
          borderRadius: '40px',
        }}
      >
        <svg
          width="140"
          height="140"
          viewBox="0 0 32 32"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect x="8" y="1" width="16" height="30" rx="8" fill="#374151" />
          <rect x="10" y="3" width="12" height="26" rx="6" fill="#1f2937" />
          <circle cx="16" cy="8" r="4" fill="#ef4444" />
          <circle cx="16" cy="16" r="4" fill="#eab308" />
          <circle cx="16" cy="24" r="4" fill="#22c55e" />
        </svg>
      </div>
    ),
    {
      ...size,
    }
  )
}
