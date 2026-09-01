// ============================================================
// رِفق — مكونات مشتركة صغيرة (عرض فقط — لا منطق هنا)
// ============================================================

import type { ReactNode } from 'react';

interface CardProps {
  title?: string;
  icon?: string;
  children: ReactNode;
  className?: string;
}

export function Card({ title, icon, children, className }: CardProps) {
  return (
    <section className={`card${className ? ` ${className}` : ''}`}>
      {title && (
        <h3 className="card-title">
          {icon ? `${icon} ` : ''}
          {title}
        </h3>
      )}
      {children}
    </section>
  );
}

interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'soft' | 'ghost' | 'danger';
  disabled?: boolean;
  type?: 'button' | 'submit';
  ariaLabel?: string;
}

export function Button({ children, onClick, variant = 'primary', disabled, type = 'button', ariaLabel }: ButtonProps) {
  return (
    <button
      type={type}
      className={`btn btn-${variant}`}
      onClick={onClick}
      disabled={disabled}
      aria-label={ariaLabel}
    >
      {children}
    </button>
  );
}

export function Chip({ children }: { children: ReactNode }) {
  return <span className="chip">{children}</span>;
}

export function EmptyState({ icon = '🌿', children }: { icon?: string; children: ReactNode }) {
  return (
    <div className="empty-state">
      <span className="empty-icon">{icon}</span>
      <p>{children}</p>
    </div>
  );
}