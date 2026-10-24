import React from 'react';
import { WorkflowStatus } from '../types';
import { Lock, AlertCircle, Clock, CheckCircle2, FileText, Send, Truck } from 'lucide-react';

interface Props {
  status: WorkflowStatus;
  isOverdue?: boolean;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<Props> = ({ status, isOverdue, size = 'md' }) => {
  const pad = size === 'sm' ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs font-medium';

  if (isOverdue) {
    return (
      <span className={`inline-flex items-center gap-1 rounded-full bg-rose-100 text-rose-800 border border-rose-300 animate-pulse ${pad}`}>
        <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
        <span>OVERDUE</span>
      </span>
    );
  }

  switch (status) {
    case 'DRAFT':
      return (
        <span className={`inline-flex items-center gap-1 rounded-full bg-slate-100 text-slate-700 border border-slate-300 ${pad}`}>
          <Clock className="w-3.5 h-3.5 text-slate-500" />
          <span>Draft Schedule</span>
        </span>
      );
    case 'SCHEDULED':
      return (
        <span className={`inline-flex items-center gap-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200 ${pad}`}>
          <Clock className="w-3.5 h-3.5 text-blue-600" />
          <span>Scheduled</span>
        </span>
      );
    case 'FIRST_COLLECTION_REQUESTED':
      return (
        <span className={`inline-flex items-center gap-1 rounded-full bg-amber-50 text-amber-800 border border-amber-300 ${pad}`}>
          <Clock className="w-3.5 h-3.5 text-amber-600" />
          <span>OTP Requested</span>
        </span>
      );
    case 'FIRST_MARKING_ACTIVE':
      return (
        <span className={`inline-flex items-center gap-1 rounded-full bg-blue-100 text-blue-800 border border-blue-300 ${pad}`}>
          <FileText className="w-3.5 h-3.5 text-blue-600" />
          <span>1st Marking Active</span>
        </span>
      );
    case 'SECOND_MARKING_READY':
      return (
        <span className={`inline-flex items-center gap-1 rounded-full bg-indigo-50 text-indigo-800 border border-indigo-200 ${pad}`}>
          <Truck className="w-3.5 h-3.5 text-indigo-600" />
          <span>Ready for Courier</span>
        </span>
      );
    case 'SECOND_MARKING_ACTIVE':
      return (
        <span className={`inline-flex items-center gap-1 rounded-full bg-purple-100 text-purple-800 border border-purple-300 ${pad}`}>
          <FileText className="w-3.5 h-3.5 text-purple-600" />
          <span>2nd Marking Active</span>
        </span>
      );
    case 'SECOND_MARKING_COMPLETE':
      return (
        <span className={`inline-flex items-center gap-1 rounded-full bg-cyan-100 text-cyan-800 border border-cyan-300 ${pad}`}>
          <CheckCircle2 className="w-3.5 h-3.5 text-cyan-600" />
          <span>2nd Marking Done</span>
        </span>
      );
    case 'FINAL_MARKSHEET_SUBMITTED':
      return (
        <span className={`inline-flex items-center gap-1 rounded-full bg-orange-100 text-orange-800 border border-orange-300 ${pad}`}>
          <Send className="w-3.5 h-3.5 text-orange-600" />
          <span>Pending HOD Approval</span>
        </span>
      );
    case 'FINAL_MARKSHEET_CHANGES_REQUESTED':
      return (
        <span className={`inline-flex items-center gap-1 rounded-full bg-rose-50 text-rose-700 border border-rose-300 ${pad}`}>
          <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
          <span>Changes Requested</span>
        </span>
      );
    case 'APPROVED_LOCKED':
      return (
        <span className={`inline-flex items-center gap-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-300 ${pad}`}>
          <Lock className="w-3.5 h-3.5 text-emerald-600" />
          <span>Approved & Locked</span>
        </span>
      );
    case 'CANCELLED':
      return (
        <span className={`inline-flex items-center gap-1 rounded-full bg-slate-200 text-slate-600 border border-slate-300 ${pad}`}>
          <span>Cancelled</span>
        </span>
      );
    default:
      return (
        <span className={`inline-flex items-center gap-1 rounded-full bg-slate-100 text-slate-700 ${pad}`}>
          <span>{status}</span>
        </span>
      );
  }
};
