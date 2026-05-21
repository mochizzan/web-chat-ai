'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import type { Model, SpeedTier, DiscountType, ModelStatus } from '@/lib/store';

interface EditModelDialogProps {
  model: Model | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (modelId: string, updates: Partial<Model>) => Promise<void>;
}

export function EditModelDialog({ model, open, onOpenChange, onSave }: EditModelDialogProps) {
  const [formData, setFormData] = useState<Partial<Model>>({});

  useEffect(() => {
    if (model) {
      setFormData({
        name: model.name,
        provider: model.provider,
        description: model.description,
        status: model.status,
        maxContext: model.maxContext,
        thinking: model.thinking,
        inputPrice: model.inputPrice,
        outputPrice: model.outputPrice,
        free: model.free,
        speed: model.speed,
        discountPercent: model.discountPercent,
        discountType: model.discountType,
      });
    }
  }, [model]);

  const handleSave = async () => {
    if (!model) return;
    await onSave(model.id, formData);
    onOpenChange(false);
  };

  const updateField = <K extends keyof Model>(field: K, value: Model[K]) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  if (!model) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Model: {model.name}</DialogTitle>
        </DialogHeader>

        <div className="grid gap-6 py-4">
          {/* Basic Info */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-muted-foreground border-b pb-2">Informasi Dasar</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nama Model</Label>
                <Input
                  id="name"
                  value={formData.name || ''}
                  onChange={(e) => updateField('name', e.target.value)}
                  placeholder="Nama model"
                  className="bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="provider">Provider</Label>
                <Input
                  id="provider"
                  value={formData.provider || ''}
                  onChange={(e) => updateField('provider', e.target.value)}
                  placeholder="Provider"
                  className="bg-background"
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Deskripsi</Label>
              <Input
                id="description"
                value={formData.description || ''}
                onChange={(e) => updateField('description', e.target.value)}
                placeholder="Deskripsi model"
                className="bg-background"
              />
            </div>
          </div>

          {/* Status & Configuration */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-muted-foreground border-b pb-2">Status & Konfigurasi</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value: ModelStatus) => updateField('status', value)}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Pilih status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="maintenance">Maintenance</SelectItem>
                    <SelectItem value="disabled">Disabled</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="speed">Kecepatan</Label>
                <Select
                  value={formData.speed}
                  onValueChange={(value: SpeedTier) => updateField('speed', value)}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Pilih kecepatan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fast">Cepat</SelectItem>
                    <SelectItem value="normal">Normal</SelectItem>
                    <SelectItem value="slow">Lambat</SelectItem>
                    <SelectItem value="overloaded">Overload</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center gap-6 pt-2">
              <div className="flex items-center gap-3">
                <Switch
                  id="free"
                  checked={formData.free}
                  onCheckedChange={(checked) => updateField('free', checked)}
                />
                <Label htmlFor="free" className="cursor-pointer">Model Gratis</Label>
              </div>
              <div className="flex items-center gap-3">
                <Switch
                  id="thinking"
                  checked={formData.thinking}
                  onCheckedChange={(checked) => updateField('thinking', checked)}
                />
                <Label htmlFor="thinking" className="cursor-pointer">Support Thinking</Label>
              </div>
            </div>
          </div>

          {/* Pricing */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-muted-foreground border-b pb-2">Harga (per 1M tokens)</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="inputPrice">Harga Input ($)</Label>
                <Input
                  id="inputPrice"
                  type="number"
                  step="0.0001"
                  min="0"
                  value={formData.inputPrice ?? 0}
                  onChange={(e) => updateField('inputPrice', parseFloat(e.target.value) || 0)}
                  className="bg-background"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="outputPrice">Harga Output ($)</Label>
                <Input
                  id="outputPrice"
                  type="number"
                  step="0.0001"
                  min="0"
                  value={formData.outputPrice ?? 0}
                  onChange={(e) => updateField('outputPrice', parseFloat(e.target.value) || 0)}
                  className="bg-background"
                />
              </div>
            </div>
          </div>

          {/* Context */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-muted-foreground border-b pb-2">Konteks</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="maxContext">Max Context (tokens)</Label>
                <Input
                  id="maxContext"
                  type="number"
                  min="0"
                  value={formData.maxContext ?? 0}
                  onChange={(e) => updateField('maxContext', parseInt(e.target.value) || 0)}
                  className="bg-background"
                />
              </div>
            </div>
          </div>

          {/* Discount */}
          <div className="space-y-4">
            <h4 className="text-sm font-semibold text-muted-foreground border-b pb-2">Diskon</h4>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="discountType">Tipe Diskon</Label>
                <Select
                  value={formData.discountType}
                  onValueChange={(value: DiscountType) => updateField('discountType', value)}
                >
                  <SelectTrigger className="bg-background">
                    <SelectValue placeholder="Pilih tipe" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Tidak Ada</SelectItem>
                    <SelectItem value="input">Input Only</SelectItem>
                    <SelectItem value="output">Output Only</SelectItem>
                    <SelectItem value="both">Input & Output</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="discountPercent">Persentase Diskon (%)</Label>
                <Input
                  id="discountPercent"
                  type="number"
                  min="0"
                  max="100"
                  value={formData.discountPercent ?? 0}
                  onChange={(e) => updateField('discountPercent', parseInt(e.target.value) || 0)}
                  className="bg-background"
                />
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Batal
          </Button>
          <Button onClick={handleSave}>
            Simpan Perubahan
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
