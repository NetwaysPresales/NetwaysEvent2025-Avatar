/**
 * Delete Profile Confirmation Component
 * 
 * Confirmation dialog for profile deletion
 */

'use client';

import React from 'react';
import { useTheme } from '@/hooks/useTheme';
import { Button } from '@/components/ui';

interface DeleteProfileConfirmationProps {
  profileName: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export const DeleteProfileConfirmation: React.FC<DeleteProfileConfirmationProps> = ({
  profileName,
  onConfirm,
  onCancel,
}) => {
  const theme = useTheme();
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div
        className={`${
          theme === 'light' ? 'bg-white border-zinc-300' : 'bg-zinc-900 border-zinc-800'
        } border rounded-2xl shadow-2xl max-w-md w-full p-6`}
      >
        <h3 className={`text-xl font-medium mb-2 ${theme === 'light' ? 'text-zinc-900' : 'text-zinc-100'}`}>
          Delete Profile
        </h3>
        <p className={`text-sm mb-6 ${theme === 'light' ? 'text-zinc-600' : 'text-zinc-400'}`}>
          Are you sure you want to delete &quot;{profileName}&quot;? This action cannot be undone.
        </p>
        <div className="flex gap-3">
          <Button variant="secondary" onClick={onCancel} className="flex-1">
            Cancel
          </Button>
          <Button variant="danger" onClick={onConfirm} className="flex-1">
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
};

