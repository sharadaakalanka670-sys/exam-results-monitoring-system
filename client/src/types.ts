export type RoleName = 'HOD' | 'LECTURER' | 'SECOND_EXAMINER' | 'AR_OFFICE' | 'HOD_CLERK' | 'DEAN';

export type WorkflowStatus =
  | 'DRAFT'
  | 'SCHEDULED'
  | 'FIRST_COLLECTION_REQUESTED'
  | 'FIRST_MARKING_ACTIVE'
  | 'SECOND_MARKING_READY'
  | 'SECOND_MARKING_ACTIVE'
  | 'SECOND_MARKING_COMPLETE'
  | 'FINAL_MARKSHEET_SUBMITTED'
  | 'FINAL_MARKSHEET_CHANGES_REQUESTED'
  | 'APPROVED_LOCKED'
  | 'CANCELLED';

export interface User {
  id: number;
  username: string;
  email: string;
  fullName: string;
  designation: string;
  phoneNumber?: string | null;
  institution?: string | null;
  roles: RoleName[];
  examinerProfileId?: number | null;
  seniorityLevel?: number | null;
  profilePictureUrl?: string | null;
}

export interface Course {
  id: number;
  courseCode: string;
  courseTitle: string;
  description?: string;
  active: boolean;
}

export interface CourseOffering {
  id: number;
  courseId: number;
  programmeGroup: string;
  batchLabel: string;
  yearOfStudy: number;
  semester: number;
  academicSessionStart: string;
  academicSessionEnd: string;
  lecturerInChargeStaffId?: number | null;
  lecturerInChargeLabel?: string | null;
  teachingType: string;
  notes?: string | null;
  sourceDocument: string;
  sourceReviewStatus: string;
  course: Course;
  lecturerInCharge?: {
    id: number;
    fullName: string;
    sourceKind: string;
    reviewStatus: string;
  } | null;
}

export interface FirstMarking {
  id: number;
  examScheduleId: number;
  scriptCount?: number | null;
  collectionRequestedAt?: string | null;
  collectedAt?: string | null;
  originalDueDate?: string | null;
  extendedDueDate?: string | null;
  returnedAt?: string | null;
  reportDocumentId?: number | null;
}

export interface SecondMarking {
  id: number;
  examScheduleId: number;
  courierDispatchedAt?: string | null;
  originalDueDate?: string | null;
  extendedDueDate?: string | null;
  acknowledgedAt?: string | null;
  reportDocumentId?: number | null;
  arReceivedAt?: string | null;
  courierReference?: string | null;
}

export interface FinalResult {
  id: number;
  examScheduleId: number;
  finalMarksheetDocumentId?: number | null;
  submissionStatus: string;
  submittedAt?: string | null;
  hodApprovalStatus: string;
  hodApprovedBy?: number | null;
  hodApprovedAt?: string | null;
  hardcopySubmittedAt?: string | null;
  revisionReason?: string | null;
}

export interface DocumentMeta {
  id: number;
  documentType: 'FIRST_MARKING_REPORT' | 'SECOND_MARKING_REPORT' | 'FINAL_MARKSHEET';
  version: number;
  originalFilename: string;
  fileSizeBytes: number;
  uploadedAt: string;
  uploadedBy: number;
}

export interface WorkflowEvent {
  id: number;
  eventType: string;
  fromStatus: string;
  toStatus: string;
  description: string;
  createdAt: string;
  actor: {
    id: number;
    fullName: string;
    designation: string;
    profilePictureUrl?: string | null;
  };
}

export interface DeadlineExtension {
  id: number;
  examScheduleId: number;
  phase: 'FIRST_MARKING' | 'SECOND_MARKING';
  requestedBy: number;
  currentDueDate: string;
  requestedDueDate: string;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewedBy?: number | null;
  reviewedAt?: string | null;
  decisionReason?: string | null;
  createdAt: string;
}

export interface ExamSchedule {
  id: number;
  courseOfferingId: number;
  examDate?: string | null;
  firstExaminerUserId?: number | null;
  secondExaminerProfileId?: number | null;
  workflowStatus: WorkflowStatus;
  workflowStartedAt?: string | null;
  lockedAt?: string | null;
  createdAt: string;
  updatedAt: string;
  courseOffering: CourseOffering;
  firstExaminer?: {
    id: number;
    fullName: string;
    email: string;
    designation: string;
    profilePictureUrl?: string | null;
    examinerProfile?: {
      seniorityLevel: number;
    } | null;
  } | null;
  secondExaminer?: {
    id: number;
    seniorityLevel: number;
    examinerType: string;
    institution: string;
    user: {
      id: number;
      fullName: string;
      email: string;
      designation: string;
      profilePictureUrl?: string | null;
    };
  } | null;
  firstMarking?: FirstMarking | null;
  secondMarking?: SecondMarking | null;
  finalResult?: FinalResult | null;
  documents?: DocumentMeta[];
  workflowEvents?: WorkflowEvent[];
  extensionRequests?: DeadlineExtension[];
  invitations?: ExaminerInvitation[];
  isOverdue?: boolean;
  firstMarkingOverdue?: boolean;
  secondMarkingOverdue?: boolean;
}

export interface ExaminerCandidate {
  id: number;
  userId: number;
  fullName: string;
  email: string;
  designation: string;
  institution: string;
  examinerType: string;
  seniorityLevel: number;
  profilePictureUrl?: string | null;
  activeSubjectCount: number;
  maxLimit: number;
  slotsFilledLabel: string;
  isSeniorEnough: boolean;
  isUnderLimit: boolean;
  isEligible: boolean;
  ineligibilityReason?: string | null;
}

export interface ExaminerInvitation {
  id: number;
  examScheduleId: number;
  requestedExaminerProfileId?: number | null;
  requestedName: string;
  requestedEmail: string;
  requestedAffiliation?: string | null;
  examinerType: string;
  requestedBy: number;
  status:
    | 'PENDING_HOD_APPROVAL'
    | 'INVITED'
    | 'ACCEPTED_PENDING_HOD'
    | 'ACCEPTED'
    | 'APPROVED'
    | 'DECLINED'
    | 'REJECTED'
    | 'EXPIRED'
    | 'CANCELLED';
  hodDecisionBy?: number | null;
  hodDecisionAt?: string | null;
  hodDecisionReason?: string | null;
  expiresAt?: string | null;
  respondedAt?: string | null;
  createdAt: string;
  examSchedule?: ExamSchedule;
  examinerProfile?: {
    id: number;
    seniorityLevel: number;
    user: {
      id: number;
      fullName: string;
      email: string;
      designation: string;
      profilePictureUrl?: string | null;
    };
  } | null;
}

export interface EmailLog {
  id: number;
  recipientUserId?: number | null;
  recipientEmail: string;
  recipientName: string;
  senderName?: string;
  senderEmail?: string;
  replyTo?: string;
  securityVerification?: string;
  subject: string;
  templateKey: string;
  contentHtml: string;
  contentText: string;
  sentAt: string;
  status: string;
  examScheduleId?: number | null;
}
