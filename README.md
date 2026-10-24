# RUSL Examination Results Monitoring System

> Web-based examination tracking and workflow monitoring system for the **Department of Computing, Faculty of Applied Sciences, Rajarata University of Sri Lanka (RUSL)**.
> Ensures strict adherence to examination bylaws, seniority rules for second examiners, physical script handover verification via cryptographic OTPs, courier tracking, deadline enforcement, and multi-stage marksheet approvals.

---

## 🛠️ Tech Stack

- **Frontend:** React 18, TypeScript, Vite, Tailwind CSS, Lucide React Icons
- **Backend:** Node.js, Express, TypeScript, pure MySQL (`mysql2/promise`)
- **Database:** MySQL / MariaDB (Database: `exam_monitoring_db`)
- **Storage:** Local encrypted file storage with SHA-256 integrity checks
- **Testing:** Jest, Supertest (Unit & Integration test suites)

---

## 🚀 Quick Start (Examiner Evaluation)

### Prerequisites
- **Node.js** (v18 or higher) - [Download Node.js](https://nodejs.org/)
- **MySQL / MariaDB** (e.g. via [XAMPP](https://www.apachefriends.org/) or standalone MySQL on port 3306)

---

### Step 1: Clone the Repository
```bash
git clone https://github.com/<your-username>/exam-results-monitoring-system.git
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

| Role / Perspective | Username | Staff Member | Seniority Rank / Designation | Access & Responsibilities |
|---|---|---|---|---|
| **Head of Department (HOD)** | `hod` | Dr. K. A. S. H. Kulathilake | Rank 10 (Head of Dept) | Assign First/Second examiners, enforce seniority bylaws, approve schedules, grant final approvals |
| **First Examiner / Lecturer** | `charith` | Dr. Charith Jayasundara | Rank 6 (Senior Lecturer Gr. II) | Request script collection OTP, submit 1st marking reports, compile final marks |
| **Lecturer (Junior)** | `palliya` | Mr. K. T. S. Palliyaguruge | Rank 4 (Lecturer) | First examiner (cannot examine senior lecturers' courses) |
| **Second Examiner (Internal)** | `hettige` | Dr. S. Hettige | Rank 9 (Senior Lecturer Gr. I) | Second examiner for senior courses, submit 2nd marking report |
| **Second Examiner (External)** | `gunathilake` | Prof. Jagath K. Gunathilake | Rank 12 (Chair Professor) | External expert examiner for professorial level courses |
| **Examination Branch (AR)** | `ar` | Senior Asst. Registrar | Examination Branch | Verify script collection/return OTPs, dispatch couriers, track tracking numbers |
| **Department Clerk** | `clerk` | Office Clerk | HOD Office | View schedules, enter course records, assist administrative workflows |
| **Faculty Dean** | `dean` | Prof. Faculty Dean | Dean's Office | High-level audit and faculty-wide examination monitoring |

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

## 📁 Project Structure & Documentation

```
exam-results-monitoring-system/
├── client/                     # React 18 + TypeScript + Vite frontend
│   ├── src/
│   │   ├── components/         # Reusable UI components (Modal, Navbar, OTP, etc.)
│   │   ├── pages/              # Role dashboards, schedules, tracking, reports
│   │   ├── services/           # Axios API client services
│   │   └── types/              # TypeScript interface definitions
│   └── package.json
├── server/                     # Node.js + Express + TypeScript backend
│   ├── src/
│   │   ├── controllers/        # Route controllers (Auth, Schedules, Handover, etc.)
│   │   ├── middleware/         # JWT auth, role authorization, file uploads
│   │   ├── routes/             # RESTful API route definitions
│   │   ├── services/           # Business logic & MySQL transaction services
│   │   └── utils/              # Date arithmetic, OTP hashing, PDF validators
│   ├── tests/                  # Jest test suites (businessRules & api integration)
│   └── package.json
├── database/
│   └── exam_monitoring_db.sql  # Complete MySQL database schema + pre-seeded test data
├── docs/                       # Academic documentation & diagrams
│   ├── Final_Submission_System_Report.docx
│   ├── RUSL_Exam_Monitoring_EER_Diagram.png
│   ├── RUSL_Exam_Monitoring_Peter_Chen_ERD.png
│   ├── RUSL_Exam_Monitoring_Relational_Schema.png
│   └── COURSES_AND_LECTURER_IN_CHARGE_STUDENT_COPY.pdf
├── uploads/                    # Secure local storage for uploaded marking reports & marksheet PDFs
├── .gitignore
├── package.json                # Root automation scripts
└── README.md
```

---

## 📄 License & Attribution

Developed for the **Department of Computing, Faculty of Applied Sciences, Rajarata University of Sri Lanka (RUSL)**. All rights reserved.
