/* eslint-disable @typescript-eslint/no-explicit-any */
import { query, querySimple } from '@/lib/db';
import { Model } from '@/types';

export const ModelRepository = {
  async getModels(filters: { all?: boolean; provider?: string }): Promise<Model[]> {
    let sql = 'SELECT * FROM models';
    const params: any[] = [];
    const conditions: string[] = [];

    if (!filters.all) {
      conditions.push("status IN ('active', 'maintenance')");
    }
    if (filters.provider) {
      conditions.push('provider = ?');
      params.push(filters.provider);
    }

    if (conditions.length > 0) {
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    sql += " ORDER BY FIELD(status, 'active', 'maintenance', 'disabled'), provider, name";

    return await query<Model[]>(sql, params);
  },

  async getModelById(id: string): Promise<Model | null> {
    return await querySimple<Model>('SELECT * FROM models WHERE id = ?', [id]);
  },

  async updateModel(id: string, updates: Partial<Model>): Promise<void> {
    const fields: string[] = [];
    const params: any[] = [];

    for (const [key, value] of Object.entries(updates)) {
      if (value !== undefined) {
        fields.push(`${key} = ?`);
        params.push(value);
      }
    }

    if (fields.length === 0) return;

    params.push(id);
    await query(`UPDATE models SET ${fields.join(', ')} WHERE id = ?`, params);
  },

  async deleteModel(id: string): Promise<void> {
    await query('DELETE FROM models WHERE id = ?', [id]);
  },

  async getActiveModels(): Promise<Model[]> {
    return await query<Model[]>('SELECT * FROM models WHERE status = ?', ['active']);
  },

  async updateModelPricing(modelId: string, pricing: { input_price: number, output_price: number }): Promise<void> {
    await query(
      'UPDATE models SET input_price = ?, output_price = ? WHERE id = ?',
      [pricing.input_price, pricing.output_price, modelId]
    );
  },

  async updateModelStatus(modelId: string, status: string): Promise<void> {
    await query('UPDATE models SET status = ? WHERE id = ?', [status, modelId]);
  },

  async syncModels(models: any[]): Promise<{ created: number; updated: number; disabled: number }> {
    // Helper: convert undefined → null (MySQL Prepared Statements strict on undefined)
    const safe = (v: any): any => (v === undefined ? null : v);

    // Using a transaction for bulk sync to ensure consistency
    const { transaction, query } = await import('@/lib/db');

    // Fetch all existing models from DB for diff comparison
    const existingModels = await query<{ id: string; status: string }[]>(
      'SELECT id, status FROM models'
    );
    const existingMap = new Map(existingModels.map((m) => [m.id, m]));
    // Only include valid models (with id and name) in remoteIds
    // so models that are skipped don't incorrectly appear as "still in remote"
    const validModels = models.filter(m => m.id != null && m.name != null);
    const remoteIds = new Set(validModels.map((m) => m.id));

    let created = 0, updated = 0, disabled = 0;

    await transaction(async (conn) => {
      // 1. Disable models that exist in DB but are NOT in the remote pull
      for (const existing of existingModels) {
        if (!remoteIds.has(existing.id) && existing.status === 'active') {
          await conn.execute(
            'UPDATE models SET status = ? WHERE id = ?',
            ['disabled', existing.id]
          );
          disabled++;
        }
      }

      
            // 2. Insert/Update models from remote with proper null-safety
            for (const model of validModels) {
              // Skip models that are missing required fields: id and name
              // (This check is now redundant but kept for safety)
              if (model.id == null || model.name == null) {
                console.warn('[ModelService] Skipping model due to missing id or name', model);
                continue;
              }
        const isExisting = existingMap.has(model.id);

        // FIX: store entire model object as sync_data if sync_data field not explicitly provided
        const syncDataValue = model.sync_data !== undefined
          ? JSON.stringify(model.sync_data)
          : JSON.stringify(model);

        await conn.execute(
          `INSERT INTO models (id, name, provider, description, status, max_context, thinking, input_price, output_price, free, speed, discount_percent, discount_type, sync_data)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
           ON DUPLICATE KEY UPDATE
             name = VALUES(name),
             provider = VALUES(provider),
             description = VALUES(description),
             max_context = VALUES(max_context),
             thinking = VALUES(thinking),
             speed = VALUES(speed),
             sync_data = VALUES(sync_data)`,
          // NOTE: status, input_price, output_price, free, discount_percent, discount_type
          // are intentionally excluded from ON DUPLICATE KEY UPDATE — these are admin-controlled settings
          [
            safe(model.id),
            safe(model.name),
            safe(model.provider),
            safe(model.description),
            model.status || 'disabled',
            safe(model.max_context) ?? 128000,
            safe(model.thinking) ?? 0,
            safe(model.input_price) ?? 0,
            safe(model.output_price) ?? 0,
            safe(model.free) ?? 0,
            model.speed || 'normal',
            safe(model.discount_percent) ?? 0,
            model.discount_type || 'none',
            syncDataValue,
          ]
        );

        isExisting ? updated++ : created++;
      }
    });

    return { created, updated, disabled };
  }
};