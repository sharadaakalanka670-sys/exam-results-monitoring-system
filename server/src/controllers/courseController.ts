import { Request, Response } from 'express';
import { query, queryOne, execute } from '../config/db';

export class CourseController {
  static async listCourses(_req: Request, res: Response): Promise<void> {
    try {
      const courses = await query<any>(
        `SELECT id, course_code AS courseCode, course_title AS courseTitle,
                description, credits, active
         FROM courses 
         WHERE active = TRUE 
         ORDER BY course_code ASC`
      );

      // Fetch offerings for these courses
      const offerings = await query<any>(
        `SELECT co.id, co.course_id AS courseId, co.programme_group AS programmeGroup,
                co.batch_label AS batchLabel, co.year_of_study AS yearOfStudy,
                co.semester, co.teaching_type AS teachingType, co.notes,
                sd.id AS lic_id, sd.full_name AS lic_fullName
         FROM course_offerings co
         LEFT JOIN staff_directory sd ON co.lecturer_in_charge_staff_id = sd.id`
      );

      const offeringsByCourse = new Map<number, any[]>();
      for (const off of offerings) {
        const list = offeringsByCourse.get(off.courseId) || [];
        list.push({
          id: off.id,
          programmeGroup: off.programmeGroup,
          batchLabel: off.batchLabel,
          yearOfStudy: off.yearOfStudy,
          semester: off.semester,
          teachingType: off.teachingType,
          notes: off.notes,
          lecturerInCharge: off.lic_id
            ? {
                id: off.lic_id,
                fullName: off.lic_fullName,
              }
            : null,
        });
        offeringsByCourse.set(off.courseId, list);
      }

      const results = courses.map((c: any) => ({
        ...c,
        active: Boolean(c.active),
        offerings: offeringsByCourse.get(c.id) || [],
      }));

      res.json(results);
    } catch (err: any) {
      res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
    }
  }

  static async listOfferings(req: Request, res: Response): Promise<void> {
    try {
      const { programmeGroup, batchLabel, semester } = req.query;

      const conditions: string[] = [];
      const params: any[] = [];

      if (programmeGroup) {
        conditions.push('co.programme_group = ?');
        params.push(String(programmeGroup));
      }
      if (batchLabel) {
        conditions.push('co.batch_label = ?');
        params.push(String(batchLabel));
      }
      if (semester) {
        conditions.push('co.semester = ?');
        params.push(parseInt(String(semester), 10));
      }

      const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

      const rows = await query<any>(
        `SELECT co.id, co.course_id AS courseId, co.programme_group AS programmeGroup,
                co.batch_label AS batchLabel, co.year_of_study AS yearOfStudy,
                co.semester, co.teaching_type AS teachingType, co.notes,
                co.academic_session_start AS academicSessionStart, co.academic_session_end AS academicSessionEnd,
                co.source_document AS sourceDocument, co.source_review_status AS sourceReviewStatus,
                c.id AS c_id, c.course_code AS c_courseCode, c.course_title AS c_courseTitle,
                c.description AS c_description, NULL AS c_credits, c.active AS c_active,
                sd.id AS lic_id, sd.full_name AS lic_fullName
         FROM course_offerings co
         LEFT JOIN courses c ON co.course_id = c.id
         LEFT JOIN staff_directory sd ON co.lecturer_in_charge_staff_id = sd.id
         ${whereClause}
         ORDER BY co.year_of_study ASC, co.semester ASC, c.course_code ASC`,
        params
      );

      // Fetch active exam schedules for these offerings
      const offeringIds = rows.map((r: any) => r.id);
      let schedulesByOffering = new Map<number, any[]>();

      if (offeringIds.length > 0) {
        const scheduleRows = await query<any>(
          `SELECT id, course_offering_id AS courseOfferingId, workflow_status AS workflowStatus, exam_date AS examDate
           FROM exam_schedules
           WHERE course_offering_id IN (${offeringIds.map(() => '?').join(',')})`,
          offeringIds
        );

        for (const s of scheduleRows) {
          const list = schedulesByOffering.get(s.courseOfferingId) || [];
          list.push({
            id: s.id,
            workflowStatus: s.workflowStatus,
            examDate: s.examDate,
          });
          schedulesByOffering.set(s.courseOfferingId, list);
        }
      }

      const results = rows.map((r: any) => ({
        id: r.id,
        courseId: r.courseId,
        programmeGroup: r.programmeGroup,
        batchLabel: r.batchLabel,
        yearOfStudy: r.yearOfStudy,
        semester: r.semester,
        teachingType: r.teachingType,
        notes: r.notes,
        academicSessionStart: r.academicSessionStart,
        academicSessionEnd: r.academicSessionEnd,
        sourceDocument: r.sourceDocument,
        sourceReviewStatus: r.sourceReviewStatus,
        course: r.c_id
          ? {
              id: r.c_id,
              courseCode: r.c_courseCode,
              courseTitle: r.c_courseTitle,
              description: r.c_description,
              credits: r.c_credits,
              active: Boolean(r.c_active),
            }
          : null,
        lecturerInCharge: r.lic_id
          ? {
              id: r.lic_id,
              fullName: r.lic_fullName,
            }
          : null,
        examSchedules: schedulesByOffering.get(r.id) || [],
      }));

      res.json(results);
    } catch (err: any) {
      res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
    }
  }

  static async createCourse(req: Request, res: Response): Promise<void> {
    try {
      const { courseCode, courseTitle, description } = req.body;

      if (!courseCode || !courseTitle) {
        res.status(400).json({ error: 'BAD_REQUEST', message: 'Course code and title are required' });
        return;
      }

      const cleanCode = courseCode.trim().toUpperCase();

      const existing = await queryOne<any>(
        `SELECT id FROM courses WHERE course_code = ?`,
        [cleanCode]
      );

      if (existing) {
        res.status(400).json({ error: 'BAD_REQUEST', message: `Course code ${cleanCode} already exists.` });
        return;
      }

      const insertRes = await execute(
        `INSERT INTO courses (course_code, course_title, description, active)
         VALUES (?, ?, ?, TRUE)`,
        [cleanCode, courseTitle.trim(), description ? description.trim() : null]
      );

      const created = await queryOne<any>(
        `SELECT id, course_code AS courseCode, course_title AS courseTitle, description, credits, active
         FROM courses WHERE id = ?`,
        [insertRes.insertId]
      );

      res.status(201).json(created);
    } catch (err: any) {
      res.status(500).json({ error: 'SERVER_ERROR', message: err.message });
    }
  }
}
