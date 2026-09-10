# Custom Vault Service — ระบบบริหารจัดการลูกค้าและโครงการ

> ระบบ Web Application แบบ Full-Stack สำหรับทีม IT / System Integrator ใช้จัดการข้อมูลลูกค้า โครงการ โครงสร้างพื้นฐาน (Infrastructure) และเอกสารทางเทคนิคในที่เดียว

---

## ภาพรวมโครงการ (Overview)

**QQM** เป็น Internal Management Platform ที่ออกแบบมาสำหรับทีมวิศวกรรมและ System Integrator เพื่อใช้เป็นศูนย์กลางในการจัดเก็บและติดตามข้อมูลทุกอย่างที่เกี่ยวข้องกับลูกค้าและโครงการ ตั้งแต่รายละเอียดเซิร์ฟเวอร์ สภาพแวดล้อม (Environments) ตารางงานบำรุงรักษา ไปจนถึงวันหมดอายุของ SSL Certificate และ License ต่างๆ

ระบบแบ่งออกเป็น 2 ส่วนหลัก คือ **Backend API** (Node.js/Express + TypeScript) และ **Frontend SPA** (React + Vite) โดยใช้ **PostgreSQL** เป็นฐานข้อมูล และ **Docker Compose** สำหรับการ Deploy ทั้งในโหมด Development และ Production

---

## คุณสมบัติหลัก (Key Features)

| หมวดหมู่ | รายละเอียด |
|---|---|
| 📁 **จัดการโครงการ (Projects)** | เชื่อมโยงโครงการกับลูกค้า กำหนดทีมงานและบทบาทในโครงการ |
| 🌐 **จัดการสภาพแวดล้อม (Environments)** | ติดตาม Environment ของแต่ละโครงการ (เช่น Dev, Staging, Production) พร้อมสถานะ และ VPN |
| 🖥️ **จัดการเซิร์ฟเวอร์ (Servers)** | บันทึก Hostname, IP Address, Tech Stack, Monitoring URL พร้อมรองรับการ Import จำนวนมาก |
| 👥 **จัดการบุคคล (People)** | จัดเก็บข้อมูลบุคลากรทั้ง Internal Engineer, Vendor, Client Contact, Project Owner และ Approver |
| 📚 **จัดการทรัพยากร (Resources)** | เก็บ Runbook, SOP, Architecture Diagram, Troubleshooting Guide, FAQ, Link, และ PDF พร้อม Version Control |
| 📅 **ตารางงาน (Schedules)** | วางแผนงาน PM (Preventive Maintenance), MA (Maintenance Activities) และงานอื่นๆ |
| ⚠️ **ติดตามวันหมดอายุ (Expirations)** | แจ้งเตือนล่วงหน้าเมื่อ SSL Certificate, Hardware MA Contract, Software License, Domain, หรือ Cloud Service ใกล้หมดอายุ |
| 📊 **Dashboard ภาพรวม (Overview)** | หน้าสรุปภาพรวมของระบบทั้งหมด |
| 🗺️ **Infrastructure View** | มุมมองภาพรวมโครงสร้างพื้นฐาน |
| 📜 **Activity Log** | บันทึกประวัติการเปลี่ยนแปลงข้อมูลทุกรายการในระบบ (Append-only, ไม่สามารถแก้ไขหรือลบได้) |
| 🔍 **ค้นหาทั่วทั้งระบบ (Global Search)** | ค้นหาข้อมูลข้ามตารางในฐานข้อมูลได้จากจุดเดียว |
| 🔐 **ระบบ Authentication & Settings** | Login ด้วย JWT, รองรับหลาย Role (admin/member), จัดการผู้ใช้, มี Dark/Light Mode |

---

## Tech Stack

