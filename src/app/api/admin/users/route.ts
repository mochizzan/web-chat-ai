import { NextRequest } from 'next/server';
import { verifyAuth } from '@/lib/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { AdminService } from '@/services/admin.service';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  console.log(`[${new Date().toISOString()}] [AdminUsersAPI] GET: Starting user list request`, {
    page: 1,
    limit: 10,
    search: ''
  });
  
  try {
    const auth = verifyAuth(request);
    if (!auth) {
      console.log(`[${new Date().toISOString()}] [AdminUsersAPI] GET: Unauthorized request`);
      return apiError('Unauthorized', 401);
    }
    if (auth.role !== 'admin') {
      console.log(`[${new Date().toISOString()}] [AdminUsersAPI] GET: Forbidden - non-admin user`, { userId: auth.userId });
      return apiError('Forbidden: Admin only', 403);
    }

    const { searchParams } = new URL(request.url);
    const page = parseInt(searchParams.get('page') || '1');
    const limit = parseInt(searchParams.get('limit') || '10');
    const search = searchParams.get('search') || '';

    console.log(`[${new Date().toISOString()}] [AdminUsersAPI] GET: Calling AdminService.listUsers`, { page, limit, search });
    const { users, total } = await AdminService.listUsers(page, limit, search);
    console.log(`[${new Date().toISOString()}] [AdminUsersAPI] GET: Successfully retrieved users`, {
      count: users.length,
      total,
      timeTaken: `${Date.now() - startTime}ms`
    });

    return apiSuccess({
      users,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    const errMsg = error instanceof Error ? `${error.message}\n${error.stack}` : String(error);
    console.error(`[${new Date().toISOString()}] [AdminUsersAPI] GET: Error fetching users`, { error: errMsg, timeTaken: `${Date.now() - startTime}ms` });
    return apiError('Failed to fetch users', 500);
  }
}

export async function PUT(request: NextRequest) {
  const startTime = Date.now();
  console.log(`[${new Date().toISOString()}] [AdminUsersAPI] PUT: Starting user role update request`);
  
  try {
    const auth = verifyAuth(request);
    if (!auth) {
      console.log(`[${new Date().toISOString()}] [AdminUsersAPI] PUT: Unauthorized request`);
      return apiError('Unauthorized', 401);
    }
    if (auth.role !== 'admin') {
      console.log(`[${new Date().toISOString()}] [AdminUsersAPI] PUT: Forbidden - non-admin user`, { userId: auth.userId });
      return apiError('Forbidden: Admin only', 403);
    }

    const body = await request.json();
    const { id, role } = body;

    if (!id) {
      console.log(`[${new Date().toISOString()}] [AdminUsersAPI] PUT: Missing user ID`, { timeTaken: `${Date.now() - startTime}ms` });
      return apiError('User ID is required', 400);
    }
    if (!role) {
      console.log(`[${new Date().toISOString()}] [AdminUsersAPI] PUT: Missing role`, { timeTaken: `${Date.now() - startTime}ms` });
      return apiError('Role is required', 400);
    }

    console.log(`[${new Date().toISOString()}] [AdminUsersAPI] PUT: Calling AdminService.updateUserRole`, { userId: id, role });
    await AdminService.updateUserRole(id, role);
    console.log(`[${new Date().toISOString()}] [AdminUsersAPI] PUT: Successfully updated user role`, { userId: id, timeTaken: `${Date.now() - startTime}ms` });

    return apiSuccess({ success: true });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] [AdminUsersAPI] PUT: Error updating user role`, { error: String(error), timeTaken: `${Date.now() - startTime}ms` });
    return apiError('Failed to update user', 500);
  }
}

export async function POST(request: NextRequest) {
  const startTime = Date.now();
  console.log(`[${new Date().toISOString()}] [AdminUsersAPI] POST: Starting credit adjustment request`);
  
  try {
    const auth = verifyAuth(request);
    if (!auth) {
      console.log(`[${new Date().toISOString()}] [AdminUsersAPI] POST: Unauthorized request`);
      return apiError('Unauthorized', 401);
    }
    if (auth.role !== 'admin') {
      console.log(`[${new Date().toISOString()}] [AdminUsersAPI] POST: Forbidden - non-admin user`, { userId: auth.userId });
      return apiError('Forbidden: Admin only', 403);
    }

    const body = await request.json();
    const { userId, amount } = body;

    if (!userId || amount === undefined) {
      console.log(`[${new Date().toISOString()}] [AdminUsersAPI] POST: Missing required fields`, { userId: userId || 'undefined', amount, timeTaken: `${Date.now() - startTime}ms` });
      return apiError('User ID and amount are required', 400);
    }

    console.log(`[${new Date().toISOString()}] [AdminUsersAPI] POST: Calling AdminService.adjustUserCredit`, { userId, amount, reason: 'Admin adjustment' });
    await AdminService.adjustUserCredit(userId, Number(amount), 'Admin adjustment');
    console.log(`[${new Date().toISOString()}] [AdminUsersAPI] POST: Successfully adjusted user credit`, { userId, amount, timeTaken: `${Date.now() - startTime}ms` });

    return apiSuccess({ success: true });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] [AdminUsersAPI] POST: Error adjusting user credit`, { error: String(error), timeTaken: `${Date.now() - startTime}ms` });
    return apiError('Operation failed', 500);
  }
}

export async function DELETE(request: NextRequest) {
  const startTime = Date.now();
  console.log(`[${new Date().toISOString()}] [AdminUsersAPI] DELETE: Starting user deletion request`);
  
  try {
    const auth = verifyAuth(request);
    if (!auth) {
      console.log(`[${new Date().toISOString()}] [AdminUsersAPI] DELETE: Unauthorized request`);
      return apiError('Unauthorized', 401);
    }
    if (auth.role !== 'admin') {
      console.log(`[${new Date().toISOString()}] [AdminUsersAPI] DELETE: Forbidden - non-admin user`, { userId: auth.userId });
      return apiError('Forbidden: Admin only', 403);
    }

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      console.log(`[${new Date().toISOString()}] [AdminUsersAPI] DELETE: Missing user ID`, { timeTaken: `${Date.now() - startTime}ms` });
      return apiError('User ID is required', 400);
    }
    if (id === 'admin') {
      console.log(`[${new Date().toISOString()}] [AdminUsersAPI] DELETE: Attempted to delete admin account`, { timeTaken: `${Date.now() - startTime}ms` });
      return apiError('Cannot delete admin account', 403);
    }

    console.log(`[${new Date().toISOString()}] [AdminUsersAPI] DELETE: Calling AdminService.deleteUser`, { userId: id });
    const { AdminService } = await import('@/services/admin.service');
    await AdminService.deleteUser(id);
    console.log(`[${new Date().toISOString()}] [AdminUsersAPI] DELETE: Successfully deleted user`, { userId: id, timeTaken: `${Date.now() - startTime}ms` });

    return apiSuccess({ success: true });
  } catch (error) {
    console.error(`[${new Date().toISOString()}] [AdminUsersAPI] DELETE: Error deleting user`, { error: String(error), timeTaken: `${Date.now() - startTime}ms` });
    return apiError('Failed to delete user', 500);
  }
}
