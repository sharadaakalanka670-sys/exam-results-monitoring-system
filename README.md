# RUSL Examination Results Monitoring System

**Developed by Team Syntax Squad**  
*Department of Computing, Faculty of Applied Sciences, Rajarata University of Sri Lanka (RUSL)*

> Web-based examination tracking and workflow monitoring system for the **Department of Computing, Faculty of Applied Sciences, Rajarata University of Sri Lanka (RUSL)**.
> Ensures strict adherence to examination bylaws, seniority rules for second examiners, physical script handover verification via cryptographic OTPs, courier tracking, deadline enforcement, and multi-stage marksheet approvals.

---

## 🛠️ Tech Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Lucide React Icons
- **Backend:** Node.js, Express, TypeScript, pure MySQL (`mysql2/promise`)
- **Database:** MySQL / MariaDB (Database: `exam_monitoring_db`)
- **Authentication:** JWT-based with role-based access control (RBAC)
- **Email Notifications:** Gmail SMTP integration with per-user configurable settings
- **Storage:** Local encrypted file storage with SHA-256 integrity checks
- **Testing:** Jest, Supertest (Unit & Integration test suites)

---

## ✨ Key Features

- **Role-Based Dashboards** — Dedicated dashboards for HOD, Lecturers, Second Examiners, AR Office, Clerk, and Dean
- **Seniority Bylaw Enforcement** — Automatically validates that Second Examiners hold equal or higher seniority rank than First Examiners
- **6-Digit OTP Script Handover** — Secure cryptographic OTP generation for physical exam script collection and return verification
- **Courier Tracking** — Record courier dispatch with tracking numbers (e.g., Certis Lanka / Prompt Xpress) and auto-set deadlines
- **Deadline Management** — 3-calendar-month first marking and 1-calendar-month second marking deadline enforcement with extension request/approval workflow
- **Multi-Stage Marksheet Approval** — Upload, submit, review, request changes, approve & permanently lock final marksheets
- **External Examiner Invitations** — Invite and manage external second examiners with formal invitation workflow
- **Email Notifications** — Auto-customized notification emails via configurable Gmail SMTP per user
- **Audit Logging** — Complete audit trail of all system actions for institutional integrity
- **Role Management** — HOD-controlled role assignment, change requests, and approval workflows
- **Document Security** — Signed URL-based secure document download with integrity verification
- **Professional Avatars** — Auto-generated professional vector avatars for lecturer profiles

---

## 🚀 Quick Start (Examiner Evaluation)