### Backend
| ส่วนประกอบ | เทคโนโลยี |
|---|---|
| ภาษา | TypeScript 5 |
| Framework | Express.js 5 |
| Runtime | Node.js 20 |
| ฐานข้อมูล | PostgreSQL 16 |
| Database Driver | `pg` (node-postgres) |
| Authentication | JWT (`jsonwebtoken`) + bcrypt |
| Validation | Zod 4 |
| File Upload | Multer 2 |
| API Documentation | Swagger UI Express + OpenAPI (YAML) |
| Testing | Jest + Supertest |

### Frontend
| ส่วนประกอบ | เทคโนโลยี |
|---|---|
| ภาษา | TypeScript 6 |
| Framework | React 19 |
| Build Tool | Vite 8 |
| UI Components | shadcn/ui (Radix UI Primitives) |
| Styling | Tailwind CSS 3 |
| Routing | React Router DOM 7 |
| Data Fetching | TanStack Query (React Query) 5 + `openapi-fetch` |
| Type-safe API | `openapi-typescript` (auto-generate จาก `openapi.yaml`) |
| Icons | Lucide React |
| Date Handling | `date-fns` + `react-day-picker` |
| Unit Testing | Vitest + Testing Library |
| E2E Testing | Playwright |
| Linting | OxLint |

### Infrastructure & DevOps
| ส่วนประกอบ | เทคโนโลยี |
|---|---|
| Containerization | Docker + Docker Compose |
| Frontend Web Server | Nginx (ใน Production container) |
| Font | Inter (Google Fonts) |

---

## ข้อกำหนดเบื้องต้น (Prerequisites)

ต้องติดตั้งซอฟต์แวร์ต่อไปนี้บนเครื่องก่อนเริ่มใช้งาน:

### วิธีที่ 1: Docker (แนะนำ)

- **Docker Desktop** เวอร์ชัน 24.0+ (รวม Docker Compose v2)
  - Windows: https://docs.docker.com/desktop/install/windows-install/

### วิธีที่ 2: Local Development (ไม่ใช้ Docker)

- **Node.js** เวอร์ชัน 20.x LTS
- **npm** (มาพร้อมกับ Node.js)
- **PostgreSQL** เวอร์ชัน 16 (ต้องติดตั้งและรันแยกต่างหาก)

---

## การเริ่มต้นใช้งาน (Getting Started)

### ขั้นตอนที่ 1: ตั้งค่า Environment Variables

คัดลอกไฟล์ตัวอย่างและแก้ไขตามต้องการ:

```bash
cp .env.example .env
```

เปิดไฟล์ `.env` และแก้ไขค่าต่อไปนี้:

```env
# ข้อมูลสำหรับ PostgreSQL
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres          # เปลี่ยนเป็นรหัสผ่านที่แข็งแรงสำหรับ Production
POSTGRES_DB=client_project_mgmt

# Connection String สำหรับ Backend (ชี้ไปที่ service "db" ใน Docker)
DATABASE_URL=postgresql://postgres:postgres@db:5432/client_project_mgmt

# Secret Key สำหรับ JWT (เปลี่ยนเป็น String สุ่มที่ยาวและปลอดภัย)
JWT_SECRET=change-me-to-a-long-random-secret

# Port ของ Backend
PORT=4000
```

---

### วิธีที่ 1: รันด้วย Docker Compose (แนะนำ)

#### สำหรับ Local Development

คำสั่งนี้จะสร้าง Image และเริ่มต้น 3 Services พร้อมกัน: `db` (PostgreSQL), `backend`, `frontend`

```bash
docker compose up -d --build
```

หลังจาก Container รันแล้ว ระบบจะ **Auto-migrate ฐานข้อมูล** ให้อัตโนมัติเมื่อ Backend เริ่มต้น

**เข้าถึงแอปพลิเคชัน:**

| ส่วน | URL |
|---|---|
| Frontend (UI) | http://localhost:5173 |
| Backend API | http://localhost:4000 |
| Swagger API Docs | http://localhost:4000/api/docs |
| Health Check | http://localhost:4000/health |

#### สำหรับ Production (Deploy บน Remote Server / LAN)

