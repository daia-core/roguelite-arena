# Deployment Guide - Laravel Forge

Quick guide for deploying the Roguelite Game API to Laravel Forge.

## Prerequisites

- Laravel Forge account
- Server provisioned on Forge (Ubuntu 22.04 recommended)
- Domain name pointed to server
- Git repository set up

## Step-by-Step Deployment

### 1. Server Setup on Forge

1. Log into Laravel Forge
2. Create a new server or use an existing one
3. Ensure Node.js is installed (Forge installs it by default)

### 2. Create New Site

1. In Forge, go to your server
2. Click "New Site"
3. Enter your domain (e.g., `api.yourgame.com`)
4. Select "Static HTML" as the project type
5. Click "Add Site"

### 3. Connect Git Repository

1. Go to the site in Forge
2. Navigate to "Git Repository" section
3. Connect your repository:
   - Provider: GitHub/GitLab/Bitbucket
   - Repository: `your-username/your-repo`
   - Branch: `main`
   - Directory: `/api` (if API is in subdirectory)
4. Click "Install Repository"

### 4. Configure Environment Variables

1. In Forge, go to site's "Environment" section
2. Add the following variables:

```bash
PORT=3000
NODE_ENV=production
JWT_SECRET=<generate-secure-secret>
```

To generate a secure JWT secret:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

3. Save the environment file

### 5. Update Deploy Script

1. Go to "Deployment" section in Forge
2. Replace the deploy script with:

```bash
cd /home/forge/api.yourgame.com
git pull origin main
cd api  # if your API is in a subdirectory

# Install dependencies
npm ci --production

# Restart the application
pm2 restart roguelite-api || pm2 start ecosystem.config.js
```

3. Enable "Quick Deploy" if desired

### 6. Create PM2 Ecosystem File

SSH into your server and create `/home/forge/api.yourgame.com/api/ecosystem.config.js`:

```javascript
module.exports = {
  apps: [{
    name: 'roguelite-api',
    script: './server.js',
    instances: 2,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true
  }]
};
```

Create logs directory:
```bash
mkdir -p /home/forge/api.yourgame.com/api/logs
```

### 7. Configure Nginx

1. In Forge, go to site's "Nginx Configuration"
2. Update the configuration to proxy to your Node.js app:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name api.yourgame.com;
    server_tokens off;
    root /home/forge/api.yourgame.com/public;

    # SSL configuration will be added by Forge's SSL tool

    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-XSS-Protection "1; mode=block";
    add_header X-Content-Type-Options "nosniff";

    index index.html index.htm index.php;

    charset utf-8;

    # Proxy all requests to Node.js API
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;

        # Timeouts
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
    }

    # Health check endpoint (can be public for monitoring)
    location /health {
        proxy_pass http://localhost:3000/health;
        access_log off;
    }

    location = /favicon.ico { access_log off; log_not_found off; }
    location = /robots.txt  { access_log off; log_not_found off; }

    access_log /var/log/nginx/api.yourgame.com-access.log;
    error_log  /var/log/nginx/api.yourgame.com-error.log error;

    location ~ /\.(?!well-known).* {
        deny all;
    }
}
```

3. Click "Update" to save

### 8. Enable SSL

1. In Forge, go to site's "SSL" section
2. Click "LetsEncrypt"
3. Enter email and click "Obtain Certificate"
4. Forge will automatically configure SSL

### 9. Initial Deployment

1. SSH into your server:
   ```bash
   ssh forge@your-server-ip
   cd /home/forge/api.yourgame.com/api
   ```

2. Install PM2 globally (if not installed):
   ```bash
   npm install -g pm2
   ```

3. Start the application:
   ```bash
   pm2 start ecosystem.config.js
   pm2 save
   pm2 startup
   ```

4. Verify it's running:
   ```bash
   pm2 list
   curl http://localhost:3000/health
   ```

### 10. Set Up Database Backups

1. Create backup script at `/home/forge/backup-db.sh`:

```bash
#!/bin/bash
DATE=$(date +%Y%m%d_%H%M%S)
BACKUP_DIR="/home/forge/backups/roguelite-api"
DB_PATH="/home/forge/api.yourgame.com/api/game.db"

