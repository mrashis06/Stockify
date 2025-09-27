
"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { DialogFooter } from '@/components/ui/dialog';
import type { AddBrandFormValues } from './add-brand-dialog';
import { IndianRupee } from 'lucide-react';

type ReviewStepProps = {
  formData: AddBrandFormValues;
  isAddingAnother: boolean;
  onEdit: () => void;
  onConfirm: (addAnother: boolean) => void;
  onCancel: () => void;
};

const ReviewField = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex justify-between items-center py-2 border-b border-dashed">
    <p className="text-sm font-medium text-muted-foreground">{label}</p>
    <p className="text-sm font-semibold">{value}</p>
  </div>
);

export default function AddBrandReviewStep({ formData, isAddingAnother, onEdit, onConfirm, onCancel }: ReviewStepProps) {
  return (
    <div className="space-y-6">
      <Card className="border-none shadow-none">
        <CardContent className="p-0 space-y-3">
          <ReviewField label="Brand Name" value={formData.brand} />
          <ReviewField label="Size" value={formData.size} />
          <ReviewField label="Category" value={formData.category} />
          <ReviewField 
            label="Price" 
            value={
              <span className="flex items-center">
                <IndianRupee className="h-4 w-4 mr-1" />
                {formData.price.toLocaleString('en-IN')}
              </span>
            } 
          />
          <ReviewField label="Initial Stock" value={`${formData.prevStock} units`} />
        </CardContent>
      </Card>
      <DialogFooter className="flex-col sm:flex-row gap-2">
        <Button onClick={onCancel} variant="outline" className="w-full sm:w-auto">Cancel</Button>
        <Button onClick={onEdit} variant="secondary" className="w-full sm:w-auto">Edit Details</Button>
        {isAddingAnother ? (
            <Button onClick={() => onConfirm(true)} className="w-full sm:w-auto bg-green-600 hover:bg-green-700">Confirm & Add Another</Button>
        ) : (
            <Button onClick={() => onConfirm(false)} className="w-full sm:w-auto bg-green-600 hover:bg-green-700">Confirm & Save</Button>
        )}
      </DialogFooter>
    </div>
  );
}
