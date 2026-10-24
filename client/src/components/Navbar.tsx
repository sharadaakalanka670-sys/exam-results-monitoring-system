import React, { useState } from 'react';
import { User, RoleName } from '../types';
import { LecturerAvatar } from './LecturerAvatar';
import { EditProfileModal } from './EditProfileModal';
import { GraduationCap, Shield, UserCircle, LogOut, FileSpreadsheet, Activity, BarChart3, Layers, Mail, Edit3, FileText, CheckSquare } from 'lucide-react';

interface Props {
  user: User | null;
  activeTab: string;
  setActiveTab: (tab: string) => void;
  onLogout: () => void;
  onOpenEmails?: () => void;
  onProfileUpdated?: (updatedUser: User) => void;
}

export const Navbar: React.FC<Props> = ({
  user,
  activeTab,
  setActiveTab,
  onLogout,
  onOpenEmails,
  onProfileUpdated,
}) => {
  const [isEditProfileOpen, setIsEditProfileOpen] = useState(false);
  const isHod = user?.roles.includes('HOD');
  const isDean = user?.roles.includes('DEAN');
  const isAr = user?.roles.includes('AR_OFFICE');
  const isClerk = user?.roles.includes('HOD_CLERK');
  const isLecturer = user?.roles.includes('LECTURER');
  const isSecondExaminer = user?.roles.includes('SECOND_EXAMINER');

  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-40 shadow-sm">
      {/* Top Banner with RUSL Identity */}
      <div className="bg-slate-900 text-slate-200 px-4 py-1.5 text-xs flex flex-wrap items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-2">
          <span className="font-semibold text-amber-400">RUSL EXAM MONITORING</span>
          <span className="text-slate-500">|</span>
          <span className="hidden sm:inline text-slate-400">Department of Computing, Faculty of Applied Sciences</span>
        </div>
        <div className="text-[11px] text-slate-400 font-medium">
          Rajarata University of Sri Lanka
        </div>
      </div>

      {/* Main Nav Bar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <img
            src="/rusl-logo.png"
            alt="Rajarata University of Sri Lanka Logo"
            className="w-10 h-10 object-contain drop-shadow-xs"
          />
          <div>
            <h1 className="font-bold text-slate-900 text-base leading-tight">
              Exam Results Monitoring System
            </h1>
            <p className="text-xs text-slate-500">Rajarata University of Sri Lanka</p>
          </div>
        </div>

        {/* Navigation Tabs */}
        {user && (
          <nav className="flex items-center gap-1 sm:gap-1.5 flex-wrap">
            {isHod ? (
              <>
                <button
                  onClick={() => setActiveTab('dashboard')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                    activeTab === 'dashboard'
                      ? 'bg-red-800 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                  title="HOD Department Overview & Final Approvals"
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>HOD Oversight</span>
                </button>

                <button
                  onClick={() => setActiveTab('first-marking')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                    activeTab === 'first-marking'
                      ? 'bg-red-800 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                  title="Subjects where HOD is teaching as First Examiner"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>My 1st Marking</span>
                </button>

                <button
                  onClick={() => setActiveTab('second-marking')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                    activeTab === 'second-marking'
                      ? 'bg-red-800 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                  title="Subjects where HOD is evaluating as Second Examiner"
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  <span>My 2nd Examining</span>
                </button>

                <button
                  onClick={() => setActiveTab('audit')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                    activeTab === 'audit'
                      ? 'bg-red-800 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                >
                  <Activity className="w-3.5 h-3.5" />
                  <span>Audit Logs</span>
                </button>
              </>
            ) : (isLecturer || isSecondExaminer) && !isAr && !isClerk && !isDean ? (
              <>
                <button
                  onClick={() => setActiveTab('first-marking')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                    activeTab === 'first-marking' || activeTab === 'dashboard'
                      ? 'bg-red-800 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                  title="My 1st Marking Subjects (OTP collection, reports, CA compilation)"
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>1st Marking (My Courses)</span>
                </button>

                <button
                  onClick={() => setActiveTab('second-marking')}
                  className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                    activeTab === 'second-marking'
                      ? 'bg-red-800 text-white shadow-xs'
                      : 'text-slate-600 hover:bg-slate-100'
                  }`}
                  title="2nd Examiner Workspace (Couriers, 2nd reports, nominations)"
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  <span>2nd Examining & Invitations</span>
                </button>
              </>
            ) : (
              <button
                onClick={() => setActiveTab('dashboard')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                  activeTab === 'dashboard'
                    ? 'bg-red-800 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>Role Dashboard</span>
              </button>
            )}

            <button
              onClick={() => setActiveTab('schedules')}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                activeTab === 'schedules'
                  ? 'bg-red-800 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              <span>All Schedules</span>
            </button>

            {(isDean || isHod) && (
              <button
                onClick={() => setActiveTab('dean')}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition ${
                  activeTab === 'dean'
                    ? 'bg-red-800 text-white shadow-xs'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Dean Analytics</span>
              </button>
            )}
          </nav>
        )}

        {/* User Profile & Logout */}
        {user ? (
          <div className="flex items-center gap-2.5">
            {onOpenEmails && (
              <button
                onClick={onOpenEmails}
                className="px-2.5 py-1.5 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 text-xs font-semibold flex items-center gap-1.5 transition shadow-xs"
                title="View auto-customized notification emails dispatched to you"
              >
                <Mail className="w-3.5 h-3.5 text-rose-700" />
                <span className="hidden sm:inline">Email Alerts</span>
              </button>
            )}

            <button
              onClick={() => setIsEditProfileOpen(true)}
              className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 text-xs font-semibold flex items-center gap-1.5 transition shadow-xs"
              title="Edit your personal and contact details"
            >
              <Edit3 className="w-3.5 h-3.5 text-slate-600" />
              <span className="hidden sm:inline">Edit Profile</span>
            </button>

            <div
              onClick={() => setIsEditProfileOpen(true)}
              className="flex items-center gap-2.5 cursor-pointer hover:opacity-85 transition p-1 rounded-lg"
              title="Click to edit profile"
            >
              <LecturerAvatar
                name={user.fullName}
                imageUrl={user.profilePictureUrl}
                size="md"
              />
              <div className="text-right hidden md:block">
                <div className="text-sm font-semibold text-slate-800 flex items-center justify-end gap-1.5">
                  <span>{user.fullName}</span>
                </div>
                <div className="text-xs text-slate-500 flex items-center justify-end gap-1">
                  <span className="capitalize">{user.designation}</span>
                  <span className="text-slate-300">•</span>
                  <span className="font-semibold text-red-800">{user.roles.join(', ')}</span>
                </div>
              </div>
            </div>

            <button
              onClick={onLogout}
              title="Sign Out"
              className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition"
            >
              <LogOut className="w-5 h-5" />
            </button>

            {isEditProfileOpen && (
              <EditProfileModal
                user={user}
                isOpen={isEditProfileOpen}
                onClose={() => setIsEditProfileOpen(false)}
                onProfileUpdated={(updated) => {
                  onProfileUpdated?.(updated);
                }}
              />
            )}
          </div>
        ) : (
          <div className="text-sm text-slate-500">Not authenticated</div>
        )}
      </div>
    </header>
  );
};
