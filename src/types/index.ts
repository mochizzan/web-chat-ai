/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Global Types for AI Chat Web
 * Based on Database Schema and API Requirements
 */

export type UserRole = 'admin' | 'user';

export interface User {
  id: string;
  email: string;
  name: string;
  password?: string; // Optional for security when returning user data
  role: UserRole;
  avatar?: string | null;
  credit: number;
  total_spent: number;
  api_key?: string | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface Conversation {
  id: string;
  user_id: string;
  title: string;
  model: string;
  category: string;
  pinned: number; // 0 or 1 in MySQL
  created_at: Date | string;
  updated_at: Date | string;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  thinking_content?: string | null;
  input_tokens: number;
  output_tokens: number;
  input_cost: number;
  output_cost: number;
  total_cost: number;
  created_at: Date | string;
}

export interface UsageLog {
  id: string;
  user_id: string;
  conversation_id?: string | null;
  message_id?: string | null;
  model_id: string;
  model_name: string;
  provider: string;
  input_tokens: number;
  output_tokens: number;
  input_cost: number;
  output_cost: number;
  total_cost: number;
  category: string;
  created_at: Date | string;
}

export type CreditLogType = 'topup' | 'usage' | 'deduct' | 'admin_set' | 'admin_adjust';

export interface CreditLog {
  id: string;
  user_id: string;
  type: CreditLogType;
  amount: number;
  balance: number;
  description?: string | null;
  created_at: Date | string;
}

export interface Model {
  id: string;
  name: string;
  provider: string;
  description?: string | null;
  status: string;
  max_context: number;
  thinking: number; // 0 or 1
  input_price: number;
  output_price: number;
  free: number; // 0 or 1
  speed: string;
  discount_percent: number;
  discount_type: string;
  sync_source: string;
  sync_data?: any | null;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface AnalyticsSummary {
  total_users: number;
  total_conversations: number;
  total_messages: number;
  total_revenue: number;
  total_spent: number;
  active_users_24h: number;
  top_models: {
    model_id: string;
    count: number;
    cost: number;
  }[];
  usage_trend: {
    date: string;
    count: number;
    cost: number;
  }[];
}
