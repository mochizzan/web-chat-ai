'use client';

import { Link2, Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

const BASE_URL = typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com';

const ENDPOINTS = [
  {
    method: 'POST',
    path: '/v1/chat/completions',
    description: 'Chat completion dengan opsi streaming',
    color: 'text-green-500',
    bg: 'bg-green-500/10',
  },
  {
    method: 'GET',
    path: '/v1/models',
    description: 'Daftar model AI yang tersedia',
    color: 'text-blue-500',
    bg: 'bg-blue-500/10',
  },
  {
    method: 'GET',
    path: '/v1/usage',
    description: 'Statistik penggunaan API key',
    color: 'text-blue-500',
    bg: 'bg-blue-500/10',
  },
  {
    method: 'GET',
    path: '/v1/health',
    description: 'Cek status layanan',
    color: 'text-gray-500',
    bg: 'bg-gray-500/10',
  },
];

export function EndpointsTab() {
  const [copiedPath, setCopiedPath] = useState<string | null>(null);

  const copyEndpoint = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedPath(url);
      setTimeout(() => setCopiedPath(null), 2000);
    } catch {
      // silent
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Link2 className="h-5 w-5" />
          Endpoint
        </CardTitle>
        <CardDescription>
          Gunakan endpoint berikut untuk mengakses API Gateway. Semua endpoint memerlukan autentikasi Bearer token.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Base URL */}
        <div className="rounded-lg border bg-muted/30 px-3 py-2">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider">Base URL</span>
          <div className="flex items-center justify-between gap-2 mt-0.5">
            <code className="text-sm font-mono text-muted-foreground/80 truncate">{BASE_URL}</code>
            <button
              onClick={() => copyEndpoint(BASE_URL)}
              className="shrink-0 text-muted-foreground hover:text-foreground transition-colors"
              title="Salin Base URL"
            >
              {copiedPath === BASE_URL ? (
                <Check className="h-4 w-4 text-green-500" />
              ) : (
                <Copy className="h-4 w-4" />
              )}
            </button>
          </div>
        </div>

        {/* Endpoint Paths */}
        <div className="space-y-2">
          <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider px-1">Endpoints</span>
          {ENDPOINTS.map((ep) => {
            const fullUrl = `${BASE_URL}${ep.path}`;
            return (
              <div
                key={ep.path}
                className="flex items-center justify-between rounded-lg border p-3 transition-all hover:bg-accent/30"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Badge variant="outline" className={`${ep.color} ${ep.bg} border-0 font-mono text-[11px]`}>
                    {ep.method}
                  </Badge>
                  <div className="min-w-0">
                    <code className="text-sm font-mono truncate block">
                      <span className="text-foreground">{ep.path}</span>
                    </code>
                    <p className="text-[11px] text-muted-foreground mt-0.5">{ep.description}</p>
                  </div>
                </div>
                <button
                  onClick={() => copyEndpoint(fullUrl)}
                  className="shrink-0 ml-3 text-muted-foreground hover:text-foreground transition-colors"
                  title="Salin URL"
                >
                  {copiedPath === fullUrl ? (
                    <Check className="h-4 w-4 text-green-500" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </button>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
