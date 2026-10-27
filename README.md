# NagrikFlow (नागरिक प्रवाह)
### Minimal Full-Stack Urban Waste Management System for Indian Cities

NagrikFlow is a clean, reliable, full-stack municipal waste collection management platform built with React, TypeScript, Tailwind CSS, Leaflet, and Google Cloud Firestore. It is specifically designed to manage daily waste collection tasks, verify geographic collection points, and redress citizen grievances across Indian urban municipal wards.

---

## 1. Core Modules

1. **Operations Dashboard**:
   - Live query metrics directly from Cloud Firestore:
     - Total collection tasks
     - Pending pickup tasks
     - Completed tasks (with percentage rate)
     - Unresolved citizen grievances (Pending + In Review)
   - Real-time status breakdown without simulated or hardcoded figures.
   - Clear empty states when zero records are present, with optional labeled synthetic test seeding.

2. **Collection Task Management**:
   - Filterable, searchable task table with Task ID, Location, Assigned Worker, Scheduled Time, Status, and Completion Notes.
   - **Municipal Staff / Admin**: Dispatch and assign tasks to workers with scheduled date/time.
   - **Collection Worker**: View personal assigned tasks; transition status to *In Progress*, *Completed*, or *Missed* (with mandatory reason for missed pickups).
   - **Audit Trail**: Every status change is immutably logged into `taskStatusHistory` with timestamp and user UID.

3. **Collection Map (Leaflet + OpenStreetMap)**:
   - Interactive OpenStreetMap layer plotting verified municipal collection points from Firestore.
   - Inspection drawer displaying Point Name, Ward/Zone, Street Address, and GPS coordinates.
   - Authorized municipal staff form to register new verified collection points (with GPS locate and map-click coordinate picker).
   - Strict adherence to real data: No simulated coordinates or moving vehicles.

4. **Citizen Complaints & Grievance Redressal**:
   - Citizen submission form with Category (*Overflowing Bin*, *Missed Pickup*, *Illegal Dumping*, *Hazardous Waste*, *Damaged Bin*, *Other*), Address, GPS Coordinates, Detailed Description, and optional Photo upload to Firebase Cloud Storage.
   - Citizens track the status of their own reports.
   - Authorized municipal administrators review reports, inspect coordinates, and record official resolution remarks.
   - Complaints are never automatically marked resolved.

---

## 2. User Roles & Security Model

- **Municipal Staff / Admin (`admin`)**:
  - Full access to dispatch tasks, register collection points, review complaints, and update resolution notes.
  - Bootstrapped administrator: `omkarshirke2007@gmail.com`.
- **Collection Worker (`worker`)**:
  - Operational access to view assigned tasks and update status. Cannot reassign tasks or create collection points.
- **Citizen (`citizen`)**:
  - Civic access to submit complaints and track personal submissions.

> **Security Rule Enforcement**: Users cannot elevate their own role by editing user documents in Firestore. Rules enforce `request.auth.uid == userId`, strict field allowlists, and immutable timestamps.

---

## 3. Technology Stack

- **Frontend**: React 19, TypeScript, Tailwind CSS v4, Lucide Icons, Leaflet 1.9
- **Backend**: Firebase Authentication, Google Cloud Firestore, Firebase Cloud Storage
- **Privileged Operations**: Firebase Cloud Functions (`/functions/src/index.ts`)
- **Security**: Hardened Firestore Rules (`firestore.rules`) and Cloud Storage Rules (`storage.rules`)

---

## 4. Setup & Deployment Instructions

### Prerequisites
- Node.js 20+
- npm 10+
- Firebase CLI (`npm install -g firebase-tools`)

### Local Development
1. Clone the repository and install dependencies:
   ```bash
   npm install
   ```
2. Start the development server:
   ```bash
   npm run dev
   ```
3. Open `http://localhost:3000` in your web browser.

### Deploying Firestore Rules
```bash
firebase deploy --only firestore:rules,storage
```

### Deploying Cloud Functions
```bash
cd functions
npm install
npm run build
firebase deploy --only functions
```

---

## 5. College Project Evaluation Guide

1. **Authentication**: Use the **Sign In / Register** modal. Quick pre-fill demo buttons are provided for instant testing as Admin, Worker, or Citizen.
2. **Perspective Switching**: As an evaluator, use the **Active Role View** switcher in the sidebar to test what field workers and citizens experience without logging in and out.
3. **Synthetic Evaluation Data**: If the database is empty, the Dashboard provides a **Seed Test Data (Synthetic)** button with clearly labeled Mumbai Ward G-North locations for testing.
