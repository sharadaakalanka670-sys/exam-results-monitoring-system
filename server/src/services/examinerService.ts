import { queryOne, query } from '../config/db';

export interface SeniorityValidationResult {
  valid: boolean;
  message?: string;
  firstSeniority?: number;
  secondSeniority?: number;
}

export interface LoadValidationResult {
  valid: boolean;
  activeCount: number;
  maxLimit: number;
  message?: string;
}

export class ExaminerService {
  // checks second examiner is senior to first examiner
  // higher number = more senior grade
  static async validateSeniority(
    firstExaminerUserId: number,
    secondExaminerProfileId: number
  ): Promise<SeniorityValidationResult> {
    // Fetch First Examiner profile
    const firstExaminer = await queryOne<any>(
      `SELECT ep.id, ep.seniority_level AS seniorityLevel,
              ep.designation_or_grade AS designationOrGrade,
              u.designation AS userDesignation
       FROM examiner_profiles ep
       INNER JOIN users u ON ep.user_id = u.id
       WHERE ep.user_id = ?`,
      [firstExaminerUserId]
    );

    if (!firstExaminer) {
      return {
        valid: false,
        message: 'First examiner does not have an active verified academic profile.'
      };
    }

    // Fetch Second Examiner profile
    const secondExaminer = await queryOne<any>(
      `SELECT ep.id, ep.seniority_level AS seniorityLevel,
              ep.designation_or_grade AS designationOrGrade,
              ep.is_active AS isActive,
              u.designation AS userDesignation
       FROM examiner_profiles ep
       INNER JOIN users u ON ep.user_id = u.id
       WHERE ep.id = ?`,
      [secondExaminerProfileId]
    );

    if (!secondExaminer) {
      return {
        valid: false,
        message: 'Second examiner profile not found.'
      };
    }

    if (!secondExaminer.isActive) {
      return {
        valid: false,
        message: 'Second examiner profile is inactive.'
      };
    }

    const firstLevel = firstExaminer.seniorityLevel;
    const secondLevel = secondExaminer.seniorityLevel;
    const firstDesig = firstExaminer.designationOrGrade || firstExaminer.userDesignation || 'First Examiner';
    const secondDesig = secondExaminer.designationOrGrade || secondExaminer.userDesignation || 'Second Examiner';

    if (secondLevel <= firstLevel) {
      return {
        valid: false,
        firstSeniority: firstLevel,
        secondSeniority: secondLevel,
        message: `Academic rank validation failed: The Second Examiner (${secondDesig}) must hold a senior academic rank to the First Examiner (${firstDesig}).`
      };
    }

    return {
      valid: true,
      firstSeniority: firstLevel,
      secondSeniority: secondLevel
    };
  }

  // check if lecturer already has 3 active exams assigned
  static async validateLoadLimit(
    examinerProfileId: number,
    excludeScheduleId?: number
  ): Promise<LoadValidationResult> {
    let sql = `
      SELECT COUNT(*) AS total
      FROM exam_schedules
      WHERE second_examiner_profile_id = ?
        AND workflow_status NOT IN ('APPROVED_LOCKED', 'CANCELLED')
    `;
    const params: any[] = [examinerProfileId];

    if (excludeScheduleId) {
      sql += ' AND id != ?';
      params.push(excludeScheduleId);
    }

    const row = await queryOne<{ total: number }>(sql, params);
    const activeCount = row?.total || 0;
    const maxLimit = 3;

    if (activeCount >= maxLimit) {
      return {
        valid: false,
        activeCount,
        maxLimit,
        message: `Load limit exceeded: Candidate already has ${activeCount}/${maxLimit} active assigned subjects.`
      };
    }

    return {
      valid: true,
      activeCount,
      maxLimit
    };
  }

  // fetch list of potential 2nd examiners and check if they qualify
  static async getCandidates(firstExaminerUserId?: number) {
    let firstLevel = 0;
    let firstDesig = '';
    if (firstExaminerUserId) {
      const firstProf = await queryOne<any>(
        `SELECT ep.seniority_level AS seniorityLevel,
                ep.designation_or_grade AS designationOrGrade,
                u.designation AS userDesignation
         FROM examiner_profiles ep
         INNER JOIN users u ON ep.user_id = u.id
         WHERE ep.user_id = ?`,
        [firstExaminerUserId]
      );
      if (firstProf) {
        firstLevel = firstProf.seniorityLevel;
        firstDesig = firstProf.designationOrGrade || firstProf.userDesignation || 'First Examiner';
      }
    }

    const rows = await query<any>(
      `SELECT ep.id, ep.user_id AS userId, ep.institution, ep.examiner_type AS examinerType,
              ep.seniority_level AS seniorityLevel, ep.designation_or_grade AS designationOrGrade,
              u.full_name AS fullName, u.email, u.designation AS userDesignation,
              u.profile_picture_url AS profilePictureUrl,
              COUNT(CASE WHEN s.id IS NOT NULL AND s.workflow_status NOT IN ('APPROVED_LOCKED', 'CANCELLED') THEN 1 END) AS activeSubjectCount
       FROM examiner_profiles ep
       INNER JOIN users u ON ep.user_id = u.id
       LEFT JOIN exam_schedules s ON s.second_examiner_profile_id = ep.id
       WHERE ep.is_active = TRUE
       GROUP BY ep.id, u.id
       ORDER BY ep.seniority_level DESC`
    );

    return rows.map((p: any) => {
      const activeCount = parseInt(p.activeSubjectCount || '0', 10);
      const isSeniorEnough = firstExaminerUserId ? p.seniorityLevel > firstLevel : true;
      const isUnderLimit = activeCount < 3;
      const isEligible = isSeniorEnough && isUnderLimit;

      return {
        id: p.id,
        userId: p.userId,
        fullName: p.fullName,
        email: p.email,
        designation: p.designationOrGrade || p.userDesignation,
        profilePictureUrl: p.profilePictureUrl || null,
        institution: p.institution,
        examinerType: p.examinerType,
        seniorityLevel: p.seniorityLevel,
        activeSubjectCount: activeCount,
        maxLimit: 3,
        slotsFilledLabel: `${activeCount}/3 slots filled`,
        isSeniorEnough,
        isUnderLimit,
        isEligible,
        ineligibilityReason: !isSeniorEnough
          ? `Academic rank is not senior to First Examiner (${firstDesig || 'First Examiner'})`
          : !isUnderLimit
          ? 'Capacity reached (3/3 active subjects)'
          : null
      };
    });
  }
}
