// Professional, simple academic vector SVG avatar generator and presets.
// Designed strictly for dignified academic use (no funny/cartoonish elements).

export interface VectorAvatarPreset {
  id: string;
  label: string;
  category: string;
  dataUri: string;
}

const encodeSvg = (svg: string): string => {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg.trim())}`;
};

// 1. Executive Suit & Tie (Deep Navy) - Ideal for HOD / Director
const svgExecutiveNavy = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%">
  <defs>
    <linearGradient id="exec-grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1e293b"/>
      <stop offset="100%" stop-color="#0f172a"/>
    </linearGradient>
  </defs>
  <circle cx="50" cy="50" r="50" fill="url(#exec-grad)"/>
  <circle cx="50" cy="50" r="48" fill="none" stroke="#334155" stroke-width="1.5"/>
  <!-- Torso & Tailored Suit -->
  <path d="M18 92 C18 72 32 64 50 64 C68 64 82 72 82 92 Z" fill="#334155"/>
  <!-- Lapels -->
  <path d="M34 64 L50 82 L66 64 L58 64 L50 74 L42 64 Z" fill="#475569"/>
  <!-- Crisp White Collar -->
  <path d="M42 64 L50 74 L58 64 L54 58 L46 58 Z" fill="#f8fafc"/>
  <!-- Necktie -->
  <polygon points="48,64 52,64 53,78 50,84 47,78" fill="#991b1b"/>
  <!-- Neck -->
  <rect x="45" y="48" width="10" height="12" rx="3" fill="#cbd5e1"/>
  <!-- Head Silhouette -->
  <circle cx="50" cy="36" r="15" fill="#f1f5f9"/>
</svg>
`;

// 2. Academic Blazer & Collar (Oxford Blue) - Ideal for Senior Lecturers
const svgAcademicBlue = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%">
  <defs>
    <linearGradient id="acad-blue" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1e3a8a"/>
      <stop offset="100%" stop-color="#172554"/>
    </linearGradient>
  </defs>
  <circle cx="50" cy="50" r="50" fill="url(#acad-blue)"/>
  <circle cx="50" cy="50" r="48" fill="none" stroke="#3b82f6" stroke-width="1.5" stroke-opacity="0.4"/>
  <!-- Torso / Blazer -->
  <path d="M18 92 C18 72 32 64 50 64 C68 64 82 72 82 92 Z" fill="#1d4ed8"/>
  <!-- White V-Neck / Shirt -->
  <path d="M38 64 L50 80 L62 64 Z" fill="#f8fafc"/>
  <!-- Inner Collar Fold -->
  <path d="M43 64 L50 73 L57 64 Z" fill="#e2e8f0"/>
  <!-- Neck -->
  <rect x="45" y="48" width="10" height="12" rx="3" fill="#cbd5e1"/>
  <!-- Head Silhouette -->
  <circle cx="50" cy="36" r="15" fill="#f8fafc"/>
</svg>
`;

// 3. Senior Scholar with Spectacles (Crimson Burgundy) - Ideal for Senior Evaluators
const svgScholarBurgundy = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%">
  <defs>
    <linearGradient id="scholar-burgundy" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#831843"/>
      <stop offset="100%" stop-color="#500724"/>
    </linearGradient>
  </defs>
  <circle cx="50" cy="50" r="50" fill="url(#scholar-burgundy)"/>
  <circle cx="50" cy="50" r="48" fill="none" stroke="#be185d" stroke-width="1.5" stroke-opacity="0.4"/>
  <!-- Torso -->
  <path d="M18 92 C18 72 32 64 50 64 C68 64 82 72 82 92 Z" fill="#9d174d"/>
  <!-- Shirt -->
  <path d="M38 64 L50 80 L62 64 Z" fill="#fdf2f8"/>
  <rect x="45" y="48" width="10" height="12" rx="3" fill="#cbd5e1"/>
  <circle cx="50" cy="36" r="15" fill="#f8fafc"/>
  <!-- Minimalist Clean Spectacles -->
  <rect x="41" y="34" width="7" height="5" rx="1.5" fill="none" stroke="#334155" stroke-width="1.5"/>
  <rect x="52" y="34" width="7" height="5" rx="1.5" fill="none" stroke="#334155" stroke-width="1.5"/>
  <line x1="48" y1="36.5" x2="52" y2="36.5" stroke="#334155" stroke-width="1.5"/>
</svg>
`;

