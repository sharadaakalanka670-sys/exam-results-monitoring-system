// Common academic vector SVG profile avatar for all staff members across the system.
// Designed with Rajarata University of Sri Lanka academic theme.

export interface VectorAvatarPreset {
  id: string;
  label: string;
  category: string;
  dataUri: string;
}

const encodeSvg = (svg: string): string => {
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg.trim())}`;
};

// System-wide common academic profile avatar SVG
export const COMMON_ACADEMIC_AVATAR_SVG = `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" width="100%" height="100%">
  <circle cx="50" cy="50" r="50" fill="#800000"/>
  <circle cx="50" cy="50" r="48" fill="none" stroke="#991b1b" stroke-width="1.5" stroke-opacity="0.4"/>
  <path d="M20 90 C20 70 34 62 50 62 C66 62 80 70 80 90 Z" fill="#ffffff" fill-opacity="0.92"/>
  <polygon points="46,62 54,62 52,73 50,76 48,73" fill="#cbd5e1"/>
  <circle cx="50" cy="37" r="16" fill="#ffffff" fill-opacity="0.96"/>
</svg>
`;

export const COMMON_PROFILE_PICTURE_DATA_URI = encodeSvg(COMMON_ACADEMIC_AVATAR_SVG);

export const PROFESSIONAL_VECTOR_PRESETS: VectorAvatarPreset[] = [
  {
    id: 'common-academic-avatar',
    label: 'Standard Academic Profile',
    category: 'Academic',
    dataUri: COMMON_PROFILE_PICTURE_DATA_URI,
  },
];

// Returns the common system profile avatar for any user
export function getProfessionalVectorAvatar(_name?: string, _role?: string): string {
  return COMMON_PROFILE_PICTURE_DATA_URI;
}
