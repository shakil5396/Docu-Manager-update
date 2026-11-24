# Folio Vault

Folio Vault is a multi-user document manager with an HTML/CSS/JavaScript frontend, an Express API, MongoDB/Mongoose metadata, and private file storage in MongoDB Atlas GridFS. It reuses the existing `Assets/logo.png` and midnight-blue workspace design.

## Requirements

- Node.js 20.19 or newer and npm
- MongoDB 7+ (Atlas recommended)
- A long random `JWT_SECRET` (at least 32 characters)

## Run locally

1. Copy `backend/.env.example` to `backend/.env` and set `MONGODB_URI` and `JWT_SECRET`. The Atlas URI should name the application database, for example `mongodb+srv://<user>:<password>@<cluster>/<database>?retryWrites=true&w=majority`. URL-encode special characters in credentials. Never commit `.env` or share the URI.
2. In PowerShell:

```powershell
cd backend
npm install
npm start
```

Open [http://localhost:5000](http://localhost:5000). Set `SMTP_URL`, `SMTP_FROM`, and `APP_BASE_URL` only if you want password reset emails.

## Deploy to Render with GitHub and Atlas Free

The recommended setup is a Render **Web Service** using the GitHub repository root, build command `npm install`, and start command `node backend/server.js`. Select Node as the runtime. The root `package.json` installs the runtime dependencies.

Set these Render environment variables under **Environment**:

| Key | Value |
| --- | --- |
| `MONGODB_URI` | Your Atlas application database connection string (keep it private) |
| `JWT_SECRET` | A randomly generated secret of 32+ characters |
| `NODE_ENV` | `production` |
| `COOKIE_SECURE` | `true` |
| `TRUST_PROXY` | `1` |
| `ATLAS_FILE_STORAGE_LIMIT_MB` | `250` (default) |
| `MAX_FILE_SIZE_MB` | `20` (default) |
| `APP_BASE_URL` | Your HTTPS Render service URL |

Do not set AWS or S3 variables. Files are written to a GridFS bucket in Atlas and therefore do not depend on Render's temporary filesystem. GridFS data consumes the same Atlas storage quota as the rest of the database. Atlas M0 currently has a 512 MB total storage limit; this app caps file content at 250 MB by default to leave room for database records and indexes. A free tier is suitable for a small demo, not large production archives. If the existing Atlas project already uses substantial storage, lower `ATLAS_FILE_STORAGE_LIMIT_MB` accordingly.

Create an Atlas database user with only the needed read/write access to the app database, then allow the Render service's outbound IP ranges in Atlas **Network Access**. Do not leave `0.0.0.0/0` enabled longer than necessary. Keep `MONGODB_URI` and `JWT_SECRET` in Render's secret environment settings, never in GitHub. If the Atlas password was shared in chat, rotate it in Atlas and update the Render value before redeploying.

After setting the variables, save and redeploy the latest GitHub commit. Check `https://<your-service>/api/health` for a successful response with `database: "connected"`; then register a test account and verify file upload, preview, and download.

Render's free service may spin down after inactivity, which can make its first request slow. The app does not depend on a Render persistent disk for uploaded files. The GridFS quota reservation is stored in Atlas and enforced across service instances.

## First administrator

Register the administrator account through the app, then promote it from a trusted terminal using the same Atlas URI:

```powershell
cd backend
npm install
node scripts/promoteAdmin.js account@example.com
```

Registration cannot assign an administrator role. Admin routes are authorized by the backend.

## Features

- User registration/login/logout, bcrypt password hashes, expiring JWT cookies, account profile, single-use password reset links, and suspended-account enforcement.
- MongoDB models for users, documents, folders, document versions, shares, reports, password reset tokens, and audit logs.
- Private GridFS uploads, per-user and global capacity limits, size and file-signature checks, authorized preview/download, replacement version history, recycle/restore/permanent delete, search, sorting, favorites, categories, and folders.
- A dedicated Digital Vault with separate upload and explore experiences, six MIME-type collections, category search and sorting, grid/list layouts, PDF page thumbnails, and photo previews.
- Drag-and-drop multi-file upload with supported-type/size validation, category and folder selection, and transfer progress. PDF.js supports page navigation, zoom, fit-to-width, and print; images can be zoomed and printed, CSV gets a table preview, and unsupported Office formats remain downloadable originals with an honest preview fallback.
- Explicit document shares with view-only or download permission. Admin statistics and user management do not grant access to private files.
- Rate limiting, Helmet security headers, HttpOnly SameSite cookies, server-side ownership checks, and private object keys.

## Verification

Run `npm run check` and `npm test` from `backend/`. The included tests cover document ownership and sharing policy. Cloud persistence and browser workflows require a configured Atlas account and must be verified in the deployed environment; they are not claimed as tested here.
