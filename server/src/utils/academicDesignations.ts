export interface AcademicDesignation {
  label: string;
  rank: number;
}

export const ACADEMIC_DESIGNATIONS: AcademicDesignation[] = [
  { label: 'Senior Professor / Chair Professor', rank: 14 },
  { label: 'Professor', rank: 12 },
  { label: 'Associate Professor', rank: 10 },
  { label: 'Senior Lecturer Grade I', rank: 8 },
  { label: 'Senior Lecturer Grade II', rank: 6 },
  { label: 'Senior Lecturer', rank: 6 },
  { label: 'Lecturer (Confirmed)', rank: 5 },
  { label: 'Lecturer', rank: 5 },
  { label: 'Visiting Lecturer', rank: 5 },
  { label: 'Lecturer (Probationary)', rank: 4 },
  { label: 'Assistant Lecturer / Temporary Lecturer', rank: 2 },
  { label: 'Academic Staff', rank: 4 },
  { label: 'Assistant Registrar', rank: 4 },
  { label: 'HOD Clerk', rank: 2 },
];

export function getRankFromDesignation(designation?: string): number {
  if (!designation) return 4;
  const d = designation.trim().toLowerCase();
  if (d.includes('senior professor') || d.includes('chair professor')) return 14;
  if (d.includes('associate professor')) return 10;
  if (d.includes('professor')) return 12;
  if (d.includes('grade i') || d.includes('grade 1')) return 8;
  if (d.includes('grade ii') || d.includes('grade 2') || d.includes('senior lecturer')) return 6;
  if (d.includes('probationary')) return 4;
  if (d.includes('assistant lecturer') || d.includes('temporary')) return 2;
  if (d.includes('visiting') || d.includes('external')) return 5;
  if (d.includes('lecturer')) return 5;
  return 4;
}
