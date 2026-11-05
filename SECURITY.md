# Security Policy — Kholasat Al-Mofeed

## Reporting
Do not publish API keys, session cookies, database files, or exploitable details in public issues. Report suspected vulnerabilities privately to the repository owner.

## Secret handling
- Never commit `.env`, real API keys, session secrets, or SQLite database files.
- Store YouTube and Gemini keys through the owner dashboard or server environment variables only.
- Database-stored API keys are encrypted with AES-256-GCM. The encryption key is derived from `ADMIN_SESSION_SECRET` (falling back to `SESSION_SECRET`). Keep that secret stable and backed up separately from the database.
- Use HTTPS for public deployments and a strong, unique `ADMIN_PASSWORD`.
- Restrict Google API keys to the minimum services and quotas needed.
- Keep the data directory on persistent storage and back it up securely.

## Supported runtime
Use a maintained Node.js LTS release (20 or 22) and keep dependencies updated.
