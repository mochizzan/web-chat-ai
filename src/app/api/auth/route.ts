import { NextRequest } from 'next/server';
import { z } from 'zod';
import { AuthService } from '@/services/auth.service';
import { apiSuccess, apiError } from '@/lib/api-response';

// Validation Schemas
const AuthSchema = z.discriminatedUnion('action', [
  z.object({
    action: z.literal('login'),
    email: z.string().email('Format email tidak valid'),
    password: z.string().min(3, 'Password minimal 3 karakter'),
  }),
  z.object({
    action: z.literal('register'),
    email: z.string().email('Format email tidak valid'),
    password: z.string().min(3, 'Password minimal 3 karakter'),
    name: z.string().min(2, 'Nama minimal 2 karakter'),
  }),
]);

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validation = AuthSchema.safeParse(body);
    
    if (!validation.success) {
      return apiError(validation.error.issues[0].message, 400);
    }

    const data = validation.data;
    let result;

    if (data.action === 'login') {
      result = await AuthService.login({ email: data.email, password: data.password });
    } else {
      const user = await AuthService.register({ email: data.email, name: data.name, password: data.password });
      const token = AuthService.generateToken(user);
      result = { user, token };
    }

    const response = apiSuccess(result, data.action === 'login' ? 200 : 201);

    response.cookies.set('auth_token', result.token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7,
      path: '/',
    });

    return response;
  } catch (error: unknown) {
    const err = error as Error;
    const status = err.message.includes('already exists') ? 409 : (err.message.includes('Invalid') ? 401 : 400);
    return apiError(err.message || 'Authentication error', status);
  }
}

export async function DELETE() {
  try {
    const response = apiSuccess({ message: 'Logged out successfully' }, 200);

    response.cookies.set('auth_token', '', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 0,
      path: '/',
    });

    return response;
  } catch (error: unknown) {
    const err = error as Error;
    console.error('Logout API error:', err);
    return apiError(err.message || 'Terjadi kesalahan saat logout', 500);
  }
}