### Prerequisites
- **Node.js** (v18 or higher) - [Download Node.js](https://nodejs.org/)
- **MySQL / MariaDB** (e.g. via [XAMPP](https://www.apachefriends.org/) or standalone MySQL on port 3306)

---

### Step 1: Clone the Repository
```bash
git clone https://github.com/sharadaakalanka670-sys/exam-results-monitoring-system.git
cd exam-results-monitoring-system
```

---

### Step 2: Import the Database
Start your MySQL server (e.g. start MySQL in XAMPP Control Panel).

Import the pre-populated database dump using the MySQL command line:
```bash
mysql -u root -p < database/exam_monitoring_db.sql
```
*(If your MySQL `root` user does not have a password, simply omit `-p` or press Enter when prompted).*

> **Using phpMyAdmin?** Open `http://localhost/phpmyadmin`, select **Import**, choose `database/exam_monitoring_db.sql`, and click **Import**. The database `exam_monitoring_db` is created and populated automatically.

---

### Step 3: Install Dependencies
Run from the root directory to install both server and client dependencies:
```bash
npm run install:all
```
*(Or install manually: `cd server && npm install`, then `cd ../client && npm install`).*

---

### Step 4: Configure Environment
Copy the example environment configuration:
```bash
# Easy command (works on Windows & Mac/Linux):
npm run setup:env
```
*(Or manually copy `server/.env.example` to `server/.env`).*

Default configuration in `server/.env`:
```env
PORT=5000
NODE_ENV=development
DATABASE_URL="mysql://root@127.0.0.1:3306/exam_monitoring_db"
JWT_SECRET="rusl_exam_monitoring_super_secret_jwt_key_2026"
JWT_EXPIRES_IN="7d"
STORAGE_DIR="../uploads"
CLIENT_URL="http://localhost:5173"

# Gmail SMTP Configuration (Optional — OTPs are also logged/displayed in application UI)
SMTP_HOST="smtp.gmail.com"
SMTP_PORT=465
SMTP_SECURE="true"
SMTP_USER=""
SMTP_PASS=""
EMAIL_FROM="RUSL Exam Monitoring <noreply@rusl.ac.lk>"
```
*(If your MySQL root has a password, update `DATABASE_URL="mysql://root:yourpassword@127.0.0.1:3306/exam_monitoring_db"`).*

---

### Step 5: Start the Application

Open two terminal windows:

**Terminal 1 — Backend API:**
```bash
npm run dev:server
```
*Backend runs on: `http://localhost:5000`*

**Terminal 2 — Frontend Client:**
```bash
npm run dev:client
```
*Frontend runs on: `http://localhost:5173`*

Open **[http://localhost:5173](http://localhost:5173)** in your browser.

---

## 🔑 Pre-seeded Examiner Demo Accounts

All test accounts share the same default password: **`Password@123`**

### Core Role Accounts

| Role / Perspective | Username | Staff Member | Designation | Seniority Rank | Access & Responsibilities |
|---|---|---|---|---|---|
| **Head of Department (HOD)** | `hod` | Dr. Kasun Bandara | Senior Lecturer Gr. I & Head of Dept | Rank 10 | Assign First/Second examiners, enforce seniority bylaws, approve schedules, grant final approvals |
| **First Examiner / Lecturer** | `charith` | Dr. Charith Jayasundara | Senior Lecturer Gr. I | Rank 6 | Request script collection OTP, submit 1st marking reports, compile final marks |
| **Lecturer (Junior)** | `palliya` | Mr. Tharindu Wickramasinghe | Lecturer (Probationary) | Rank 4 | First examiner (cannot examine senior lecturers' courses) |
| **Second Examiner (Internal)** | `hettige` | Dr. Priyantha Dissanayake | Senior Lecturer Gr. II | Rank 5 | Second examiner for internal courses, submit 2nd marking report |
| **Second Examiner (External)** | `gunathilake` | Prof. Nihal Senanayake | Professor of Computer Science | Rank 12 | External expert examiner (University of Peradeniya) |
| **Examination Branch (AR)** | `ar` | Mr. Kamal Rathnayake | Assistant Registrar (Examinations) | — | Verify script collection/return OTPs, dispatch couriers, track tracking numbers |
| **Department Clerk** | `clerk` | Ms. Niluka Jayawardena | Senior Management Assistant | — | View schedules, enter course records, assist administrative workflows |
| **Faculty Dean** | `dean` | Prof. Sunanda Wijeratne | Dean / Faculty of Applied Sciences | — | High-level audit and faculty-wide examination monitoring |

### Additional Lecturer & Examiner Accounts

| Username | Staff Member | Designation | Seniority Rank | Type |
|---|---|---|---|---|
| `skumara` | Dr. Saman Kumara | Senior Lecturer Gr. II | Rank 5 | Internal |
| `dperera` | Mrs. Dilani Perera | Lecturer (Probationary) | Rank 2 | Internal |
| `mfernando` | Dr. Malith Fernando | Senior Lecturer Gr. I | Rank 7 | Internal |
| `aweerasinghe` | Dr. Anura Weerasinghe | Senior Lecturer Gr. I | Rank 8 | Internal |
| `ngunasekara` | Dr. Nuwan Gunasekara | Senior Lecturer Gr. II | Rank 6 | Internal |
| `crathnayake` | Dr. Chaminda Rathnayake | Senior Lecturer Gr. II | Rank 6 | Internal |
| `kmendis` | Dr. Kusal Mendis | Senior Lecturer Gr. I | Rank 7 | Internal |
| `tsilva` | Dr. Thilina Silva | Senior Lecturer Gr. II | Rank 5 | Internal |
| `jranasinghe` | Dr. Janaka Ranasinghe | Senior Lecturer Gr. I | Rank 7 | Internal |
| `galahakoon` | Prof. Gamini Alahakoon | Senior Professor | Rank 12 | External |
| `sabeywickrama` | Dr. Suresh Abeywickrama | Senior Lecturer Gr. I | Rank 8 | External |
| `iherath` | Dr. Indika Herath | Senior Lecturer Gr. I | Rank 7 | Internal |
| `mkarunaratne` | Dr. Manoja Karunaratne | Senior Lecturer Gr. II | Rank 6 | Internal |
| `swickramasinghe` | Dr. Sajith Wickramasinghe | Senior Lecturer Gr. II | Rank 5 | Internal |
| `hlakmali` | Mrs. Heshani Lakmali | Lecturer (Probationary) | Rank 2 | Internal |
| `pwijesinghe` | Dr. Prasanna Wijesinghe | Senior Lecturer Gr. I | Rank 9 | External |
| `csamarasinghe` | Dr. Chathura Samarasinghe | Senior Lecturer Gr. II | Rank 6 | Internal |
| `nkodagoda` | Prof. Nimal Kodagoda | Professor of Software Engineering | Rank 11 | External |
| `asupun` | Mr. Supun Amarasinghe | Lecturer (Probationary) | Rank 3 | Internal |
| `vabeywardena` | Dr. Vathsala Abeywardena | Senior Lecturer Gr. I | Rank 8 | Internal |

> **Note:** All 28 accounts use the same password `Password@123`. Additional lecturer accounts hold `LECTURER` and/or `SECOND_EXAMINER` roles and can be used to test seniority validation rules with different rank combinations.

---

## 🧪 Running the Test Suite

The system includes automated tests covering seniority bylaws, load restrictions, calendar month deadline calculations, OTP generation, and full API workflows.

### Run Unit Tests (no MySQL connection required):
```bash
npm run test:unit
```

### Run Full Test Suite (requires running MySQL):
```bash
npm test
```

---

## 📋 Recommended Examiner Testing Workflow

Follow this quick walkthrough to test all key features and university bylaws:

1. **Test Role-Based Access & Authentication:**
   - Log in as `hod` with `Password@123`.
   - View the departmental examination dashboard, active schedules, and deadline status cards.

2. **Test Seniority Validation Rules:**
   - Go to **Schedules** -> Create or Edit a Schedule.
   - Try to assign a Second Examiner who has a lower seniority rank than the First Examiner. Notice the system enforces the university bylaw requiring the Second Examiner to have equal or higher rank.

3. **Test Physical Script Handover via 6-Digit OTP:**
   - Log in as `charith` (First Examiner).
   - Go to an approved schedule and click **Request Collection OTP**. A secure 6-digit OTP is generated.
   - Log out and log in as `ar` (AR Office).
   - Open **Script Handover Verification**, enter the examiner's OTP, and confirm handover. Notice the 3-calendar-month deadline starts counting down immediately.

4. **Test Courier Tracking & Second Marking:**
   - Log in as `ar` (AR Office).
   - Record the dispatch of scripts to the Second Examiner with a courier tracking number (e.g., Certis Lanka / Prompt Xpress).
   - Notice the system automatically sets a 1-calendar-month deadline from the dispatch timestamp.

5. **Test Marksheet Submission & Permanent Locking:**
   - Log in as First Examiner, upload the final marksheet PDF, and submit to HOD.
   - Log in as `hod`, review marks, and click **Approve & Lock**.
   - Notice the schedule transitions to `APPROVED_LOCKED` and becomes strictly read-only to preserve institutional audit integrity.

---

## 🌐 API Endpoints

The backend exposes a comprehensive RESTful API organized into the following modules:

| # | Module | Key Endpoints |
|---|---|---|
| 1 | **Authentication** | Login, Register, Forgot/Reset Password, Profile Update |
| 2 | **Role Management** | List Users/Roles, Create Roles, Request/Approve/Reject Role Changes |
| 3 | **Course Catalogue** | List Courses, Create Courses, List Course Offerings |
| 4 | **Exam Schedules** | List, Get, Create Draft, Update Draft, Activate, Cancel |
| 5 | **Examiners & Invitations** | Get Candidates, Assign Second Examiner, Create/Review/Respond to Invitations |
| 6 | **First Marking & OTP** | Request/Generate/Verify Collection OTP, Upload Report, Request/Verify Return OTP |
| 7 | **Second Marking & Courier** | Record Courier Dispatch, Acknowledge Receipt, Upload Report, Confirm AR Receipt |
| 8 | **Final Marksheet** | Upload, Submit, Request Changes, Approve & Lock, Record Hardcopy |
| 9 | **Deadline Extensions** | Request Extension, List Extensions, Review Extension |
| 10 | **Documents** | Secure Signed Download Links |
| 11 | **Dashboards** | HOD, Lecturer, Second Examiner, AR, Dean role-specific dashboards |
| 12 | **Audit Logs** | Full system audit trail |
| 13 | **Email Notifications** | List Emails, SMTP Settings, Test Connection, Send Test Email |

---

## 📁 Project Structure

```
exam-results-monitoring-system/
├── client/                         # React 18 + TypeScript + Vite frontend
│   ├── public/                     # Static assets
│   ├── src/
│   │   ├── api/
│   │   │   └── client.ts           # Axios API client configuration
│   │   ├── assets/
│   │   │   └── rusl-logo.png       # University branding logo
│   │   ├── components/
│   │   │   ├── ArDashboard.tsx          # AR Office dashboard
│   │   │   ├── AuditLogViewer.tsx       # System audit log viewer
│   │   │   ├── ClerkDashboard.tsx       # Department Clerk dashboard
│   │   │   ├── DeanDashboard.tsx        # Faculty Dean dashboard
│   │   │   ├── EditProfileModal.tsx     # User profile editor modal
│   │   │   ├── EmailViewerModal.tsx     # Email notification viewer
│   │   │   ├── GmailSettingsTab.tsx     # Gmail SMTP configuration tab
│   │   │   ├── HodDashboard.tsx         # HOD dashboard
│   │   │   ├── LecturerAvatar.tsx       # Professional avatar component
│   │   │   ├── LecturerDashboard.tsx    # Lecturer / First Examiner dashboard
│   │   │   ├── Navbar.tsx               # Navigation sidebar
│   │   │   ├── RoleManagementView.tsx   # Role administration panel
│   │   │   ├── ScheduleDetailModal.tsx  # Exam schedule detail view
│   │   │   ├── SchedulesList.tsx        # Exam schedules list view
│   │   │   ├── SecondExaminerDashboard.tsx  # Second Examiner dashboard
│   │   │   ├── Sidebar.tsx              # Sidebar navigation
│   │   │   ├── StatusBadge.tsx          # Status indicator badge
│   │   │   ├── TopHeader.tsx            # Top header bar
│   │   │   └── WorkflowTimeline.tsx     # Workflow step timeline
│   │   ├── utils/
│   │   │   └── professionalVectors.ts   # Avatar vector generation
│   │   ├── App.tsx                 # Root application component
│   │   ├── main.tsx                # Application entry point
│   │   ├── index.css               # Global styles
│   │   └── types.ts                # TypeScript type definitions
│   └── package.json
├── server/                         # Node.js + Express + TypeScript backend
│   ├── src/
│   │   ├── config/
│   │   │   ├── db.ts               # MySQL connection pool configuration
│   │   │   └── env.ts              # Environment variable loader
│   │   ├── controllers/
│   │   │   ├── auditController.ts         # Audit log endpoints
│   │   │   ├── authController.ts          # Authentication & profile
│   │   │   ├── courseController.ts         # Course catalogue management
│   │   │   ├── dashboardController.ts     # Role dashboard data
│   │   │   ├── documentController.ts      # Secure document access
│   │   │   ├── emailController.ts         # Email notification management
│   │   │   ├── examinerController.ts      # Examiner assignments & invitations
│   │   │   ├── extensionController.ts     # Deadline extension requests
│   │   │   ├── finalMarksheetController.ts  # Final marksheet approval flow
│   │   │   ├── firstMarkingController.ts  # First marking & OTP logistics
│   │   │   ├── roleManagementController.ts  # Role CRUD & approvals
│   │   │   ├── scheduleController.ts      # Exam schedule lifecycle
│   │   │   └── secondMarkingController.ts # Second marking & courier
│   │   ├── middlewares/
│   │   │   ├── auth.ts             # JWT authentication middleware
│   │   │   ├── rbac.ts             # Role-based access control
│   │   │   └── upload.ts           # PDF file upload handling (Multer)
│   │   ├── routes/
│   │   │   └── index.ts            # Centralized RESTful API route definitions
│   │   ├── services/
│   │   │   ├── auditService.ts          # Audit trail business logic
│   │   │   ├── documentService.ts       # Document storage & signed URLs
│   │   │   ├── emailService.ts          # SMTP email dispatch
│   │   │   ├── examinerService.ts       # Examiner seniority & assignment logic
│   │   │   ├── otpService.ts            # Cryptographic OTP generation & verification
│   │   │   ├── scheduleRepository.ts    # Schedule CRUD & MySQL transactions
│   │   │   └── workflowService.ts       # Multi-phase workflow state machine
│   │   ├── types/
│   │   │   ├── enums.ts            # Role names, statuses, phases
│   │   │   └── express.d.ts        # Express type augmentations
│   │   └── utils/
│   │       ├── academicDesignations.ts  # Seniority rank definitions
│   │       ├── dates.ts            # Calendar month deadline arithmetic
│   │       ├── otp.ts              # OTP hashing utilities
│   │       ├── professionalVectors.ts   # Avatar generation utilities
│   │       └── storage.ts          # File system storage helpers
│   ├── tests/
│   │   ├── businessRules.test.ts   # Unit tests (seniority, deadlines, OTP)
│   │   └── api.test.ts             # API integration tests
│   └── package.json
├── database/
│   └── exam_monitoring_db.sql      # Complete MySQL schema + pre-seeded test data
├── docs/                           # Academic documentation & diagrams
│   ├── ER Diagram.png
│   ├── RUSL_Exam_Monitoring_EER_Diagram.png
│   ├── RUSL_Exam_Monitoring_Peter_Chen_ERD.png
│   ├── RUSL_Exam_Monitoring_Relational_Schema.png
│   ├── COURSES_AND_LECTURER_IN_CHARGE_STUDENT_COPY.pdf
│   ├── Final_Submission_System_Report.docx
│   └── PXL_20260812_103530971.jpg
├── uploads/                        # Secure local storage for uploaded marking reports & marksheet PDFs
├── .gitignore
├── package.json                    # Root automation scripts (install, build, dev, test)
└── README.md
```

---

## 👥 Development Team & Attribution

Developed with pride by **Syntax Squad** for the **Department of Computing, Faculty of Applied Sciences, Rajarata University of Sri Lanka (RUSL)**.

---

*Last updated: October 2026*
