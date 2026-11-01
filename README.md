# IntelliHire

AI-powered interview preparation, recruitment and talent community platform.

## Repository layout

| Folder | Contents |
| --- | --- |
| [`frontend/`](frontend) | React 19 + Vite web app (candidate, company and admin portals, public site) |
| [`backend/`](backend) | Backend API (to be implemented) |

## Branches

| Branch | Purpose |
| --- | --- |
| `main` | Integrated code for the whole project |
| `IntelliHire-frontend` | Frontend development |
| `IntelliHire-backend` | Backend development |

## Frontend

```bash
cd frontend
npm install
npm run dev
```

Deployment: set the hosting project's **Root Directory** to `frontend` (build command `npm run build`, output `dist`). The SPA rewrite lives in `frontend/vercel.json`.

## Backend

See [`backend/README.md`](backend/README.md).
