# School Management API

A REST API for managing a school: users, teachers, students, classes, courses,
enrollments, attendance, lessons, assignments, submissions, exams, grading,
groups, certificates, announcements, notifications, school rules and audit
logs.

Built with [NestJS](https://nestjs.com), TypeORM and PostgreSQL. All routes are
versioned under `/api/v1`.

## Requirements

- Node.js 22+
- PostgreSQL 14+

## Setup

```bash
npm install
cp .env.example .env   # create this file if it does not exist
```

Configure `.env`:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USERNAME=postgres
DB_PASSWORD=your_password
DB_DATABASE=school_management

JWT_SECRET=replace_with_a_long_random_secret
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN_DAYS=7

PORT=3000
FRONTEND_URL=http://localhost:4200
CLASS_JOIN_CODE_SECRET=optional_secret_for_qr_tokens
```

Create the database, then make sure the schema matches the entities. The app
does not run with `synchronize: true`, so apply migrations or create the schema
with the provided helper:

```bash
npx ts-node --esm src/scripts/sync-schema.ts
```

## Run

```bash
npm run start:dev    # watch mode
npm run start        # normal mode
npm run build        # compile to dist/
npm run start:prod   # run compiled build
```

The API is then available at `http://localhost:3000/api/v1`.

## Authentication and roles

Register or sign in through `/api/v1/auth`:

| Method | Path              | Description                    |
| ------ | ----------------- | ------------------------------ |
| POST   | `/auth/register`  | Create an account              |
| POST   | `/auth/login`     | Get access and refresh tokens  |
| POST   | `/auth/refresh`   | Rotate tokens                  |
| POST   | `/auth/logout`    | Revoke the current refresh token |
| GET    | `/auth/me`        | Current user profile           |

Send the access token on protected routes:

```http
Authorization: Bearer <accessToken>
```

Roles are `admin`, `teacher` and `student`. Access is enforced both by role
guards and by ownership checks (teachers can normally only manage their own
classes, students only their own records).

## Modules

| Module          | Base path              | Who can use it                                  |
| --------------- | ---------------------- | ----------------------------------------------- |
| Auth            | `/auth`                | Public / authenticated                          |
| Users           | `/users`               | Admin                                           |
| Teachers        | `/teachers`            | Admin, teacher (self-service)                   |
| Students        | `/students`            | Admin, teacher, student (self-service)          |
| Courses         | `/courses`             | Read: authenticated; write: admin               |
| Classes         | `/classes`             | Admin, teacher, enrolled students               |
| Buildings       | `/buildings`           | Read: authenticated; write: admin               |
| Floors          | `/floors`              | Read: authenticated; write: admin               |
| Rooms           | `/rooms`               | Read: authenticated; write: admin               |
| Enrollments     | `/enrollments`         | Admin, teacher                                  |
| Class joining   | `/class-registration`  | Students with a join token                      |
| Join QR codes   | `/classes/:id/qr`      | Admin, class teacher                            |
| Attendance      | `/attendance`          | Admin, teacher, student (own records)           |
| Lessons         | `/lessons`             | Admin, teacher, enrolled students               |
| Assignments     | `/assignments`         | Admin, teacher, enrolled students               |
| Submissions     | `/submissions`         | Students (own), teachers, admin                 |
| Exams           | `/exams/attempts`      | Students (own), teachers, admin                 |
| Grading         | `/grading/grade-scales`, `/grading/scores` | Admin, teacher (scores also readable by students) |
| Groups          | `/groups`              | Admin, teacher, group members                   |
| Certificates    | `/certificates`        | Students (own), teachers, admin                 |
| Announcements   | `/announcements`       | Admin, teacher (authoring); all (reading)       |
| Notifications   | `/notifications`       | Current user; admin can create/broadcast        |
| School rules    | `/school-rules`        | Read: authenticated; write: admin               |
| Audit logs      | `/audit-logs`          | Admin                                           |

### Exams

- `POST /exams/attempts` — start an attempt (students start their own).
- `GET /exams/attempts` — list attempts, scoped by role.
- `GET /exams/attempts/assignment/:assignmentId` — attempts for an assignment.
- `GET /exams/attempts/:id` — attempt details.
- `PATCH /exams/attempts/:id` — update status/score (teachers/admin).
- `POST /exams/attempts/:id/submit` — submit an attempt.
- `DELETE /exams/attempts/:id` — delete an attempt.

### Grading

- `GET|POST /grading/grade-scales` and `GET|PATCH|DELETE /grading/grade-scales/:id`
  — manage grade scales (writes are admin-only).
- `POST /grading/scores` — grade a submission.
- `GET /grading/scores` — filter by submission, class, student or teacher.
- `GET /grading/scores/class/:classId` — class scores.
- `GET /grading/scores/submission/:submissionId` — scores for one submission.
- `GET|PATCH|DELETE /grading/scores/:id` — score details and updates.

### Groups

- `POST /groups` — create a group for a class.
- `GET /groups` — list groups (students only see groups they belong to).
- `GET /groups/class/:classId` — groups in a class.
- `GET|PATCH|DELETE /groups/:id` — group details and management.
- `POST|GET /groups/:id/members` — add/list members.
- `DELETE /groups/:id/members/:memberId` — remove a member.
- `POST|GET /groups/:id/messages` — group chat.
- `DELETE /groups/:id/messages/:messageId` — delete a message.

### Certificates

- `POST /certificates/requests` — request a certificate.
- `GET /certificates/requests` — list requests, scoped by role.
- `GET /certificates/requests/:id` — request details.
- `PATCH /certificates/requests/:id/review` — approve or reject.
- `POST /certificates/requests/:id/issue` — issue a certificate.
- `DELETE /certificates/requests/:id` — delete a pending request.
- `GET /certificates` — list issued certificates, scoped by role.
- `GET|PATCH /certificates/:id` — certificate details and file URL.
- `DELETE /certificates/:id` — delete a certificate (admin).

### Notifications

- `GET /notifications` — current user's notifications (`isRead`, `type`,
  `page`, `limit`).
