'use client';

import React from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html>
      <body>
        <div style={{ 
          display: 'flex', 
          flexDirection: 'column', 
          alignItems: 'center', 
          justifyContent: 'center', 
          height: '100vh', 
          fontFamily: 'sans-serif',
          textAlign: 'center',
          padding: '20px'
        }}>
          <h1>Something went wrong!</h1>
          <p>{error.message || 'An unexpected error occurred.'}</p>
          <button 
            onClick={() => reset()}
            style={{ 
              marginTop: '20px', 
              padding: '10px 20px', 
              cursor: 'pointer',
              backgroundColor: '#0070f3',
              color: 'white',
              border: 'none',
              borderRadius: '5px'
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