// 4. Academic Leader (Forest Emerald) - Formal Departmental
const svgLeaderEmerald = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%">
  <defs>
    <linearGradient id="leader-em" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#064e3b"/>
      <stop offset="100%" stop-color="#022c22"/>
    </linearGradient>
  </defs>
  <circle cx="50" cy="50" r="50" fill="url(#leader-em)"/>
  <circle cx="50" cy="50" r="48" fill="none" stroke="#059669" stroke-width="1.5" stroke-opacity="0.4"/>
  <path d="M18 92 C18 72 32 64 50 64 C68 64 82 72 82 92 Z" fill="#047857"/>
  <path d="M36 64 L50 82 L64 64 Z" fill="#ecfdf5"/>
  <polygon points="48,64 52,64 53,78 50,83 47,78" fill="#065f46"/>
  <rect x="45" y="48" width="10" height="12" rx="3" fill="#cbd5e1"/>
  <circle cx="50" cy="36" r="15" fill="#f8fafc"/>
</svg>
`;

// 5. Dean of Faculty with Stole (Royal Indigo & Gold) - Ceremonial / Senior
const svgDeanViolet = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%">
  <defs>
    <linearGradient id="dean-vi" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#4c1d95"/>
      <stop offset="100%" stop-color="#2e1065"/>
    </linearGradient>
  </defs>
  <circle cx="50" cy="50" r="50" fill="url(#dean-vi)"/>
  <circle cx="50" cy="50" r="48" fill="none" stroke="#7c3aed" stroke-width="1.5" stroke-opacity="0.4"/>
  <!-- Formal Gown -->
  <path d="M18 92 C18 72 32 64 50 64 C68 64 82 72 82 92 Z" fill="#581c87"/>
  <!-- Gold Stole Band -->
  <path d="M35 64 L42 92 L47 92 L42 64 Z" fill="#d97706"/>
  <path d="M65 64 L58 92 L53 92 L58 64 Z" fill="#d97706"/>
  <rect x="45" y="48" width="10" height="12" rx="3" fill="#cbd5e1"/>
  <circle cx="50" cy="36" r="15" fill="#f8fafc"/>
</svg>
`;

// 6. Administrative Registrar (Deep Steel Teal) - Formal AR Office
const svgRegistrarTeal = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%">
  <defs>
    <linearGradient id="reg-teal" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#134e4a"/>
      <stop offset="100%" stop-color="#042f2e"/>
    </linearGradient>
  </defs>
  <circle cx="50" cy="50" r="50" fill="url(#reg-teal)"/>
  <circle cx="50" cy="50" r="48" fill="none" stroke="#14b8a6" stroke-width="1.5" stroke-opacity="0.4"/>
  <path d="M18 92 C18 72 32 64 50 64 C68 64 82 72 82 92 Z" fill="#0f766e"/>
  <path d="M36 64 L50 82 L64 64 Z" fill="#f0fdfa"/>
  <polygon points="48,64 52,64 53,78 50,83 47,78" fill="#1e3a8a"/>
  <rect x="45" y="48" width="10" height="12" rx="3" fill="#cbd5e1"/>
  <circle cx="50" cy="36" r="15" fill="#f8fafc"/>
</svg>
`;

// 7. University Lecturer (Slate Charcoal) - Clean Minimalist Professional
const svgLecturerSlate = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%">
  <defs>
    <linearGradient id="lec-slate" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#334155"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
  </defs>
  <circle cx="50" cy="50" r="50" fill="url(#lec-slate)"/>
  <circle cx="50" cy="50" r="48" fill="none" stroke="#64748b" stroke-width="1.5" stroke-opacity="0.4"/>
  <path d="M18 92 C18 72 32 64 50 64 C68 64 82 72 82 92 Z" fill="#475569"/>
  <path d="M38 64 L50 80 L62 64 Z" fill="#f8fafc"/>
  <rect x="45" y="48" width="10" height="12" rx="3" fill="#cbd5e1"/>
  <circle cx="50" cy="36" r="15" fill="#f1f5f9"/>
</svg>
`;