ใช้ไฟล์ Overlay `docker-compose.prod.yml` ซึ่งจะ Bake URL ของ Backend ที่ถูกต้องลงไปใน Frontend Bundle:

```bash
# กำหนด IP หรือ Domain ของ Server (ต้องเป็น Address ที่ Browser ของผู้ใช้เข้าถึงได้)
export VITE_API_BASE_URL=http://192.168.1.85:4000/api

docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

**หยุดระบบ:**
```bash
docker compose down
```

**หยุดและลบข้อมูลฐานข้อมูลทั้งหมด (ระวัง!):**
```bash
docker compose down -v
```

---

### วิธีที่ 2: รันทุก Service พร้อมกันผ่าน npm (แนะนำสำหรับ Dev)

คำสั่งเดียวจะเริ่ม Docker Database (Postgres), รัน Migration อัตโนมัติ, และสตาร์ททั้ง Backend (พอร์ต 4000) และ Frontend (พอร์ต 5173) พร้อม Hot-reload:

```bash
npm start
# หรือ npm run dev
```

---

### วิธีที่ 3: Local Development (แยก Terminal)

ต้องมี PostgreSQL รันอยู่แล้ว และตั้งค่า `DATABASE_URL` ใน `backend/.env` ให้ชี้ไปที่ `localhost`

**ติดตั้งและรัน Backend:**

```bash
cd backend
npm install

# รัน Database Migration
npm run migrate

# (Optional) โหลดข้อมูลตัวอย่าง — จะสร้าง User: admin / Password: admin123
npm run seed

# รันในโหมด Development พร้อม Hot-reload
npm run dev
# Backend จะรันที่ http://localhost:4000
```

**ติดตั้งและรัน Frontend** (เปิด Terminal ใหม่):

```bash
cd frontend
npm install
npm run dev
# Frontend จะรันที่ http://localhost:5173
```

---

### บัญชีผู้ใช้เริ่มต้น (Default Credentials)

หลังจาก Seed ข้อมูลแล้ว สามารถ Login ด้วย:

| Field | ค่า |
|---|---|
| Username | `admin` |
| Password | `admin123` |

> **สำคัญ:** เปลี่ยนรหัสผ่านทันทีหลังจาก Login ครั้งแรกในสภาพแวดล้อม Production

---

## โครงสร้างโปรเจกต์ (Project Structure)

```
QQM/
├── .env.example              # ตัวอย่าง Environment Variables (คัดลอกเป็น .env)
├── docker-compose.yml        # Docker Compose หลักสำหรับ Local / Development
├── docker-compose.prod.yml   # Overlay สำหรับ Deploy บน Remote Server
│
├── backend/                  # Node.js / Express API Server
│   ├── Dockerfile            # Multi-stage Docker Build (build -> runtime)
│   ├── package.json
│   ├── tsconfig.json
│   ├── openapi.yaml          # OpenAPI Specification (auto-generated)
│   └── src/
│       ├── index.ts          # Entry Point — เริ่มต้น HTTP Server
│       ├── app.ts            # ตั้งค่า Express App, Middleware, และ Routes ทั้งหมด
│       ├── controllers/      # Request/Response Handler แยกตาม Resource
│       ├── services/         # Business Logic Layer
│       ├── routes/           # API Endpoints (13 Route Files)
│       ├── middleware/       # Auth (JWT), Error Handler
│       ├── validators/       # Zod Schema สำหรับ Validate Request Body
│       ├── db/
│       │   ├── pool.ts       # PostgreSQL Connection Pool
│       │   ├── migrate.ts    # รัน SQL Migration Files ตามลำดับ
│       │   ├── seed.ts       # สร้างข้อมูลตัวอย่างเบื้องต้น
│       │   └── migrations/   # SQL Migration Files (001_init.sql ถึง 013_...)
│       ├── types/
│       ├── utils/
│       └── openapi/          # Script สำหรับ Generate openapi.yaml
│
└── frontend/                 # React SPA (Single Page Application)
    ├── Dockerfile            # Build React App แล้วเสิร์ฟด้วย Nginx
    ├── nginx.conf
    ├── package.json
    ├── vite.config.ts
    ├── tailwind.config.js
    ├── components.json       # shadcn/ui Configuration
    ├── index.html
    └── src/
        ├── main.tsx
        ├── App.tsx           # Root Component (Providers: Query, Theme, Router)
        ├── routes/
        │   └── AppRoutes.tsx # กำหนด URL Routes ทั้งหมดของแอป
        ├── features/         # Feature Modules แยกตามฟังก์ชัน
        │   ├── auth/         # Login Page, Auth State
        │   ├── overview/     # Dashboard หน้าแรก
        │   ├── clients/      # จัดการลูกค้า
        │   ├── projects/     # จัดการโครงการ
        │   ├── environments/ # จัดการสภาพแวดล้อม
        │   ├── servers/      # จัดการเซิร์ฟเวอร์
        │   ├── infrastructure/
        │   ├── people/       # จัดการบุคลากร
        │   ├── resources/    # จัดการเอกสาร/ทรัพยากร
        │   ├── schedule/     # จัดการตารางงาน
        │   ├── expirations/  # ติดตามวันหมดอายุ
        │   ├── activity/     # ประวัติการเปลี่ยนแปลง
        │   ├── settings/     # ตั้งค่า (จัดการผู้ใช้)
        │   └── theme/        # Dark/Light Mode Provider
        ├── components/       # Shared/Reusable UI Components
        ├── api/              # API Client และ Type-safe Schema (auto-generated)
        ├── hooks/
        ├── lib/
        ├── types/
        └── styles/
