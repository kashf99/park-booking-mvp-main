# park-booking-mvp

## Run with Docker (quick start)

1) **Prereqs:** Docker + Docker Compose installed.
2) **Env:** Copy `.env` (already present) and set the values you need (Mongo/Redis/Cloudinary/JWT).
3) **Start stack:**
   ```bash
   docker-compose up --build -d
   ```
   Services: backend (port 4000), Mongo (27017), Redis (6380:6379).
4) **Check health:**  
   `curl http://localhost:4000/health`
5) **View logs:**  
   `docker-compose logs -f backend`
6) **Stop stack:**  
   `docker-compose down`

## Useful commands
- Rebuild + restart just backend: `docker-compose restart backend`
- Follow backend logs: `docker-compose logs -f backend`
- Run tests (outside container): `npm test` (requires dev deps)
