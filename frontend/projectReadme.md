# IntelliHire

> AI-Powered Recruitment & Interview Platform

IntelliHire is a modern, full-stack web application that revolutionizes the hiring process through AI-driven mock interviews, candidate assessments, and intelligent job matching. The platform serves two primary user roles: **Candidates** seeking employment and **Companies** looking to hire talent.

---

## Table of Contents

1. [Project Overview](#project-overview)
2. [System Architecture](#system-architecture)
3. [Portal Flows](#portal-flows)
   - [Candidate Portal](#candidate-portal)
   - [Company Portal](#company-portal)
4. [Technology Stack](#technology-stack)
5. [Project Structure](#project-structure)
6. [Key Features](#key-features)
7. [Getting Started](#getting-started)
8. [Development Guidelines](#development-guidelines)

---

## Project Overview

IntelliHire bridges the gap between job seekers and employers by providing:

- **AI-Powered Mock Interviews**: Candidates can practice with realistic interview simulations
- **Skill Assessment**: Automated evaluation of technical and soft skills
- **Smart Matching**: AI-driven candidate-job compatibility scoring
- **Collaborative Hiring**: Team-based candidate review and decision-making
- **Community Features**: Professional networking and community engagement

### Core Value Proposition

| For Candidates | For Companies |
|---------------|---------------|
| Practice interviews with AI feedback | AI-screened, pre-qualified candidates |
| Track interview performance | Collaborative hiring tools |
| Build professional profile | Analytics-driven hiring decisions |
| Join professional communities | Streamlined job posting & management |

---

## System Architecture

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        IntelliHire Platform                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────┐    ┌─────────────────┐    ┌──────────────┐ │
│  │   Candidate     │    │     Company     │    │   Public     │ │
│  │     Portal        │    │     Portal        │    │    Pages     │ │
│  │                  │    │                  │    │              │ │
│  │ • Dashboard       │    │ • Dashboard       │    │ • Landing    │ │
│  │ • Interview Room  │    │ • Job Management  │    │ • Login      │ │
│  │ • Reports         │    │ • Candidates      │    │ • Register   │ │
│  │ • Profile         │    │ • Team & Analytics│    │ • 404        │ │
│  │ • Communities     │    │ • Settings        │    │              │ │
│  └─────────────────┘    └─────────────────┘    └──────────────┘ │
│           │                      │                      │        │
│           └──────────────────────┼──────────────────────┘        │
│                                  │                               │
│                    ┌─────────────▼─────────────┐                │
│                    │      Shared Components      │                │
│                    │                             │                │
│                    │ • Auth System (Zustand)       │                │
│                    │ • UI Components (shadcn)      │                │
│                    │ • API Layer (authApi)         │                │
│                    │ • Design System               │                │
│                    └─────────────────────────────┘                │
│                                  │                               │
│                    ┌─────────────▼─────────────┐                │
│                    │    Client-Side Storage      │                │
│                    │    (LocalStorage Persistence)│               │
│                    └─────────────────────────────┘                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Component Architecture

```
src/
├── components/
│   ├── auth/           # Authentication guards & providers
│   ├── layout/         # Layout shells (Header, Footer, Sidebar)
│   ├── shared/         # Reusable UI components
│   │   ├── Button.jsx
│   │   ├── Card.jsx
│   │   ├── Toast.jsx
│   │   ├── SkeletonLoader.jsx
│   │   ├── EmptyState.jsx
│   │   ├── ConfirmDialog.jsx
│   │   └── IntelliHireLogo.jsx
│   └── ui/             # shadcn/ui base components
├── pages/
│   ├── public/         # Unauthenticated pages
│   ├── candidate/      # Candidate portal pages
│   └── company/        # Company portal pages
├── api/                # API client & auth logic
├── store/              # Zustand state management
├── hooks/              # Custom React hooks
├── data/               # Static data & mock stores
├── config/             # Route configurations
└── lib/                # Utility libraries
```

### Authentication Flow

```
┌─────────┐     ┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  User   │────▶│   Login     │────▶│  authApi.js  │────▶│ LocalStorage│
│         │     │   Page      │     │  (validate)  │     │  (persist)  │
└─────────┘     └─────────────┘     └──────────────┘     └─────────────┘
                                              │
                                              ▼
                                    ┌──────────────────┐
                                    │   AuthProvider   │
                                    │  (context wrap)  │
                                    └──────────────────┘
                                              │
                                              ▼
                                    ┌──────────────────┐
                                    │  RoleProtected   │
                                    │     Route        │
                                    │ (access control) │
                                    └──────────────────┘
```

---

## Portal Flows

### Candidate Portal

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        CANDIDATE USER FLOW                               │
└─────────────────────────────────────────────────────────────────────────┘

[Public]                    [Authenticated]
   │                             │
   ▼                             ▼
┌─────────┐    ┌─────────┐    ┌─────────────┐    ┌─────────────┐
│ Landing │───▶│ Register│───▶│    Login    │───▶│  Dashboard  │
│  Page   │    │  Page   │    │    Page     │    │             │
└─────────┘    └─────────┘    └─────────────┘    └──────┬──────┘
                                                        │
           ┌────────────────────────────────────────────┼────┐
           │                                            │    │
           ▼                                            ▼    ▼
    ┌─────────────┐    ┌─────────────┐    ┌─────────┐  ┌──────────┐
    │Interview    │◀──▶│ Interview   │───▶│ Reports │  │ Profile  │
    │  Setup     │    │    Room     │    │         │  │          │
    └─────────────┘    └─────────────┘    └────┬────┘  └──────────┘
                                               │
                                               ▼
                                        ┌────────────┐
                                        │  Settings  │
                                        └────────────┘
```

#### Candidate Journey

1. **Registration**
   - Choose role: Candidate
   - Account details (email, password)
   - Desired role & skills selection
   - Professional links (LinkedIn, GitHub)
   - CV/Resume upload

2. **Dashboard**
   - Interview history & statistics
   - Quick actions (Start Interview, View Reports)
   - Performance metrics
   - Recommended communities

3. **Interview Setup**
   - Select role category (Engineering, Design, Data, etc.)
   - Choose specific position
   - Pick interview type (Technical, Behavioral, Mixed)
   - Configure difficulty level
   - Launch Interview Room

4. **Interview Room**
   - AI-powered interview simulation
   - Real-time question-answer interface
   - Timer and progress tracking
   - Code editor (for technical roles)
   - Submit for assessment

5. **Interview Report**
   - AI-generated feedback
   - Performance scoring (Technical, Communication, Problem-solving)
   - Strengths & improvement areas
   - Transcript replay
   - Share/download report

6. **Communities**
   - Browse professional communities
   - Join request system
   - Community-specific discussions
   - Networking opportunities

7. **Profile & Settings**
   - Personal information management
   - Skills & experience update
   - Resume management
   - Notification preferences
   - Account security

---

### Company Portal

```
┌─────────────────────────────────────────────────────────────────────────┐
│                         COMPANY USER FLOW                                │
└─────────────────────────────────────────────────────────────────────────┘

[Public]                    [Authenticated - Pending]   [Authenticated - Active]
   │                              │                            │
   ▼                              ▼                            ▼
┌─────────┐    ┌─────────┐    ┌──────────┐              ┌─────────────┐
│ Landing │───▶│ Register│───▶│  Pending │───────────────▶│  Dashboard  │
│  Page   │    │  Page   │    │  Approval│   (approved)   │             │
└─────────┘    └─────────┘    └──────────┘              └──────┬──────┘
                                                                │
           ┌────────────────────────────────────────────────────┼────┐
           │                                                    │    │
           ▼                                                    ▼    ▼
    ┌─────────────┐    ┌─────────────┐    ┌─────────┐    ┌──────────┐
    │    Jobs     │◀──▶│   Create    │    │Candidates│    │  Team    │
    │ Management  │    │    Job      │    │  (All)   │    │          │
    └─────────────┘    └─────────────┘    └────┬────┘    └──────────┘
                                               │
                                               ▼
                                        ┌────────────┐
                                        │ Analytics  │
                                        └────────────┘
```

#### Company Journey

1. **Registration**
   - Choose role: Company
   - Account details (email, password)
   - Company information (name, industry, size, website, description)
   - Company logo upload (optional)

2. **Pending Approval**
   - Account verification status page
   - Wait for admin approval
   - Email notification on approval

3. **Dashboard**
   - Hiring pipeline overview
   - Active job postings
   - Recent candidate applications
   - Team activity feed
   - Quick statistics

4. **Job Management**
   - View all job postings
   - Create new job listing
   - Edit/publish/unpublish jobs
   - Job preview before publishing
   - Candidate pipeline per job

5. **Candidates**
   - All candidates database
   - Filter by skills, experience, status
   - View detailed candidate profiles
   - AI match scores
   - Interview reports access
   - Hiring status management

6. **Team Management**
   - Invite team members (HR, Recruiters, Hiring Managers)
   - Role-based access control
   - Team member activity
   - Permissions management

7. **Analytics**
   - Hiring funnel metrics
   - Time-to-hire analytics
   - Source effectiveness
   - Candidate quality scores
   - Exportable reports

8. **Settings**
   - Company profile management
   - Billing & subscription
   - Notification settings
   - Integration configuration

---

## Technology Stack

### Frontend Core

| Technology | Version | Purpose |
|------------|---------|---------|
| **React** | ^19.2.5 | UI library with concurrent features |
| **React Router DOM** | ^7.15.0 | Client-side routing |
| **Vite** | ^8.0.10 | Build tool & dev server |
| **Zustand** | ^5.0.13 | State management |

### Styling & UI

| Technology | Version | Purpose |
|------------|---------|---------|
| **Tailwind CSS** | ^3.4.19 | Utility-first CSS framework |
| **@tailwindcss/vite** | ^4.2.4 | Vite plugin for Tailwind |
| **shadcn/ui** | ^4.7.0 | Component library |
| **@base-ui/react** | ^1.4.1 | Headless UI primitives |
| **lucide-react** | ^1.14.0 | Icon library |
| **class-variance-authority** | ^0.7.1 | Component variant management |
| **tailwind-merge** | ^3.5.0 | Class name merging |
| **clsx** | ^2.1.1 | Conditional class names |
| **tw-animate-css** | ^1.4.0 | Tailwind animations |
| **@fontsource-variable/geist** | ^5.2.8 | Typography |

### Development Tools

| Technology | Version | Purpose |
|------------|---------|---------|
| **ESLint** | ^10.2.1 | Code linting |
| **@eslint/js** | ^10.0.1 | ESLint JavaScript plugin |
| **eslint-plugin-react-hooks** | ^7.1.1 | React Hooks linting |
| **eslint-plugin-react-refresh** | ^0.5.2 | Fast Refresh linting |
| **PostCSS** | ^8.5.14 | CSS processing |
| **Autoprefixer** | ^10.5.0 | CSS vendor prefixes |
| **@vitejs/plugin-react** | ^6.0.1 | Vite React plugin |
| **@types/node** | ^25.6.2 | Node.js types |
| **@types/react** | ^19.2.14 | React types |
| **@types/react-dom** | ^19.2.3 | ReactDOM types |

### Storage & Data

| Technology | Purpose |
|------------|---------|
| **localStorage** | Client-side persistence for auth & data |
| **Mock Data Layer** | Simulated API responses (development) |

---

## Project Structure

```
IntelliHire/
├── IntelliHire-FE/                    # Frontend Application
│   ├── public/                          # Static assets
│   ├── src/
│   │   ├── api/                         # API layer
│   │   │   ├── authApi.js               # Authentication API
│   │   │   └── client.js                # HTTP client
│   │   │
│   │   ├── components/                  # React components
│   │   │   ├── auth/                    # Auth components
│   │   │   │   ├── AuthProvider.jsx
│   │   │   │   ├── GuestRoute.jsx
│   │   │   │   └── RoleProtectedRoute.jsx
│   │   │   │
│   │   │   ├── layout/                  # Layout components
│   │   │   │   ├── Footer.jsx
│   │   │   │   ├── Header.jsx
│   │   │   │   └── Sidebar.jsx
│   │   │   │
│   │   │   ├── shared/                  # Shared UI components
│   │   │   │   ├── Button.jsx
│   │   │   │   ├── Card.jsx
│   │   │   │   ├── Toast.jsx
│   │   │   │   ├── SkeletonLoader.jsx
│   │   │   │   ├── EmptyState.jsx
│   │   │   │   ├── ConfirmDialog.jsx
│   │   │   │   └── IntelliHireLogo.jsx
│   │   │   │
│   │   │   └── ui/                      # shadcn/ui components
│   │   │       └── (button, card, etc.)
│   │   │
│   │   ├── config/                      # Configuration
│   │   │   └── routes.js                # Route definitions & roles
│   │   │
│   │   ├── data/                        # Static data & stores
│   │   │   ├── candidatesData.js
│   │   │   ├── communitiesData.js
│   │   │   ├── jobsStore.js
│   │   │   ├── rolesData.js
│   │   │   └── skillsData.js
│   │   │
│   │   ├── hooks/                       # Custom hooks
│   │   │   ├── useAuth.js
│   │   │   ├── useInView.js
│   │   │   ├── useKeyShortcut.js
│   │   │   ├── useScrollLock.js
│   │   │   └── useToast.js
│   │   │
│   │   ├── lib/                         # Utility libraries
│   │   │   └── utils.js                 # cn() helper
│   │   │
│   │   ├── pages/                       # Page components
│   │   │   ├── public/                  # Public pages
│   │   │   │   ├── LandingPage.jsx
│   │   │   │   ├── LoginPage.jsx
│   │   │   │   ├── RegisterPage.jsx
│   │   │   │   ├── NotFoundPage.jsx
│   │   │   │   └── UnauthorizedPage.jsx
│   │   │   │
│   │   │   ├── candidate/               # Candidate portal
│   │   │   │   ├── CandidateDashboard.jsx
│   │   │   │   ├── CandidateProfile.jsx
│   │   │   │   ├── CandidateReports.jsx
│   │   │   │   ├── InterviewSetup.jsx
│   │   │   │   ├── InterviewRoom.jsx
│   │   │   │   ├── InterviewReport.jsx
│   │   │   │   ├── CandidateCommunities.jsx
│   │   │   │   └── CandidateSettings.jsx
│   │   │   │
│   │   │   └── company/                 # Company portal
│   │   │       ├── CompanyPending.jsx
│   │   │       ├── CompanyOnboarding.jsx
│   │   │       ├── CompanyDashboard.jsx
│   │   │       ├── CompanyJobs.jsx
│   │   │       ├── CompanyJobCreate.jsx
│   │   │       ├── CompanyJobPreview.jsx
│   │   │       ├── CompanyCandidates.jsx
│   │   │       ├── CompanyAllCandidates.jsx
│   │   │       ├── CompanyCandidateProfile.jsx
│   │   │       ├── CompanyTeam.jsx
│   │   │       ├── CompanyAnalytics.jsx
│   │   │       ├── CompanyCommunity.jsx
│   │   │       └── CompanySettings.jsx
│   │   │
│   │   ├── store/                         # State management
│   │   │   └── authStore.js               # Zustand auth store
│   │   │
│   │   ├── App.jsx                        # Root component
│   │   ├── App.css                        # Global styles
│   │   ├── index.css                      # Tailwind entry
│   │   └── main.jsx                       # App entry point
│   │
│   ├── index.html
│   ├── package.json
│   ├── vite.config.js
│   ├── tailwind.config.js
│   ├── postcss.config.js
│   ├── eslint.config.js
│   └── jsconfig.json
│
└── projectReadme.md                         # This file
```

---

## Key Features

### AI-Powered Interview System

| Feature | Description |
|---------|-------------|
| **Mock Interviews** | Realistic AI-generated interview scenarios |
| **Role-Based Questions** | Tailored questions for specific job roles |
| **Code Challenges** | Live coding environment for technical roles |
| **Performance Analytics** | Detailed scoring across multiple dimensions |
| **Feedback Generation** | AI-generated improvement suggestions |

### Candidate Management

| Feature | Description |
|---------|-------------|
| **Smart Profiles** | Comprehensive candidate profiles with skills |
| **Interview History** | Complete record of all mock interviews |
| **Progress Tracking** | Performance trends over time |
| **Community Access** | Professional networking groups |
| **Report Sharing** | Export and share interview reports |

### Hiring Management

| Feature | Description |
|---------|-------------|
| **Job Posting** | Create and manage job listings |
| **Pipeline Management** | Track candidates through hiring stages |
| **Team Collaboration** | Multi-user hiring teams |
| **AI Matching** | Automated candidate-job fit scoring |
| **Analytics Dashboard** | Hiring metrics and insights |

### Security & Access Control

| Feature | Description |
|---------|-------------|
| **Role-Based Access** | Candidate, Company, Admin roles |
| **Protected Routes** | Authenticated route guards |
| **Guest Access** | Public pages for unauthenticated users |
| **Account Verification** | Company approval workflow |

---

## Getting Started

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn

### Installation

```bash
# Clone the repository
git clone <repository-url>

# Navigate to project
cd IntelliHire/IntelliHire-FE

# Install dependencies
npm install

# Start development server
npm run dev
```

### Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server |
| `npm run build` | Build for production |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint |

### Demo Credentials

The application includes demo accounts for testing:

```
Candidate: candidate@test.com / password123
Company:   company@test.com   / password123
```

---

## Development Guidelines

### Code Style

- **Components**: PascalCase (e.g., `CandidateDashboard.jsx`)
- **Hooks**: camelCase with `use` prefix (e.g., `useAuth.js`)
- **Utilities**: camelCase (e.g., `utils.js`)
- **CSS**: Tailwind utility classes preferred

### State Management

- Use **Zustand** for global state (auth, user data)
- Use **React useState** for local component state
- Use **URL params** for shareable/filterable state

### Routing

- Public routes: `/`, `/login`, `/register`
- Candidate routes: `/candidate/*`
- Company routes: `/company/*`
- Protected by `RoleProtectedRoute` component

### Component Patterns

```jsx
// Page Component Structure
function PageName() {
  // Hooks
  const navigate = useNavigate();
  const { user } = useAuth();
  
  // Local state
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(false);
  
  // Effects
  useEffect(() => {
    fetchData();
  }, []);
  
  // Handlers
  const handleAction = () => { ... };
  
  // Render
  return (
    <div className="min-h-screen bg-[#F9FAFB]">
      {/* Layout */}
    </div>
  );
}
```

---

## License

[Your License Here]

## Contributors

[Your Team/Contributors]

---

<p align="center">
  <strong>IntelliHire</strong> - AI-Powered Recruitment Platform
  <br>
  Built with ❤️ using React, Tailwind CSS & Vite
</p>
