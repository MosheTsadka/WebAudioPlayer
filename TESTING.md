# Testing and Linting Recommendations

## Backend (Node.js + Express)
- **Unit tests** with **Jest** for library scanning utilities, metadata parsing, and filename normalization.
- **API tests** with **Supertest** for album listing/detail endpoints, streaming range responses, upload flows (albums/tracks), rescans, and delete operations.
- **Integration tests** using a temporary filesystem (e.g., `tmp` or `fs.mkdtemp`) to simulate album directories, ensuring async scans and upload handlers persist files correctly.
- **Linting** with **ESLint** (Node + Jest environment) and **Prettier** for consistent style; add `npm run lint` and `npm run format` scripts.
- **Type checks** (optional) with **TypeScript** or **JSDoc** + **tsc --noEmit** if you migrate types.

## Frontend (React + Vite)
- **Component tests** with **React Testing Library** + **Jest/Vitest** for AlbumList, AlbumDetail (delete flows, loading/empty states), PlayerBar controls, and UploadPage form behavior.
- **Integration tests** mocking `/api` responses to verify navigation and state sharing across pages (hash routing and playback state).
- **Linting/formatting** with **ESLint** (React hooks rules) and **Prettier**; add `npm run lint` and `npm run format` scripts via Vite plugins if desired.
- **Type checks** (optional) with **TypeScript** or **JSDoc** + **tsc --noEmit** for earlier bug detection.

## Continuous Checks
- Configure **CI** (GitHub Actions) to run lint, tests, and `npm run build` for both `backend` and `frontend` to ensure production readiness.
