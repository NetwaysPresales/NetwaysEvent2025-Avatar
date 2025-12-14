/**
 * Card Component
 * 
 * Modular, reusable card component for content containers.
 */

import React from 'react';

export interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: 'none' | 'sm' | 'md' | 'lg';
  variant?: 'default' | 'outlined' | 'elevated';
}

export const Card: React.FC<CardProps> = ({
  children,
  className = '',
  padding = 'md',
  variant = 'default',
}) => {
  const baseClasses = 'rounded-2xl transition-all';
  
  const variantClasses = {
    default: 'bg-[var(--bg-secondary)]',
    outlined: 'bg-[var(--bg-secondary)] border border-[var(--border-color)]',
    elevated: 'bg-[var(--bg-secondary)] shadow-lg',
  };

  const paddingClasses = {
    none: '',
    sm: 'p-4',
    md: 'p-6',
    lg: 'p-8',
  };

  return (
    <div className={`${baseClasses} ${variantClasses[variant]} ${paddingClasses[padding]} ${className}`}>
      {children}
    </div>
  );
};

