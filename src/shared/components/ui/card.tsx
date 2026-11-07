type CardProps = {
  children: ReactNode;
  className?: string;
  as?: 'section' | 'div' | 'article';
};

export function Card({
  children,
  className = '',
  as: Tag = 'section',
}: CardProps) {
  return (
    <Tag className={`rounded-lg border border-gray-200 bg-white shadow-sm ${className}`}>
      {children}
    </Tag>
  );
}