export type ModelStatus = 'active' | 'maintenance' | 'disabled';

export interface ModelWS {
  id: string;
  status: ModelStatus;
  inputPrice: number;
  outputPrice: number;
  free: boolean;
  speed?: string;
  discountPercent?: number;
  discountType?: string;
}

export type WSEvent =
  | { type: 'model:update'; model: ModelWS }
  | { type: 'model:delete'; modelId: string }
  | { type: 'model:create'; model: ModelWS }
  | { type: 'models:synced'; count: number }
  | { type: 'credit:update'; userId: string; newBalance: number }
  | { type: 'user:update'; user: { id: string; role: string; credit: number } }
  | { type: 'response:initial_sync'; models?: ModelWS[]; user?: { id: string; role: string }; credit?: number }
  | { type: 'models:changed' }
  | { type: 'ping' }
  | { type: 'pong' };