mkdir -p $BACKUP_DIR

# Create backup
cp $DB_PATH "$BACKUP_DIR/game_${DATE}.db"

# Keep only last 30 days
find $BACKUP_DIR -name "game_*.db" -mtime +30 -delete

echo "Backup completed: game_${DATE}.db"
```

2. Make it executable:
   ```bash
   chmod +x /home/forge/backup-db.sh
   ```

3. Add to crontab (runs daily at 2 AM):
   ```bash
   crontab -e
   # Add this line:
   0 2 * * * /home/forge/backup-db.sh >> /home/forge/backups/backup.log 2>&1
   ```

### 11. Configure Firewall

1. In Forge, go to server's "Network" section
2. Ensure these rules exist:
   - Port 22 (SSH)
   - Port 80 (HTTP)
   - Port 443 (HTTPS)
3. Port 3000 should NOT be exposed (only accessed via Nginx proxy)

### 12. Test Deployment

1. Visit your API:
   ```bash
   curl https://api.yourgame.com/health
   ```

2. Test demo login:
   ```bash
   curl -X POST https://api.yourgame.com/api/login \
     -H "Content-Type: application/json" \
     -d '{"username":"demo","password":"demo123"}'
   ```

## Monitoring & Maintenance

### View Logs

```bash
# PM2 logs
pm2 logs roguelite-api

# Nginx access logs
tail -f /var/log/nginx/api.yourgame.com-access.log

# Nginx error logs
tail -f /var/log/nginx/api.yourgame.com-error.log
```

### Restart Application

```bash
pm2 restart roguelite-api
```

### View Application Status

```bash
pm2 status
pm2 monit  # Real-time monitoring
```

### Deploy Updates

1. Push changes to your Git repository
2. In Forge, click "Deploy Now" on your site
3. Or enable "Quick Deploy" for automatic deployments on push

## Production Checklist

- [ ] Secure JWT_SECRET generated and set
- [ ] SSL certificate enabled (HTTPS)
- [ ] PM2 running in cluster mode
- [ ] Database backups scheduled
- [ ] Nginx configured as reverse proxy
- [ ] Firewall rules configured
- [ ] Environment set to production
- [ ] Quick Deploy enabled (optional)
- [ ] Monitoring set up (PM2 or external)
- [ ] Error logging configured

## Troubleshooting

### Application won't start

```bash
# Check PM2 logs
pm2 logs roguelite-api --lines 50

# Restart PM2
pm2 restart roguelite-api

# Check if port is in use
netstat -tulpn | grep 3000
```

### Database issues

```bash
# Check database file permissions
ls -la /home/forge/api.yourgame.com/api/game.db

# Ensure forge user owns the database
chown forge:forge /home/forge/api.yourgame.com/api/game.db
```

### Nginx 502 Bad Gateway

```bash
# Check if Node app is running
pm2 list

# Verify it responds on port 3000
curl http://localhost:3000/health

# Check Nginx error logs
tail -f /var/log/nginx/api.yourgame.com-error.log
```

## Scaling Considerations

### Horizontal Scaling

For high traffic, use PM2 cluster mode (already configured):

```javascript
// ecosystem.config.js
instances: 'max',  // Use all CPU cores
exec_mode: 'cluster'
```

### Database

SQLite is fine for moderate traffic. For high-scale:

1. Consider PostgreSQL or MySQL
2. Update connection in `db.js`
3. Provision database via Forge

### Caching

Add Redis caching layer:

1. Install Redis via Forge
2. Cache JWT validations
3. Cache frequent queries

## Support

For issues:
1. Check PM2 logs: `pm2 logs`
2. Check Nginx logs: `/var/log/nginx/`
3. Verify environment variables in Forge
4. Test locally first: `npm start`
