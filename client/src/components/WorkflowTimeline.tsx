import React from 'react';
import { ExamSchedule } from '../types';
import { Check, Clock, Lock, AlertTriangle } from 'lucide-react';

interface Props {
  schedule: ExamSchedule;
}

export const WorkflowTimeline: React.FC<Props> = ({ schedule }) => {
  const isScheduled = schedule.workflowStatus !== 'DRAFT';
  const hasSecondExaminer = Boolean(schedule.secondExaminerProfileId);
  const firstCollected = Boolean(schedule.firstMarking?.collectedAt);
  const firstReport = Boolean(schedule.firstMarking?.reportDocumentId);
  const firstReturned = Boolean(schedule.firstMarking?.returnedAt);
  const firstComplete = firstReport && firstReturned;

  const courierDispatched = Boolean(schedule.secondMarking?.courierDispatchedAt);
  const secondReport = Boolean(schedule.secondMarking?.reportDocumentId);
  const arReceived = Boolean(schedule.secondMarking?.arReceivedAt);
  const secondComplete = secondReport && arReceived;

  const marksheetSubmitted = schedule.finalResult?.submissionStatus === 'SUBMITTED' || schedule.finalResult?.submissionStatus === 'APPROVED';
  const isLocked = schedule.workflowStatus === 'APPROVED_LOCKED';

  const steps = [
    {
      title: '1. Scheduled',
      desc: schedule.examDate ? `Exam: ${schedule.examDate.split('T')[0]}` : 'Draft',
      done: isScheduled,
      active: schedule.workflowStatus === 'SCHEDULED',
    },
    {
      title: '2. 2nd Examiner',
      desc: hasSecondExaminer ? (schedule.secondExaminer?.user.fullName || 'Assigned') : 'Pending Assignment',
      done: hasSecondExaminer,
      active: isScheduled && !hasSecondExaminer,
    },
    {
      title: '3. 1st Marking',
      desc: firstComplete
        ? 'Report & Scripts Returned'
        : firstCollected
        ? 'Scripts Collected (Active)'
        : 'Pending Script Collection',
      done: firstComplete,
      active: schedule.workflowStatus === 'FIRST_MARKING_ACTIVE' || schedule.workflowStatus === 'FIRST_COLLECTION_REQUESTED',
      overdue: schedule.firstMarkingOverdue,
    },
    {
      title: '4. 2nd Marking',
      desc: secondComplete
        ? 'Report & Scripts Received'
        : courierDispatched
        ? 'Courier In Transit'
        : 'Pending Courier',
      done: secondComplete,
      active: schedule.workflowStatus === 'SECOND_MARKING_ACTIVE' || schedule.workflowStatus === 'SECOND_MARKING_READY',
      overdue: schedule.secondMarkingOverdue,
    },
    {
      title: '5. Marksheet',
      desc: marksheetSubmitted ? 'Submitted for Review' : 'Pending Submission',
      done: marksheetSubmitted,
      active: schedule.workflowStatus === 'SECOND_MARKING_COMPLETE' || schedule.workflowStatus === 'FINAL_MARKSHEET_SUBMITTED',
    },
    {
      title: '6. Approval & Lock',
      desc: isLocked ? 'Approved & Locked' : 'Pending HOD Approval',
      done: isLocked,
      active: schedule.workflowStatus === 'FINAL_MARKSHEET_SUBMITTED',
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
            </div>
          );
        })}
      </div>
    </div>
  );
};