// 8. University Crest Monogram (Academic Seal) - Official Institutional Vector
const svgCrestMonogram = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%">
  <defs>
    <linearGradient id="crest-bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1e293b"/>
      <stop offset="100%" stop-color="#090d16"/>
    </linearGradient>
  </defs>
  <circle cx="50" cy="50" r="50" fill="url(#crest-bg)"/>
  <circle cx="50" cy="50" r="46" fill="none" stroke="#94a3b8" stroke-width="1" stroke-dasharray="2.5 2.5"/>
  <circle cx="50" cy="50" r="42" fill="none" stroke="#cbd5e1" stroke-width="1.8"/>
  <circle cx="50" cy="50" r="34" fill="#0f172a" stroke="#475569" stroke-width="1"/>
  <text x="50" y="56" text-anchor="middle" fill="#f8fafc" font-size="18" font-weight="bold" font-family="ui-serif, Georgia, Cambria, serif" letter-spacing="2">
    RUSL
  </text>
  <text x="50" y="66" text-anchor="middle" fill="#94a3b8" font-size="7" font-weight="bold" font-family="ui-sans-serif, system-ui, sans-serif" letter-spacing="1">
    FACULTY
  </text>
</svg>
`;

export const PROFESSIONAL_VECTOR_PRESETS: VectorAvatarPreset[] = [
  {
    id: 'executive-navy',
    label: 'Executive Formal (Navy & Tie)',
    category: 'Leadership',
    dataUri: encodeSvg(svgExecutiveNavy),
  },
  {
    id: 'academic-blue',
    label: 'Academic Blazer (Oxford Blue)',
    category: 'Academic',
    dataUri: encodeSvg(svgAcademicBlue),
  },
  {
    id: 'scholar-burgundy',
    label: 'Senior Scholar (Burgundy & Frames)',
    category: 'Senior Staff',
    dataUri: encodeSvg(svgScholarBurgundy),
  },
  {
    id: 'leader-emerald',
    label: 'Department Leader (Emerald & Tie)',
    category: 'Leadership',
    dataUri: encodeSvg(svgLeaderEmerald),
  },
  {
    id: 'dean-violet',
    label: 'Dean of Faculty (Gown & Stole)',
    category: 'Executive',
    dataUri: encodeSvg(svgDeanViolet),
  },
  {
    id: 'registrar-teal',
    label: 'Registrar (Steel Teal & Formal)',
    category: 'Administration',
    dataUri: encodeSvg(svgRegistrarTeal),
  },
  {
    id: 'lecturer-slate',
    label: 'University Lecturer (Slate Formal)',
    category: 'Academic',
    dataUri: encodeSvg(svgLecturerSlate),
  },
  {
    id: 'crest-monogram',
    label: 'University Crest (Official Monogram)',
    category: 'Institutional',
    dataUri: encodeSvg(svgCrestMonogram),
  },
];

// Returns a deterministic professional vector avatar for any user based on their name and role
export function getProfessionalVectorAvatar(name: string, role?: string): string {
  if (!name) return PROFESSIONAL_VECTOR_PRESETS[0].dataUri;

  const normalizedRole = (role || '').toUpperCase();
  if (normalizedRole.includes('DEAN')) {
    return PROFESSIONAL_VECTOR_PRESETS[4].dataUri; // dean-violet
  }
  if (normalizedRole.includes('HOD')) {
    return PROFESSIONAL_VECTOR_PRESETS[0].dataUri; // executive-navy
  }
  if (normalizedRole.includes('AR_OFFICE')) {
    return PROFESSIONAL_VECTOR_PRESETS[5].dataUri; // registrar-teal
  }
  if (normalizedRole.includes('CLERK')) {
    return PROFESSIONAL_VECTOR_PRESETS[6].dataUri; // lecturer-slate
  }

  // Deterministic selection among academic presets based on name hash
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const academicPresets = [
    PROFESSIONAL_VECTOR_PRESETS[1], // academic-blue
    PROFESSIONAL_VECTOR_PRESETS[2], // scholar-burgundy
    PROFESSIONAL_VECTOR_PRESETS[3], // leader-emerald
    PROFESSIONAL_VECTOR_PRESETS[6], // lecturer-slate
  ];
  const selected = academicPresets[Math.abs(hash) % academicPresets.length];
  return selected.dataUri;
}
