// src/components/IconPlaceholder.jsx
//
// Temporary placeholder for icons until real assets are imported.
// Renders a small grey square with optional letter or label inside.
// Replace usages with proper SVG icons (Lucide, Heroicons, etc.) when ready.

function IconPlaceholder({ label = '', size = 'sm' }) {
  const dimensions = {
    sm: 'w-4 h-4 text-[10px]',
    md: 'w-6 h-6 text-xs',
    lg: 'w-12 h-12 text-sm',
    xl: 'w-16 h-16 text-base',
  }[size];

  return (
    <span
      className={`inline-flex items-center justify-center ${dimensions} bg-gray-200 text-gray-500 rounded font-medium`}
      aria-hidden="true"
    >
      {label}
    </span>
  );
}

export default IconPlaceholder;