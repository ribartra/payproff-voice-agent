# Backend

Servicio HTTP minimo para usuarios PayProof, contactos y aliases consultados desde Postgres.

## Desarrollo

Levantar Postgres/Redis y aplicar seed:

```bash
bun run db:up
bun run db:migrate
```

```bash
bun run dev
```

Por defecto escucha en `http://127.0.0.1:3002`.

## Variables

- `DATABASE_URL`
- `REDIS_URL`
- `SESSION_COOKIE_NAME`
- `SESSION_TTL_SECONDS`
- `BACKEND_HOST`
- `BACKEND_PORT`
- `LOG_LEVEL`

## Endpoints

- `GET /health`
- `POST /auth/login`
- `GET /auth/session`
- `POST /auth/logout`
- `POST /accounts`
- `GET /users/by-wallet/:walletAddress`
- `POST /users/:userId/contacts`
- `GET /users/:userId/contacts`
- `GET /users/:userId/assemblyai-keyterms`

Las migraciones SQL versionadas viven en `sql/`. Este paquete no ejecuta migraciones automaticamente.

## Usuario demo

El seed SQL crea un usuario de prueba para validar login, contactos y keyterms:

- Email: `demo@payproof.local`
- Password: `PayProofDemo2026!`

La sesion se guarda en Redis y se entrega al frontend mediante cookie HTTP-only `pp_session`.
