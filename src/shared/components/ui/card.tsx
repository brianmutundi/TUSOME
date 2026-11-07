import React from 'react';

export function Card({
  children,
  className = '',
  as: Tag = 'section',
}: {
  children: React.ReactNode;
  className?: string;
  as?: 'section' | 'div' | 'article';
}) {
  return (
    <Tag className={`rounded-lg border border-gray-200 bg-white shadow-sm ${className}`}>
      {children}
    </Tag>
  );
}