```

---

## คำสั่งที่มีประโยชน์ (Useful Commands)

### Backend Scripts

```bash
cd backend
npm run dev               # รันในโหมด Development พร้อม Hot-reload
npm run build             # Compile TypeScript เป็น JavaScript
npm start                 # รัน Production Build
npm run migrate           # รัน Database Migrations ที่ยังไม่ได้รัน
npm run seed              # โหลดข้อมูลตัวอย่างลงฐานข้อมูล
npm test                  # รัน Unit Tests ด้วย Jest
npm run generate:openapi  # Regenerate ไฟล์ openapi.yaml
```

### Frontend Scripts

```bash
cd frontend
npm run dev               # รัน Dev Server พร้อม Hot-reload
npm run build             # Build สำหรับ Production
npm run preview           # Preview Production Build
npm run lint              # รัน OxLint ตรวจสอบ Code
npm test                  # รัน Unit Tests ด้วย Vitest
npm run test:watch        # รัน Tests แบบ Watch Mode
npm run test:visual-sweep # รัน E2E Tests ด้วย Playwright
npm run generate:api      # Regenerate TypeScript Types จาก openapi.yaml
```

---

## หมายเหตุสำคัญ (Important Notes)

- **Swagger UI** (`/api/docs`) พร้อมใช้งานเฉพาะในโหมด Development เท่านั้น (`NODE_ENV !== 'production'`)
- **Activity Logs** เป็น Append-only — ระบบป้องกันการแก้ไขหรือลบบันทึก Log ด้วย Database Trigger
- **Credential References** ระบบเก็บเพียง "ที่อยู่" หรือ "ชื่อ" อ้างอิงของ Credential เท่านั้น ไม่ได้เก็บรหัสผ่านจริงในฐานข้อมูล
- **`VITE_API_BASE_URL`** ถูก Bake เข้าไปใน Frontend Bundle ตอน Build Time ดังนั้นการเปลี่ยน URL ของ Backend ต้อง Build ใหม่เท่านั้น
- **Database Migrations** รันอัตโนมัติทุกครั้งที่ Backend Container เริ่มต้น (ในโหมด Docker)

---

## License

[TO BE UPDATED: ระบุ License ของโครงการที่นี่]
