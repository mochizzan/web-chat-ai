'use client';

import React from 'react';
import Link from 'next/link';

export default function NotFound() {
  return (
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
      <h1 style={{ fontSize: '4rem', marginBottom: '1rem' }}>404</h1>
      <p style={{ fontSize: '1.5rem', marginBottom: '2rem' }}>Halaman tidak ditemukan</p>
      <Link
        href="/"
        style={{
          padding: '10px 20px',
          backgroundColor: '#0070f3',
          color: 'white',
          textDecoration: 'none',
          borderRadius: '5px'
        }}
      >
        Kembali ke Beranda
      </Link>
    </div>
  );
}
