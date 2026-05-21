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

  async syncModels(models: any[]): Promise<void> {
    // Using a transaction for bulk sync to ensure consistency
    const { transaction } = await import('@/lib/db');
    
    await transaction(async (conn) => {
      for (const model of models) {
        await conn.execute(
          `INSERT INTO models (id, name, provider, description, status, max_context, thinking, input_price, output_price, free, speed, discount_percent, discount_type, sync_data) 
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) 
           ON DUPLICATE KEY UPDATE 
           name=VALUES(name), provider=VALUES(provider), description=VALUES(description), status=VALUES(status), 
           max_context=VALUES(max_context), thinking=VALUES(thinking), input_price=VALUES(input_price), 
           output_price=VALUES(output_price), free=VALUES(free), speed=VALUES(speed), 
           discount_percent=VALUES(discount_percent), discount_type=VALUES(discount_type), sync_data=VALUES(sync_data)`,
          [
            model.id, model.name, model.provider, model.description, model.status || 'disabled',
            model.max_context, model.thinking, model.input_price, model.output_price, model.free,
            model.speed, model.discount_percent, model.discount_type, JSON.stringify(model.sync_data)
          ]
        );
      }
    });
  }
};
