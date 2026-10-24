import React from 'react';
import { User } from '../types';
import { LecturerAvatar } from './LecturerAvatar';
import {
  GraduationCap,
  Layers,
  FileText,
  CheckSquare,
  FileSpreadsheet,
  BarChart3,
  Activity,
  Mail,
  Edit3,
  LogOut,
  Shield,
  UserCheck,
  PackageCheck,
  ClipboardList,
  ChevronRight,
  X,
  Users,
  Settings,
} from 'lucide-react';

interface SidebarProps {
  user: User;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
  onOpenEmails: () => void;
  onOpenEmailSettings?: () => void;
  onOpenEditProfile: () => void;
  isOpenMobile: boolean;
  onCloseMobile: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  user,
  activeTab,
  setActiveTab,
  onLogout,
  onOpenEmails,
  onOpenEmailSettings,
  onOpenEditProfile,
  isOpenMobile,
  onCloseMobile,
}) => {
  const isHod = user.roles.includes('HOD');
  const isDean = user.roles.includes('DEAN');
  const isAr = user.roles.includes('AR_OFFICE');
  const isClerk = user.roles.includes('HOD_CLERK');
  const isLecturer = user.roles.includes('LECTURER');
  const isSecondExaminer = user.roles.includes('SECOND_EXAMINER');

  const handleNavClick = (tabKey: string) => {
    setActiveTab(tabKey);
    onCloseMobile();
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpenMobile && (
        <div
          onClick={onCloseMobile}
          className="fixed inset-0 bg-slate-950/70 z-40 lg:hidden backdrop-blur-xs transition-opacity"
        />
      )}

      {/* Sidebar Container */}
      <aside
        className={`fixed top-0 bottom-0 left-0 z-50 w-72 bg-slate-900 border-r border-slate-800 text-slate-200 flex flex-col justify-between transition-transform duration-200 ease-in-out lg:translate-x-0 ${
          isOpenMobile ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:static'
        }`}
      >
        {/* Top Header & Institutional Branding */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 border-b border-slate-800 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src="/rusl-logo.png"
                alt="Rajarata University of Sri Lanka Logo"
                className="w-11 h-11 object-contain drop-shadow-md"
              />
              <div>
                <h1 className="font-extrabold text-white text-sm tracking-tight leading-tight">
                  RUSL EXAM MONITOR
                </h1>
                <p className="text-[11px] text-slate-400 font-medium">Department of Computing</p>
                <p className="text-[10px] text-amber-400/90 font-medium">Faculty of Applied Sciences</p>
              </div>
            </div>

            {/* Mobile close button */}
            <button
              onClick={onCloseMobile}
              className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-white hover:bg-slate-800 transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* User Profile Summary Card */}
          <div className="p-4 border-b border-slate-800 bg-slate-900/60">
            <div className="flex items-center gap-3">
              <LecturerAvatar
                name={user.fullName}
                imageUrl={user.profilePictureUrl}
                size="md"
              />
              <div className="flex-1 min-w-0">
                <h2 className="text-xs font-bold text-white truncate" title={user.fullName}>
                  {user.fullName}
                </h2>
                <p className="text-[11px] text-slate-400 truncate capitalize">
                  {user.designation || 'Academic Staff'}
                </p>
                <div className="flex flex-wrap gap-1 mt-1">
                  {user.roles.map((role) => (
                    <span
                      key={role}
                      className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-red-950/80 text-amber-300 border border-red-800/60"
                    >
                      {role.replace('_', ' ')}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Quick Profile & Logout Actions */}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                onClick={onOpenEditProfile}
                className="py-1.5 px-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-[11px] font-semibold flex items-center justify-center gap-1.5 border border-slate-700/80 transition shadow-xs"
                title="Edit profile & personal details"
              >
                <Edit3 className="w-3.5 h-3.5 text-amber-400" />
                <span>Profile</span>
              </button>
              <button
                onClick={onLogout}
                className="py-1.5 px-2 rounded-lg bg-rose-950/60 hover:bg-rose-900/90 text-rose-300 hover:text-white text-[11px] font-semibold flex items-center justify-center gap-1.5 border border-rose-800/60 transition shadow-xs"
                title="Sign out of current session"
              >
                <LogOut className="w-3.5 h-3.5 text-rose-400" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>

          {/* Arranged Operations Navigation */}
          <div className="p-3 space-y-5">
            {/* Group 1: Academic Workspaces (Dual Roles) */}
            <div>
              <span className="px-2 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1.5">
                Academic Operations
              </span>
              <nav className="space-y-1">
                {isHod && (
                  <>
                    <button
                      onClick={() => handleNavClick('dashboard')}
                      className={`w-full px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition ${
                        activeTab === 'dashboard'
                          ? 'bg-red-800 text-white shadow-md'
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Layers className="w-4 h-4 text-amber-400" />
                        <span>HOD Oversight</span>
                      </div>
                      {activeTab === 'dashboard' && <ChevronRight className="w-3.5 h-3.5" />}
                    </button>

                    <button
                      onClick={() => handleNavClick('first-marking')}
                      className={`w-full px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition ${
                        activeTab === 'first-marking'
                          ? 'bg-red-800 text-white shadow-md'
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <FileText className="w-4 h-4 text-blue-400" />
                        <span>My 1st Marking</span>
                      </div>
                      {activeTab === 'first-marking' && <ChevronRight className="w-3.5 h-3.5" />}
                    </button>

                    <button
                      onClick={() => handleNavClick('second-marking')}
                      className={`w-full px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition ${
                        activeTab === 'second-marking'
                          ? 'bg-red-800 text-white shadow-md'
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <CheckSquare className="w-4 h-4 text-emerald-400" />
                        <span>My 2nd Examining</span>
                      </div>
                      {activeTab === 'second-marking' && <ChevronRight className="w-3.5 h-3.5" />}
                    </button>
                  </>
                )}

                {(isLecturer || isSecondExaminer) && !isHod && !isAr && !isClerk && !isDean && (
                  <>
                    <button
                      onClick={() => handleNavClick('first-marking')}
                      className={`w-full px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition ${
                        activeTab === 'first-marking' || activeTab === 'dashboard'
                          ? 'bg-red-800 text-white shadow-md'
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <FileText className="w-4 h-4 text-blue-400" />
                        <span>1st Marking (My Courses)</span>
                      </div>
                      {(activeTab === 'first-marking' || activeTab === 'dashboard') && (
                        <ChevronRight className="w-3.5 h-3.5" />
                      )}
                    </button>

                    <button
                      onClick={() => handleNavClick('second-marking')}
                      className={`w-full px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition ${
                        activeTab === 'second-marking'
                          ? 'bg-red-800 text-white shadow-md'
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <CheckSquare className="w-4 h-4 text-emerald-400" />
                        <span>2nd Examining & Invitations</span>
                      </div>
                      {activeTab === 'second-marking' && <ChevronRight className="w-3.5 h-3.5" />}
                    </button>
                  </>
                )}

                {isAr && (
                  <button
                    onClick={() => handleNavClick('dashboard')}
                    className={`w-full px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition ${
                      activeTab === 'dashboard'
                        ? 'bg-red-800 text-white shadow-md'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <PackageCheck className="w-4 h-4 text-amber-400" />
                      <span>AR Logistics & OTPs</span>
                    </div>
                    {activeTab === 'dashboard' && <ChevronRight className="w-3.5 h-3.5" />}
                  </button>
                )}

                {isClerk && (
                  <button
                    onClick={() => handleNavClick('dashboard')}
                    className={`w-full px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition ${
                      activeTab === 'dashboard'
                        ? 'bg-red-800 text-white shadow-md'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <ClipboardList className="w-4 h-4 text-indigo-400" />
                      <span>Clerk Data & Timetables</span>
                    </div>
                    {activeTab === 'dashboard' && <ChevronRight className="w-3.5 h-3.5" />}
                  </button>
                )}
              </nav>
            </div>

            {/* Group 2: Department Monitoring & Records */}
            <div>
              <span className="px-2 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1.5">
                Monitoring & Records
              </span>
              <nav className="space-y-1">
                <button
                  onClick={() => handleNavClick('schedules')}
                  className={`w-full px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition ${
                    activeTab === 'schedules'
                      ? 'bg-red-800 text-white shadow-md'
                      : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <div className="flex items-center gap-2.5">
                    <FileSpreadsheet className="w-4 h-4 text-teal-400" />
                    <span>All Exam Schedules</span>
                  </div>
                  {activeTab === 'schedules' && <ChevronRight className="w-3.5 h-3.5" />}
                </button>

                {(isDean || isHod) && (
                  <button
                    onClick={() => handleNavClick('dean')}
                    className={`w-full px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition ${
                      activeTab === 'dean'
                        ? 'bg-red-800 text-white shadow-md'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <BarChart3 className="w-4 h-4 text-purple-400" />
                      <span>Faculty Analytics</span>
                    </div>
                    {activeTab === 'dean' && <ChevronRight className="w-3.5 h-3.5" />}
                  </button>
                )}

                {(isHod || isClerk) && (
                  <button
                    onClick={() => handleNavClick('roles')}
                    className={`w-full px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition ${
                      activeTab === 'roles'
                        ? 'bg-red-800 text-white shadow-md'
                        : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <Users className="w-4 h-4 text-emerald-400" />
                      <span>Role Approvals & Members</span>
                    </div>
                    {activeTab === 'roles' && <ChevronRight className="w-3.5 h-3.5" />}
                  </button>
                )}

                {isHod && (
                  <>
                    <button
                      onClick={() => handleNavClick('audit')}
                      className={`w-full px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition ${
                        activeTab === 'audit'
                          ? 'bg-red-800 text-white shadow-md'
                          : 'text-slate-300 hover:bg-slate-800 hover:text-white'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Activity className="w-4 h-4 text-rose-400" />
                        <span>Audit Log Records</span>
                      </div>
                      {activeTab === 'audit' && <ChevronRight className="w-3.5 h-3.5" />}
                    </button>
                  </>
                )}
              </nav>
            </div>

            {/* Group 3: Communications & Alerts */}
            <div>
              <span className="px-2 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 block mb-1.5">
                Communications
              </span>
              <nav className="space-y-1">
                <button
                  onClick={() => {
                    onOpenEmails();
                    onCloseMobile();
                  }}
                  className="w-full px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between text-slate-300 hover:bg-slate-800 hover:text-white transition group"
                >
                  <div className="flex items-center gap-2.5">
                    <Mail className="w-4 h-4 text-rose-400 group-hover:text-rose-300" />
                    <span>Notification Center</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-900/60 text-rose-300 border border-rose-700/50">
                    In-App
                  </span>
                </button>

                <button
                  onClick={() => {
                    if (onOpenEmailSettings) onOpenEmailSettings();
                    else onOpenEmails();
                    onCloseMobile();
                  }}
                  className="w-full px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between text-slate-300 hover:bg-slate-800 hover:text-white transition group"
                  title="Configure automated Gmail notifications"
                >
                  <div className="flex items-center gap-2.5">
                    <Settings className="w-4 h-4 text-amber-400 group-hover:text-amber-300" />
                    <span>Gmail Setup</span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-950/60 text-amber-300 border border-amber-800/60">
                    Auto-Send
                  </span>
                </button>
              </nav>
            </div>
          </div>
        </div>

        {/* Sidebar Footer: Sign Out */}
        <div className="p-3 border-t border-slate-800 bg-slate-950/70">
          {/* Sign Out Button */}
          <button
            onClick={onLogout}
            className="w-full py-2.5 px-3 rounded-xl bg-slate-800/80 hover:bg-rose-900/40 text-slate-300 hover:text-rose-200 text-xs font-semibold flex items-center justify-center gap-2 border border-slate-700/60 hover:border-rose-800/60 transition"
          >
            <LogOut className="w-4 h-4 text-slate-400 group-hover:text-rose-300" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>
    </>
  );
};
