import React from 'react';
import { User } from '../types';
import { LecturerAvatar } from './LecturerAvatar';
import {
  Menu,
  Mail,
  Edit3,
  Layers,
  FileText,
  CheckSquare,
  FileSpreadsheet,
  BarChart3,
  Activity,
  PackageCheck,
  ClipboardList,
  Users,
  LogOut,
} from 'lucide-react';

interface TopHeaderProps {
  user: User;
  activeTab: string;
  onOpenMobileSidebar: () => void;
  onOpenEmails: () => void;
  onOpenEditProfile: () => void;
  onLogout: () => void;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  user,
  activeTab,
  onOpenMobileSidebar,
  onOpenEmails,
  onOpenEditProfile,
  onLogout,
}) => {
  const getTabMetadata = () => {
    switch (activeTab) {
      case 'dashboard':
        if (user.roles.includes('HOD')) {
          return {
            title: 'HOD Oversight & Approvals',
            subtitle: 'Department-wide examination schedules, 2nd examiner approvals & permanent locks',
            icon: <Layers className="w-5 h-5 text-red-800" />,
          };
        }
        if (user.roles.includes('AR_OFFICE')) {
          return {
            title: 'AR Examination Logistics',
            subtitle: 'Physical script packet handover, cryptographic OTP verification & courier dispatch',
            icon: <PackageCheck className="w-5 h-5 text-amber-700" />,
          };
        }
        if (user.roles.includes('HOD_CLERK')) {
          return {
            title: 'HOD Clerk Management',
            subtitle: 'Course schedule creation, examiner assignments & timetable tracking',
            icon: <ClipboardList className="w-5 h-5 text-indigo-700" />,
          };
        }
        return {
          title: '1st Marking Workspace',
          subtitle: 'Allocated teaching subjects, 2nd examiner nomination & marks compilation',
          icon: <FileText className="w-5 h-5 text-blue-700" />,
        };
      case 'first-marking':
        return {
          title: '1st Marking (My Courses)',
          subtitle: 'Nominate 2nd examiners, collect exam paper packets via AR OTP, and upload marks',
          icon: <FileText className="w-5 h-5 text-blue-700" />,
        };
      case 'second-marking':
        return {
          title: '2nd Examining & Invitations',
          subtitle: 'Review nominations from colleagues, track script couriers, and upload 2nd marker reports',
          icon: <CheckSquare className="w-5 h-5 text-emerald-700" />,
        };
      case 'schedules':
        return {
          title: 'All Departmental Exam Schedules',
          subtitle: 'Directory of all course examination tracking workflows and milestone statuses',
          icon: <FileSpreadsheet className="w-5 h-5 text-teal-700" />,
        };
      case 'dean':
        return {
          title: 'Faculty Dean Analytics',
          subtitle: 'Cross-departmental exam completion velocity and release milestone metrics',
          icon: <BarChart3 className="w-5 h-5 text-purple-700" />,
        };
      case 'roles':
        return {
          title: 'Role Governance & Approvals Console',
          subtitle: 'Clerk & HOD user role modifications, membership approvals, and system role management',
          icon: <Users className="w-5 h-5 text-emerald-700" />,
        };
      case 'audit':
        return {
          title: 'System Audit Logs',
          subtitle: 'Cryptographic immutable trail of all academic actions, OTPs, and HOD approvals',
          icon: <Activity className="w-5 h-5 text-rose-700" />,
        };
      default:
        return {
          title: 'Examination Results Monitoring System',
          subtitle: 'Department of Computing • Faculty of Applied Sciences • RUSL',
          icon: <Layers className="w-5 h-5 text-slate-700" />,
        };
    }
  };

  const meta = getTabMetadata();

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between gap-4">
        {/* Left: Mobile hamburger + Active Section Header */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={onOpenMobileSidebar}
            className="lg:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition border border-slate-200"
            title="Open Operations Sidebar"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2.5 min-w-0">
            <div className="hidden sm:flex w-9 h-9 rounded-xl bg-slate-100 border border-slate-200 items-center justify-center">
              {meta.icon}
            </div>
            <div className="min-w-0">
              <h2 className="text-base font-bold text-slate-900 truncate leading-tight">
                {meta.title}
              </h2>
              <p className="text-xs text-slate-500 truncate hidden sm:block">
                {meta.subtitle}
              </p>
            </div>
          </div>
        </div>

        {/* Right: Notification Alerts + Profile Chip */}
        <div className="flex items-center gap-2 sm:gap-3 flex-shrink-0">
          {/* Email / In-App Notification Center Button */}
          <button
            onClick={onOpenEmails}
            className="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 text-xs font-semibold flex items-center gap-2 transition shadow-xs"
            title="View auto-customized notification emails & alerts"
          >
            <Mail className="w-4 h-4 text-rose-700" />
            <span className="hidden sm:inline">Notifications & Emails</span>
          </button>

          {/* User Profile Quick Chip */}
          <div
            onClick={onOpenEditProfile}
            className="flex items-center gap-2 px-2.5 py-1.5 rounded-xl border border-slate-200 bg-slate-50 hover:bg-slate-100 cursor-pointer transition shadow-xs"
            title="Click to edit personal details and contact info"
          >
            <LecturerAvatar
              name={user.fullName}
              imageUrl={user.profilePictureUrl}
              size="sm"
            />
            <div className="text-left hidden md:block">
              <div className="text-xs font-bold text-slate-800 truncate max-w-[140px]">
                {user.fullName}
              </div>
              <div className="text-[10px] text-slate-500 flex items-center gap-1">
                <span className="capitalize">{user.designation || 'Lecturer'}</span>
                <span className="text-slate-300">•</span>
                <span className="text-red-800 font-semibold">{user.roles[0]?.replace('_', ' ')}</span>
              </div>
            </div>
            <Edit3 className="w-3.5 h-3.5 text-slate-400 ml-1 hidden sm:block" />
          </div>

          {/* Prominent Sign Out / Logout Button */}
          <button
            onClick={onLogout}
            className="p-2 sm:px-3 sm:py-2 rounded-xl bg-slate-100 hover:bg-rose-50 hover:text-rose-700 text-slate-600 border border-slate-200 hover:border-rose-200 text-xs font-bold flex items-center gap-1.5 transition shadow-xs"
            title="Sign out of current session"
          >
            <LogOut className="w-4 h-4 text-slate-500 hover:text-rose-600" />
            <span className="hidden sm:inline">Sign Out</span>
          </button>
        </div>
      </div>
    </header>
  );
};
