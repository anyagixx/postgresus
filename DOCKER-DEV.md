# 🐘 Postgresus - Docker Desktop Development Guide

This guide explains how to build, test, and run Postgresus locally using Docker Desktop on Ubuntu.

## Quick Start

```bash
# Make the script executable (if not already)
chmod +x docker-dev.sh

# Build the Docker image
./docker-dev.sh build

# Run the container
./docker-dev.sh run

# Open in browser (accept self-signed certificate warning)
xdg-open https://localhost
```

## 🔐 HTTPS Support

Postgresus now runs with HTTPS by default using a **self-signed certificate**:

- **HTTPS**: `https://localhost` (port 443)
- **HTTP**: `http://localhost:4005` → automatically redirects to HTTPS

### First Time Access

When you first visit `https://localhost`, your browser will show a security warning because the certificate is self-signed. This is expected and safe for local development:

1. **Chrome/Edge**: Click "Advanced" → "Proceed to localhost (unsafe)"
2. **Firefox**: Click "Advanced" → "Accept the Risk and Continue"
3. **Safari**: Click "Show Details" → "Visit this website"

### Using Your Own Certificate

To use a custom certificate (e.g., from Let's Encrypt):

1. Place your certificate files in `./postgresus-data/certs/`:
   - `server.crt` - Certificate file
   - `server.key` - Private key file
2. Restart the container

### Disabling HTTPS

To run HTTP-only (not recommended for production):

```bash
docker run -d \
  --name postgresus \
  -p 4005:4005 \
  -e ENABLE_HTTPS=false \
  -v postgresus-data:/postgresus-data \
  postgresus:dev
```

## Available Commands

| Command | Description |
|---------|-------------|
| `./docker-dev.sh build` | Build the Docker image from source |
| `./docker-dev.sh run` | Run a single container with HTTPS |
| `./docker-dev.sh start` | Start with Docker Compose |
| `./docker-dev.sh start -t` | Start with test databases |
| `./docker-dev.sh stop` | Stop all containers |
| `./docker-dev.sh logs` | View container logs |
| `./docker-dev.sh shell` | Open bash shell in container |
| `./docker-dev.sh status` | Show container status |
| `./docker-dev.sh clean` | Remove everything |

## Running with Test Databases

To test backups, you can start Postgresus with test databases:

```bash
./docker-dev.sh start -t
```

This will start:
- **PostgreSQL 17**: `localhost:5432` (user: `testuser`, password: `testpassword`, db: `testdb`)
- **MySQL 8.0**: `localhost:3306` (user: `testuser`, password: `testpassword`, db: `testdb`)  
- **MongoDB 7.0**: `localhost:27017` (user: `root`, password: `rootpassword`)

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ENABLE_HTTPS` | `true` | Enable HTTPS with auto-generated certificate |
| `HTTPS_PORT` | `443` | HTTPS listening port |
| `HTTP_PORT` | `4005` | HTTP port (redirects to HTTPS when HTTPS enabled) |

## Manual Docker Commands

If you prefer to use Docker commands directly:

### Build the image
```bash
docker build -t postgresus:dev .
```

### Run with HTTPS (production mode)
```bash
docker run -d \
  --name postgresus \
  -p 443:443 \
  -p 4005:4005 \
  -v postgresus-data:/postgresus-data \
  --restart unless-stopped \
  postgresus:dev
```

### View logs
```bash
docker logs -f postgresus
```

### Stop and remove
```bash
docker stop postgresus && docker rm postgresus
```

## Docker Compose

```yaml
services:
  postgresus:
    image: postgresus:dev
    ports:
      - "443:443"
      - "4005:4005"
    volumes:
      - ./postgresus-data:/postgresus-data
    restart: unless-stopped
```

## Building for Multiple Architectures

To build for both AMD64 and ARM64 (for Docker Hub publishing):

```bash
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -t putopelatudo/postgresus:latest \
  --push \
  .
```

## Docker Desktop Tips

1. **Resources**: For faster builds, allocate more resources to Docker Desktop:
   - Settings → Resources → CPUs: 4+
   - Settings → Resources → Memory: 8GB+

2. **Build Cache**: Docker caches layers. To force a fresh build:
   ```bash
   docker build --no-cache -t postgresus:dev .
   ```

3. **Disk Space**: Postgresus image is ~1.5GB. Clean old images with:
   ```bash
   docker image prune -a
   ```

## Troubleshooting

### Container exits immediately
Check logs: `./docker-dev.sh logs`

### Port 443 already in use
```bash
sudo lsof -i :443
# Kill the process or change the HTTPS_PORT
```

### Port 4005 already in use
```bash
sudo lsof -i :4005
# Kill the process or change the HTTP_PORT
```

### Certificate issues
Delete the certificates to regenerate:
```bash
rm -rf ./postgresus-data/certs/
./docker-dev.sh run
```

### Build fails on ARM Mac
The Dockerfile supports multi-arch builds. If issues persist:
```bash
docker buildx create --use
docker buildx build --platform linux/amd64 -t postgresus:dev --load .
```

## Project Structure

```
postgresus/
├── Dockerfile              # Multi-stage Docker build
├── docker-dev.sh          # Development helper script
├── docker-compose.yml.example  # Example compose file with HTTPS
├── backend/               # Go backend
│   ├── cmd/              # Main application entry
│   ├── internal/         # Business logic
│   │   └── util/tls/     # TLS certificate management
│   └── migrations/       # Database migrations
├── frontend/             # React + Vite frontend
│   ├── src/             # Source code
│   └── public/          # Static assets
└── assets/              # Database client binaries
```

## Security Notes

1. **Self-signed certificates** are suitable for:
   - Local development
   - Internal/private networks
   - Testing environments

2. **For production**, consider:
   - Using Let's Encrypt with a reverse proxy (Nginx, Caddy, Traefik)
   - Mounting your own trusted certificates

3. **Certificate location**: Certificates are stored in `/postgresus-data/certs/` and persist across container restarts.

## First Run

After starting Postgresus for the first time:

1. Navigate to https://localhost (accept certificate warning)
2. Create your admin account
3. Add a database for backup
4. Configure storage (local, S3, Google Drive, etc.)
5. Set up notifications (optional)
6. Create your first backup schedule

Enjoy using Postgresus with HTTPS! 🚀🔒
