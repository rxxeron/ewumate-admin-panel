import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from './ui/Dialog';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { AlertCircle } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'default' | 'destructive';
  requireTypedConfirmation?: string;
}

export function ConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  title,
  description,
  confirmText = 'Confirm',
  cancelText = 'Cancel',
  variant = 'default',
  requireTypedConfirmation
}: ConfirmModalProps) {
  const [typedValue, setTypedValue] = useState('');

  const isDestructive = variant === 'destructive';
  const isConfirmDisabled = requireTypedConfirmation 
    ? typedValue !== requireTypedConfirmation
    : false;

  const handleConfirm = () => {
    if (!isConfirmDisabled) {
      onConfirm();
      setTypedValue('');
      onClose();
    }
  };

  const handleClose = () => {
    setTypedValue('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            {isDestructive && <AlertCircle className="w-5 h-5 text-destructive" />}
            {title}
          </DialogTitle>
          <DialogDescription className="whitespace-pre-wrap mt-2">
            {description}
          </DialogDescription>
        </DialogHeader>

        {requireTypedConfirmation && (
          <div className="my-4">
            <p className="text-sm font-medium mb-2 text-foreground">
              Please type <span className="font-mono bg-muted px-1 py-0.5 rounded select-all">{requireTypedConfirmation}</span> to confirm.
            </p>
            <Input 
              value={typedValue}
              onChange={(e) => setTypedValue(e.target.value)}
              placeholder={requireTypedConfirmation}
              className="font-mono"
            />
          </div>
        )}

        <DialogFooter className="mt-6">
          <Button variant="outline" onClick={handleClose}>
            {cancelText}
          </Button>
          <Button 
            variant={variant} 
            onClick={handleConfirm}
            disabled={isConfirmDisabled}
          >
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