- `GET /notifications/unread-count` — unread badge count.
- `GET /notifications/:id` — notification details.
- `PATCH /notifications/:id/read` — mark one notification as read.
- `POST /notifications/read-all` — mark everything as read.
- `DELETE /notifications/read` — clear read notifications.
- `DELETE /notifications/:id` — delete one notification.
- `POST /notifications` — create a notification for a user (admin).
- `POST /notifications/broadcast` — send to a role or everyone (admin).

### School rules and audit

- `GET /school-rules` — active rules for everyone; admin can filter all.
- `GET /school-rules/:id` — rule details.
- `POST|PATCH|DELETE /school-rules` — manage rules (admin).
- `GET /audit-logs` — filter by actor, action, entity and date range (admin).
- `GET /audit-logs/stats` — audit activity summary (admin).
- `GET /audit-logs/:id` — one audit entry (admin).
- `POST /audit-logs` — record an entry manually (admin).
- `DELETE /audit-logs/:id` — delete an entry (admin).

## Class registration by QR

Teachers and administrators can let students enroll in a class by scanning a
QR code.

1. **Create a class** (`POST /api/v1/classes`). The response includes a
   `registration` object with a scannable `qrCodeDataUrl` and the
   `registrationUrl` the QR points to.
2. **Re-open the QR later** with `GET /api/v1/classes/:classId/qr`. Every
   active code returns its `registrationUrl` and `qrCodeDataUrl`.
3. **Create an extra code** with `POST /api/v1/classes/:classId/qr`
   (optional `{ "expiresInHours": 24 }`, maximum 720 hours).
4. **Revoke a code** with `DELETE /api/v1/classes/:classId/qr/:qrId`.

Students scan the QR, open `GET /api/v1/class-registration/:token` to preview
the class, then call `POST /api/v1/class-registration/:token/join` while signed
in with an active student account. Joining creates an active enrollment and an
enrollment status-history entry.

Teachers can only manage QR codes for their own classes; administrators can
manage any class. Set `FRONTEND_URL` (defaults to `http://localhost:4200`) so
the QR links open the student-facing registration page. Set
`CLASS_JOIN_CODE_SECRET` to sign invitation tokens (falls back to
`JWT_SECRET`).

## Tests

```bash
npm run test         # unit tests
npm run test:e2e     # end-to-end tests
npm run test:cov     # coverage
npm run lint         # oxlint
```

## Docker

The API has a multi-stage `Dockerfile` and can be run together with PostgreSQL
and the web app through the Compose stack in the parent directory:

```bash
# from School-Project/
cp .env.example .env       # then change the passwords/secrets
docker compose up -d --build
```

The API is available through the web proxy at
`http://localhost:8080/api/v1`. See `../DOCKER.md` for configuration,
production notes and backup commands.

## Project structure

```
src/
  auth/            authentication and refresh tokens
  users/           user accounts and roles
  teachers/        teacher profiles and skills
  students/        student profiles and academic history
  classes/         classes, schedules, buildings, floors and rooms
  courses/         course catalogue
  enrollments/     class enrollments and status history
  attendance/      attendance records
  lessons/         lesson plans
  assignments/     assignments, attachments and comments
  submissions/     student/group submissions and attachments
  exams/           exam attempts
  grading/         grade scales and scores
  groups/          student groups, members and messages
  certificates/    certificate requests and issued certificates
  announcements/   announcements and read receipts
  notifications/   in-app notifications
  school-rules/    school policy documents
  audit/           audit trail
  common/          guards, decorators, JWT strategy and access helpers
  database/        TypeORM configuration and migrations
```
