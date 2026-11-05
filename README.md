# Kholasat Al-Mofeed

Arabic RTL full-stack learning-video library built with React, Vite, Express, SQLite, YouTube Data API v3 and Google Gemini.

This repository contains the complete source code, including the integrated owner dashboard for securely storing, masking, testing and deleting YouTube/Gemini API keys. API secrets stored in SQLite are encrypted with AES-256-GCM.

- Arabic setup and full feature documentation: [`README_AR.md`](README_AR.md)
- Security and secret-handling policy: [`SECURITY.md`](SECURITY.md)
- Change history: [`CHANGELOG.md`](CHANGELOG.md)

Requirements: Node.js 20+ and npm. Run `npm install`, configure `.env` based on `.env.example`, then `npm run dev`. For Docker, use `docker compose up --build -d`.

GitHub stores source code; it does not run the Node.js server or persist the SQLite database. Public deployment requires a Node.js runtime or Docker host and persistent storage for `data/`.
