'use client';

import { BookOpen, Code2, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

const BASE_URL = typeof window !== 'undefined' ? window.location.origin : 'https://your-domain.com';

const SECTIONS = [
  {
    title: 'Autentikasi',
    description: 'Semua request ke API Gateway memerlukan API key yang dikirim sebagai Bearer token.',
    code: `curl -X POST ${BASE_URL}/v1/chat/completions \\
  -H "Authorization: Bearer mi-xxxxxxxxxxxxxxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "gpt-4o",
    "messages": [
      { "role": "user", "content": "Halo!" }
    ]
  }'`,
  },
  {
    title: 'Chat Completion (Streaming)',
    description: 'Untuk streaming response, tambahkan parameter stream: true. Response akan dikirim sebagai Server-Sent Events (SSE).',
    code: `curl -X POST ${BASE_URL}/v1/chat/completions \\
  -H "Authorization: Bearer mi-xxxxxxxxxxxxxxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "gpt-4o",
    "messages": [
      { "role": "user", "content": "Ceritakan tentang AI" }
    ],
    "stream": true
  }'`,
  },
  {
    title: 'Chat Completion (Non-Streaming)',
    description: 'Hilangkan parameter stream atau set ke false untuk mendapatkan response lengkap sekaligus.',
    code: `curl -X POST ${BASE_URL}/v1/chat/completions \\
  -H "Authorization: Bearer mi-xxxxxxxxxxxxxxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "gpt-4o",
    "messages": [
      { "role": "user", "content": "Halo!" }
    ],
    "stream": false
  }'

// Response:
// {
//   "id": "chatcmpl-xxx",
//   "object": "chat.completion",
//   "created": 1717000000,
//   "model": "gpt-4o",
//   "choices": [
//     {
//       "index": 0,
//       "message": {
//         "role": "assistant",
//         "content": "Halo! Ada yang bisa saya bantu?"
//       },
//       "finish_reason": "stop"
//     }
//   ],
//   "usage": {
//     "prompt_tokens": 10,
//     "completion_tokens": 15,
//     "total_tokens": 25
//   }
// }`,
  },
  {
    title: 'Daftar Model',
    description: 'Mengambil daftar model yang tersedia dan aktif.',
    code: `curl -X GET ${BASE_URL}/v1/models \\
  -H "Authorization: Bearer mi-xxxxxxxxxxxxxxxxxxxx"

// Response:
// {
//   "object": "list",
//   "data": [
//     {
//       "id": "milabs/deepseek-v4-flash",
//       "object": "model",
//       "created": 1700000000,
//       "owned_by": "milabs"
//     }
//   ]
// }`,
  },
  {
    title: 'Model ID',
    description: 'Cara menggunakan model ID yang tersedia di platform kami. Setiap model memiliki format milabs/{nama-model-ai}.',
    code: `// Format model ID:
//   milabs/{nama-model-ai}
//
// Contoh model yang tersedia:
//   - milabs/deepseek-v4-flash
//   - milabs/gpt-4o
//   - milabs/claude-3-opus
//
// Cara penggunaan dalam request:
curl -X POST ${BASE_URL}/v1/chat/completions \\
  -H "Authorization: Bearer mi-xxxxxxxxxxxxxxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "model": "milabs/deepseek-v4-flash",
    "messages": [
      { "role": "user", "content": "Halo! Siapa kamu?" }
    ]
  }'

// Tips:
// - Gunakan endpoint GET /v1/models untuk melihat daftar model terbaru
// - Model ID bersifat case-sensitive, tulis persis seperti yang terdaftar
// - Beberapa model mungkin hanya tersedia untuk tier akun tertentu`,
  },
];

export function DocsTab() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BookOpen className="h-5 w-5" />
            Dokumentasi API
          </CardTitle>
          <CardDescription>
            API Gateway kami kompatibel dengan OpenAI API format. Anda bisa menggunakan library OpenAI client yang sudah ada.
          </CardDescription>
        </CardHeader>
      </Card>

      {SECTIONS.map((section, i) => (
        <Card key={i}>
          <CardHeader>
            <CardTitle className="text-base">{section.title}</CardTitle>
            <CardDescription>{section.description}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="relative rounded-lg bg-muted/50 p-4 overflow-x-auto">
              <div className="absolute top-3 right-3 flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <Code2 className="h-3 w-3" />
                Shell
              </div>
              <pre className="text-xs leading-relaxed whitespace-pre font-mono text-foreground/90">
                <code>{section.code}</code>
              </pre>
            </div>
          </CardContent>
        </Card>
      ))}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ExternalLink className="h-5 w-5" />
            Referensi
          </CardTitle>
          <CardDescription>
            Dokumentasi ini mengikuti format OpenAI API. Lihat dokumentasi OpenAI untuk referensi lebih lanjut.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <a
            href="https://platform.openai.com/docs/api-reference/chat/create"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
          >
            <ExternalLink className="h-4 w-4" />
            OpenAI Chat Completion API Reference
          </a>
        </CardContent>
      </Card>
    </div>
  );
}
