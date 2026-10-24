import React from 'react';

// Props kept backward-compatible with all parent components
interface Props {
  name: string;
  imageUrl?: string | null;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  seniorityLevel?: number | null;
  className?: string;
  subtitle?: string;
}

const sizeClasses = {
  xs: 'w-6 h-6',
  sm: 'w-8 h-8',
  md: 'w-10 h-10',
  lg: 'w-12 h-12',
  xl: 'w-16 h-16',
};

// Common academic profile picture SVG used for all profiles system-wide
export const CommonProfileSvg: React.FC<{ className?: string }> = ({ className = 'w-full h-full select-none' }) => (
  <svg
    viewBox="0 0 100 100"
    className={className}
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
  >
    {/* Base academic maroon circle */}
    <circle cx="50" cy="50" r="50" fill="#800000" />
    <circle cx="50" cy="50" r="48" fill="none" stroke="#991b1b" strokeWidth="1.5" strokeOpacity="0.4" />
    {/* Torso & Shoulders Silhouette */}
    <path
      d="M20 90 C20 70 34 62 50 62 C66 62 80 70 80 90 Z"
      fill="#ffffff"
      fillOpacity="0.92"
    />
    {/* Academic tie/collar detail */}
    <polygon points="46,62 54,62 52,73 50,76 48,73" fill="#cbd5e1" />
    {/* Head Silhouette */}
    <circle cx="50" cy="37" r="16" fill="#ffffff" fillOpacity="0.96" />
  </svg>
);

export const LecturerAvatar: React.FC<Props> = ({
  name,
  size = 'sm',
  className = '',
  subtitle,
}) => {
  return (
    <div
      className={`relative inline-block shrink-0 ${className}`}
      title={subtitle ? `${name} (${subtitle})` : name}
    >
      <div
        className={`${sizeClasses[size]} rounded-full overflow-hidden border-2 border-white shadow-xs ring-1 ring-slate-200/80 bg-slate-100 flex items-center justify-center`}
      >
        <CommonProfileSvg />
      </div>
    </div>
  );
};
