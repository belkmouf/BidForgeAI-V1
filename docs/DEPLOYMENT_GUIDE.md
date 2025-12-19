# BidForge AI - Deployment Guide

Complete step-by-step deployment instructions for Google Cloud Platform and Private Server environments.

---

## Table of Contents

1. [System Requirements](#1-system-requirements)
2. [Pre-Deployment Checklist](#2-pre-deployment-checklist)
3. [Google Cloud Platform Deployment](#3-google-cloud-platform-deployment)
4. [Private Server Deployment](#4-private-server-deployment)
5. [Database Setup](#5-database-setup)
6. [Environment Variables](#6-environment-variables)
7. [AI Service Configuration](#7-ai-service-configuration)
8. [File Storage Configuration](#8-file-storage-configuration)
9. [SSL/TLS Configuration](#9-ssltls-configuration)
10. [Monitoring and Logging](#10-monitoring-and-logging)
11. [Backup and Recovery](#11-backup-and-recovery)
12. [Post-Deployment Verification](#12-post-deployment-verification)
13. [Troubleshooting](#13-troubleshooting)

---

## 1. System Requirements

### Minimum Hardware Requirements

| Component | Development | Production |
|-----------|-------------|------------|
| CPU | 2 cores | 4+ cores |
| RAM | 4 GB | 8+ GB |
| Storage | 20 GB SSD | 100+ GB SSD |
| Network | 10 Mbps | 100+ Mbps |

### Software Requirements

- **Node.js**: v20.x or higher
- **Python**: 3.11 or higher (for Sketch Agent)
- **PostgreSQL**: 15.x or higher with pgvector extension
- **Redis**: 7.x (optional, for caching)
- **Docker**: 24.x (for containerized deployment)
- **Nginx**: 1.24.x (for reverse proxy)

### Required API Keys

- OpenAI API Key (GPT-4o for bid generation)
- Anthropic API Key (Claude for orchestration)
- Google Gemini API Key (for vision analysis)
- WhatsApp Business API credentials (optional)

---

## 2. Pre-Deployment Checklist

Before deployment, ensure you have:

- [ ] Domain name configured with DNS access
- [ ] SSL certificate or ability to generate via Let's Encrypt
- [ ] All required API keys obtained
- [ ] PostgreSQL database provisioned with pgvector
- [ ] Backup strategy defined
- [ ] Monitoring/alerting configured
- [ ] Source code access (Git repository)

---

## 3. Google Cloud Platform Deployment

### 3.1 Prerequisites

```bash
# Install Google Cloud CLI
curl https://sdk.cloud.google.com | bash
exec -l $SHELL

# Initialize and authenticate
gcloud init
gcloud auth login
gcloud auth configure-docker
```

### 3.2 Create GCP Project

```bash
# Set project variables
export PROJECT_ID="bidforge-ai-prod"
export REGION="me-central1"  # Middle East for GCC compliance
export ZONE="me-central1-a"

# Create project
gcloud projects create $PROJECT_ID --name="BidForge AI Production"
gcloud config set project $PROJECT_ID

# Enable required APIs
gcloud services enable \
  cloudbuild.googleapis.com \
  run.googleapis.com \
  sqladmin.googleapis.com \
  secretmanager.googleapis.com \
  compute.googleapis.com \
  vpcaccess.googleapis.com \
  redis.googleapis.com \
  storage.googleapis.com
```

### 3.3 Set Up Cloud SQL (PostgreSQL with pgvector)

```bash
# Create Cloud SQL instance
gcloud sql instances create bidforge-db \
  --database-version=POSTGRES_15 \
  --tier=db-custom-2-8192 \
  --region=$REGION \
  --storage-size=100GB \
  --storage-type=SSD \
  --backup-start-time=02:00 \
  --backup \
  --availability-type=REGIONAL

# Create database
gcloud sql databases create bidforge --instance=bidforge-db

# Create user
gcloud sql users create bidforge_user \
  --instance=bidforge-db \
  --password="YOUR_SECURE_PASSWORD"

# Enable pgvector extension (connect via Cloud SQL Proxy first)
# Run in psql: CREATE EXTENSION IF NOT EXISTS vector;
```

### 3.4 Set Up Cloud Storage for File Uploads

```bash
# Create storage bucket
gsutil mb -l $REGION gs://$PROJECT_ID-uploads

# Set lifecycle policy (optional)
cat > lifecycle.json << EOF
{
  "lifecycle": {
    "rule": [
      {
        "action": {"type": "Delete"},
        "condition": {"age": 365}
      }
    ]
  }
}
EOF
gsutil lifecycle set lifecycle.json gs://$PROJECT_ID-uploads
```

### 3.5 Configure Secret Manager

```bash
# Create secrets
echo -n "your-jwt-secret" | gcloud secrets create JWT_SECRET --data-file=-
echo -n "your-openai-key" | gcloud secrets create OPENAI_API_KEY --data-file=-
echo -n "your-anthropic-key" | gcloud secrets create ANTHROPIC_API_KEY --data-file=-
echo -n "your-gemini-key" | gcloud secrets create GOOGLE_GENERATIVE_AI_API_KEY --data-file=-
echo -n "postgresql://..." | gcloud secrets create DATABASE_URL --data-file=-
```

### 3.6 Create Dockerfile

Create `Dockerfile` in project root:

```dockerfile
# Build stage
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
RUN npm ci

# Copy source code
COPY . .

# Build frontend and backend
RUN npm run build

# Production stage
FROM node:20-alpine AS production

WORKDIR /app

# Install Python for Sketch Agent
RUN apk add --no-cache python3 py3-pip

# Copy built files
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/sketch-agent ./sketch-agent
COPY --from=builder /app/drizzle ./drizzle

# Install Python dependencies
RUN pip3 install --break-system-packages pillow pydantic anthropic openai google-generativeai

# Create upload directories
RUN mkdir -p uploads/images uploads/analysis uploads/logos

# Set environment
ENV NODE_ENV=production
ENV PORT=8080

EXPOSE 8080

CMD ["node", "dist/index.js"]
```

### 3.7 Build and Deploy to Cloud Run

```bash
# Build container image
gcloud builds submit --tag gcr.io/$PROJECT_ID/bidforge-ai

# Deploy to Cloud Run
gcloud run deploy bidforge-ai \
  --image gcr.io/$PROJECT_ID/bidforge-ai \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --memory 2Gi \
  --cpu 2 \
  --min-instances 1 \
  --max-instances 10 \
  --set-secrets="DATABASE_URL=DATABASE_URL:latest,JWT_SECRET=JWT_SECRET:latest,OPENAI_API_KEY=OPENAI_API_KEY:latest,ANTHROPIC_API_KEY=ANTHROPIC_API_KEY:latest,GOOGLE_GENERATIVE_AI_API_KEY=GOOGLE_GENERATIVE_AI_API_KEY:latest" \
  --set-env-vars="NODE_ENV=production,GCS_BUCKET=$PROJECT_ID-uploads"

# Map custom domain
gcloud run domain-mappings create \
  --service bidforge-ai \
  --domain bidforge.yourdomain.com \
  --region $REGION
```

### 3.8 Run Database Migrations

```bash
# Connect to Cloud SQL via proxy
cloud_sql_proxy -instances=$PROJECT_ID:$REGION:bidforge-db=tcp:5432

# In another terminal, run migrations
export DATABASE_URL="postgresql://bidforge_user:PASSWORD@localhost:5432/bidforge"
npm run db:push
```

---

## 4. Private Server Deployment

### 4.1 Server Preparation (Ubuntu 22.04 LTS)

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Install Docker Compose
sudo apt install docker-compose-plugin -y

# Install Nginx
sudo apt install nginx certbot python3-certbot-nginx -y
```

### 4.2 Create Docker Compose Configuration

Create `docker-compose.yml`:

```yaml
version: '3.8'

services:
  app:
    build: .
    container_name: bidforge-app
    restart: unless-stopped
    ports:
      - "3000:5000"
    environment:
      - NODE_ENV=production
      - DATABASE_URL=postgresql://bidforge:${DB_PASSWORD}@postgres:5432/bidforge
      - JWT_SECRET=${JWT_SECRET}
      - OPENAI_API_KEY=${OPENAI_API_KEY}
      - ANTHROPIC_API_KEY=${ANTHROPIC_API_KEY}
      - GOOGLE_GENERATIVE_AI_API_KEY=${GOOGLE_GENERATIVE_AI_API_KEY}
      - VISION_PROVIDER=openai
    volumes:
      - ./uploads:/app/uploads
    depends_on:
      postgres:
        condition: service_healthy
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:5000/api/health"]
      interval: 30s
      timeout: 10s
      retries: 3

  postgres:
    image: pgvector/pgvector:pg16
    container_name: bidforge-postgres
    restart: unless-stopped
    environment:
      - POSTGRES_USER=bidforge
      - POSTGRES_PASSWORD=${DB_PASSWORD}
      - POSTGRES_DB=bidforge
    volumes:
      - postgres_data:/var/lib/postgresql/data
      - ./init-db.sql:/docker-entrypoint-initdb.d/init.sql
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U bidforge"]
      interval: 10s
      timeout: 5s
      retries: 5

  redis:
    image: redis:7-alpine
    container_name: bidforge-redis
    restart: unless-stopped
    volumes:
      - redis_data:/data
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  postgres_data:
  redis_data:
```

### 4.3 Create Database Initialization Script

Create `init-db.sql`:

```sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Grant permissions
GRANT ALL PRIVILEGES ON DATABASE bidforge TO bidforge;
```

### 4.4 Create Environment File

Create `.env.production`:

```bash
# Database
DB_PASSWORD=your_secure_database_password

# Security
JWT_SECRET=your_jwt_secret_min_32_chars
SESSION_SECRET=your_session_secret

# AI Services
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_GENERATIVE_AI_API_KEY=AI...

# Optional: DeepSeek for cost-effective processing
DEEPSEEK_API_KEY=sk-...

# Vision Provider (openai, anthropic, gemini)
VISION_PROVIDER=openai

# WhatsApp (optional)
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_ACCESS_TOKEN=

# Application
NODE_ENV=production
PORT=5000
```

### 4.5 Deploy Application

```bash
# Clone repository
git clone https://github.com/your-org/bidforge-ai.git
cd bidforge-ai

# Copy environment file
cp .env.production .env

# Build and start services
docker compose up -d --build

# Run database migrations
docker compose exec app npm run db:push

# Check logs
docker compose logs -f app
```

### 4.6 Configure Nginx Reverse Proxy

Create `/etc/nginx/sites-available/bidforge`:

```nginx
server {
    listen 80;
    server_name bidforge.yourdomain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        
        # Increase timeouts for long-running AI operations
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
        
        # Increase body size for file uploads
        client_max_body_size 100M;
    }
}
```

Enable the site:

```bash
sudo ln -s /etc/nginx/sites-available/bidforge /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx
```

---

## 5. Database Setup

### 5.1 PostgreSQL with pgvector

The application requires PostgreSQL with the pgvector extension for vector similarity search (RAG).

```sql
-- Connect as superuser
psql -U postgres

-- Create database and user
CREATE DATABASE bidforge;
CREATE USER bidforge_user WITH ENCRYPTED PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE bidforge TO bidforge_user;

-- Connect to bidforge database
\c bidforge

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Grant schema permissions
GRANT ALL ON SCHEMA public TO bidforge_user;
```

### 5.2 Run Migrations

```bash
# Using Drizzle ORM
npm run db:push

# Or generate and run migration files
npm run db:generate
npm run db:migrate
```

---

## 6. Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `JWT_SECRET` | Secret for JWT tokens (min 32 chars) | `your-secure-jwt-secret-key` |
| `OPENAI_API_KEY` | OpenAI API key for GPT-4o | `sk-...` |
| `ANTHROPIC_API_KEY` | Anthropic API key for Claude | `sk-ant-...` |
| `GOOGLE_GENERATIVE_AI_API_KEY` | Google AI key for Gemini | `AI...` |

### Optional Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `development` |
| `PORT` | Server port | `5000` |
| `VISION_PROVIDER` | AI provider for image analysis | `openai` |
| `VISION_MODEL` | Specific model for vision | `gpt-4o` |
| `REDIS_URL` | Redis connection string | - |
| `DEEPSEEK_API_KEY` | DeepSeek API key | - |
| `WHATSAPP_PHONE_NUMBER_ID` | WhatsApp Business ID | - |
| `WHATSAPP_ACCESS_TOKEN` | WhatsApp access token | - |

---

## 7. AI Service Configuration

### 7.1 OpenAI Setup

1. Go to [platform.openai.com](https://platform.openai.com)
2. Create an API key with access to GPT-4o
3. Set billing limits to prevent unexpected charges
4. Add key to environment: `OPENAI_API_KEY=sk-...`

### 7.2 Anthropic Setup

1. Go to [console.anthropic.com](https://console.anthropic.com)
2. Create an API key
3. Add key to environment: `ANTHROPIC_API_KEY=sk-ant-...`

### 7.3 Google Gemini Setup

1. Go to [makersuite.google.com](https://makersuite.google.com)
2. Create an API key
3. Add key to environment: `GOOGLE_GENERATIVE_AI_API_KEY=AI...`

### 7.4 Model Selection

The system uses different models for different tasks:

| Task | Default Provider | Model |
|------|-----------------|-------|
| Bid Generation | OpenAI | GPT-4o |
| Agent Orchestration | Anthropic | Claude Sonnet 4.5 |
| Vision/Sketch Analysis | OpenAI | GPT-4o |
| Embeddings | OpenAI | text-embedding-3-small |

---

## 8. File Storage Configuration

### 8.1 Directory Structure

```
uploads/
├── images/          # Uploaded construction drawings
├── analysis/        # AI-generated analysis files
├── logos/           # Company branding logos
└── knowledge-base/  # Historical bid documents
```

### 8.2 Permissions

```bash
# Create directories
mkdir -p uploads/{images,analysis,logos,knowledge-base}

# Set permissions (for Linux/Docker)
chmod -R 755 uploads
chown -R node:node uploads  # or www-data for Nginx
```

### 8.3 Cloud Storage (GCP)

For Google Cloud deployment, configure Cloud Storage:

```javascript
// Set environment variable
GCS_BUCKET=bidforge-uploads

// Or mount bucket using gcsfuse in container
```

---

## 9. SSL/TLS Configuration

### 9.1 Let's Encrypt (Private Server)

```bash
# Obtain certificate
sudo certbot --nginx -d bidforge.yourdomain.com

# Auto-renewal is configured automatically
# Verify with:
sudo certbot renew --dry-run
```

### 9.2 Google Cloud Run

Cloud Run provides automatic SSL for custom domains:

```bash
# Verify domain ownership
gcloud domains verify bidforge.yourdomain.com

# Map domain (SSL is automatic)
gcloud run domain-mappings create \
  --service bidforge-ai \
  --domain bidforge.yourdomain.com
```

---

## 10. Monitoring and Logging

### 10.1 Health Check Endpoints

| Endpoint | Description |
|----------|-------------|
| `GET /api/health` | Basic health check |
| `GET /api/health/db` | Database connectivity |
| `GET /api/health/ai` | AI service status |

### 10.2 Google Cloud Monitoring

```bash
# Create uptime check
gcloud monitoring uptime-check-configs create bidforge-health \
  --display-name="BidForge Health Check" \
  --monitored-resource-type="uptime_url" \
  --resource-labels="host=bidforge.yourdomain.com,project_id=$PROJECT_ID"

# Create alerting policy
gcloud alpha monitoring policies create \
  --display-name="BidForge Down Alert" \
  --condition-filter="..." \
  --notification-channels="projects/$PROJECT_ID/notificationChannels/..."
```

### 10.3 Private Server Monitoring

Install Prometheus and Grafana:

```yaml
# Add to docker-compose.yml
  prometheus:
    image: prom/prometheus
    volumes:
      - ./prometheus.yml:/etc/prometheus/prometheus.yml
    ports:
      - "9090:9090"

  grafana:
    image: grafana/grafana
    ports:
      - "3001:3000"
    volumes:
      - grafana_data:/var/lib/grafana
```

---

## 11. Backup and Recovery

### 11.1 Database Backup (Private Server)

Create `backup.sh`:

```bash
#!/bin/bash
BACKUP_DIR="/backups/postgres"
DATE=$(date +%Y%m%d_%H%M%S)
FILENAME="bidforge_backup_$DATE.sql.gz"

# Create backup
docker compose exec -T postgres pg_dump -U bidforge bidforge | gzip > "$BACKUP_DIR/$FILENAME"

# Keep only last 30 days
find $BACKUP_DIR -name "*.sql.gz" -mtime +30 -delete

# Optional: Upload to cloud storage
# aws s3 cp "$BACKUP_DIR/$FILENAME" s3://your-backup-bucket/
```

Schedule with cron:

```bash
# Run daily at 2 AM
0 2 * * * /path/to/backup.sh
```

### 11.2 Cloud SQL Automated Backups

Cloud SQL has automatic backups enabled. To restore:

```bash
# List backups
gcloud sql backups list --instance=bidforge-db

# Restore from backup
gcloud sql backups restore BACKUP_ID \
  --restore-instance=bidforge-db
```

### 11.3 File Backup

```bash
# Backup uploads directory
tar -czf uploads_backup_$(date +%Y%m%d).tar.gz uploads/

# For GCS, use gsutil
gsutil -m rsync -r uploads/ gs://bidforge-backups/uploads/
```

---

## 12. Post-Deployment Verification

### 12.1 Checklist

- [ ] Application loads at https://bidforge.yourdomain.com
- [ ] User registration works
- [ ] File upload works (try PDF and image)
- [ ] AI bid generation completes
- [ ] Document download works
- [ ] Database connections are stable
- [ ] SSL certificate is valid
- [ ] Monitoring alerts are configured
- [ ] Backups are running

### 12.2 Smoke Tests

```bash
# Check health
curl -s https://bidforge.yourdomain.com/api/health | jq

# Check SSL
openssl s_client -connect bidforge.yourdomain.com:443 -servername bidforge.yourdomain.com

# Check response times
curl -w "@curl-format.txt" -o /dev/null -s https://bidforge.yourdomain.com/
```

---

## 13. Troubleshooting

### Common Issues

**Issue: Database connection failed**
```bash
# Check PostgreSQL is running
docker compose logs postgres

# Verify connection string
psql $DATABASE_URL -c "SELECT 1"

# Check pgvector extension
psql $DATABASE_URL -c "SELECT * FROM pg_extension WHERE extname = 'vector'"
```

**Issue: AI API errors**
```bash
# Test OpenAI
curl -H "Authorization: Bearer $OPENAI_API_KEY" \
  https://api.openai.com/v1/models

# Check rate limits in logs
docker compose logs app | grep -i "rate limit"
```

**Issue: File uploads failing**
```bash
# Check permissions
ls -la uploads/

# Check disk space
df -h

# Check Nginx body size limit
grep client_max_body_size /etc/nginx/nginx.conf
```

**Issue: Memory issues**
```bash
# Check container memory
docker stats bidforge-app

# Increase memory limit in docker-compose.yml
deploy:
  resources:
    limits:
      memory: 4G
```

---

## Support

For additional support:
- Documentation: `docs/` folder
- Issues: GitHub Issues
- Email: support@bidforge.ai

---

*Document Version: 1.0*
*Last Updated: December 2024*
