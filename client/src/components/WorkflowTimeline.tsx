import React from 'react';
import { ExamSchedule } from '../types';
import { Check, Clock, Lock, AlertTriangle, AlertCircle } from 'lucide-react';

interface Props {
  schedule: ExamSchedule;
}

const STAGE_LEVELS: Record<string, number> = {
  DRAFT: 0,
  SCHEDULED: 1,
  FIRST_COLLECTION_REQUESTED: 2,
  FIRST_MARKING_ACTIVE: 3,
  SECOND_MARKING_READY: 4,
  SECOND_MARKING_ACTIVE: 5,
  SECOND_MARKING_COMPLETE: 6,
  FINAL_MARKSHEET_SUBMITTED: 7,
  FINAL_MARKSHEET_CHANGES_REQUESTED: 7,
  APPROVED_LOCKED: 8,
};

export const WorkflowTimeline: React.FC<Props> = ({ schedule }) => {
  const currentStatus = schedule.workflowStatus || 'DRAFT';
  const level = STAGE_LEVELS[currentStatus] ?? 0;

  const hasSecondExaminer = Boolean(schedule.secondExaminerProfileId || schedule.secondExaminer);
  const firstComplete = Boolean(schedule.firstMarking?.reportDocumentId && schedule.firstMarking?.returnedAt);
  const secondComplete = Boolean(schedule.secondMarking?.reportDocumentId && schedule.secondMarking?.arReceivedAt);
  const isChangesRequested = currentStatus === 'FINAL_MARKSHEET_CHANGES_REQUESTED';
  const isLocked = currentStatus === 'APPROVED_LOCKED';

  // Step 1: Scheduled
  const step1Done = level >= 1;
  const step1Active = level === 0;

  // Step 2: Second Examiner Assigned
  const step2Done = level >= 2 || hasSecondExaminer;
  const step2Active = level === 1 && !hasSecondExaminer;

  // Step 3: First Marking & Physical Handover
  const step3Done = level >= 4 || firstComplete;
  const step3Active = level === 2 || level === 3;

  // Step 4: Second Marking & Courier
  const step4Done = level >= 6 || secondComplete;
  const step4Active = level === 4 || level === 5;

  // Step 5: Final Marksheet
  const step5Done = isLocked || (level >= 7 && !isChangesRequested);
  const step5Active = level === 6 || isChangesRequested;

  // Step 6: Approval & Lock
  const step6Done = isLocked;
  const step6Active = currentStatus === 'FINAL_MARKSHEET_SUBMITTED';

  const steps = [
    {
      title: '1. Scheduled',
      desc: schedule.examDate ? `Exam: ${schedule.examDate.split('T')[0]}` : (step1Done ? 'Exam Scheduled' : 'Draft Schedule'),
      done: step1Done,
      active: step1Active,
    },
    {
      title: '2. 2nd Examiner',
      desc: hasSecondExaminer ? (schedule.secondExaminer?.user.fullName || 'Examiner Assigned') : 'Pending Assignment',
      done: step2Done,
      active: step2Active,
    },
    {
      title: '3. 1st Marking',
      desc: step3Done
        ? 'Report & Scripts Returned'
        : level === 3
        ? 'Scripts Collected (Active)'
        : level === 2
        ? 'Collection OTP Issued'
        : 'Pending Script Handover',
      done: step3Done,
      active: step3Active,
      overdue: schedule.firstMarkingOverdue,
    },
    {
      title: '4. 2nd Marking',
      desc: step4Done
        ? 'Report & Scripts Returned to AR'
        : level === 5
        ? (schedule.secondMarking?.courierDispatchedAt ? 'In Courier Transit' : '2nd Marking Active')
        : level === 4
        ? 'Ready for Courier Dispatch'
        : 'Awaiting 1st Marking Return',
      done: step4Done,
      active: step4Active,
      overdue: schedule.secondMarkingOverdue,
    },
    {
      title: '5. Marksheet',
      desc: isChangesRequested
        ? 'Changes Requested by HOD'
        : step5Done
        ? 'Final Marksheet Submitted'
        : level === 6
        ? 'Ready to Compile Marks'
        : 'Pending 2nd Marking Return',
      done: step5Done,
      active: step5Active,
      warning: isChangesRequested,
    },
    {
      title: '6. Approval & Lock',
      desc: isLocked
        ? 'Approved & Locked by HOD'
        : step6Active
        ? 'Awaiting HOD Final Approval'
        : 'Pending Marksheet Submission',
      done: step6Done,
      active: step6Active,
      locked: isLocked,
    },
  ];

  return (
    <div className="w-full py-4">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {steps.map((step, idx) => {
          let bg = 'bg-slate-50 border-slate-200 text-slate-500';
          let badgeBg = 'bg-slate-200 text-slate-600';

          if (step.done) {
            bg = 'bg-emerald-50 border-emerald-300 text-emerald-900';
            badgeBg = 'bg-emerald-600 text-white';
          } else if (step.warning) {
            bg = 'bg-amber-50 border-amber-300 text-amber-900';
            badgeBg = 'bg-amber-500 text-white animate-pulse';
          } else if (step.active) {
            bg = step.overdue ? 'bg-rose-50 border-rose-300 text-rose-900' : 'bg-blue-50 border-blue-300 text-blue-900';
            badgeBg = step.overdue ? 'bg-rose-600 text-white' : 'bg-blue-600 text-white animate-pulse';
          }

          return (
            <div
              key={idx}
              className={`p-3 rounded-xl border flex flex-col justify-between transition-all relative ${bg}`}
            >
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-semibold tracking-wide uppercase">
                    {step.title}
                  </span>
                  <div className={`w-5 h-5 rounded-full flex items-center justify-center text-xs font-bold ${badgeBg}`}>
                    {step.locked ? (
                      <Lock className="w-3 h-3" />
                    ) : step.overdue ? (
                      <AlertTriangle className="w-3 h-3" />
                    ) : step.warning ? (
                      <AlertCircle className="w-3 h-3" />
                    ) : step.done ? (
                      <Check className="w-3 h-3" />
                    ) : step.active ? (
                      <Clock className="w-3 h-3" />
                    ) : (
                      idx + 1
                    )}
                  </div>
                </div>
                <p className="text-xs line-clamp-2">{step.desc}</p>
              </div>

              {step.overdue && (
                <span className="mt-2 text-[10px] font-bold text-rose-600 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-rose-600 animate-ping"></span>
                  PHASE OVERDUE
                </span>
              )}

              {step.warning && (
                <span className="mt-2 text-[10px] font-bold text-amber-700 flex items-center gap-1">
                  REVISION REQUIRED
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
