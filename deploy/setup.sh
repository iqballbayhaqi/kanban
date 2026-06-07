#!/bin/bash
set -e

echo "=== Kanban VPS Setup ==="

# 1. System update
apt-get update -y && apt-get upgrade -y

# 2. Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs build-essential python3

# 3. PM2
npm install -g pm2

# 4. Nginx
apt-get install -y nginx

# 5. App directory
mkdir -p /var/www/kanban
cd /var/www/kanban

# 6. Clone repo (ganti dengan URL repo kamu)
git clone https://github.com/iqballbayhaqi/kanban.git . 2>/dev/null || git pull origin main

# 7. Backend setup
cd backend
npm install --omit=dev
cp .env.example .env
echo ""
echo ">>> EDIT /var/www/kanban/backend/.env sekarang, lalu tekan Enter untuk lanjut"
read -r

# 8. Frontend build
cd ../frontend
npm install
npm run build
cd ..

# 9. PM2 start
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup systemd -u ubuntu --hp /home/ubuntu | tail -1 | bash

# 10. Nginx config
cp deploy/nginx.conf /etc/nginx/sites-available/kanban
ln -sf /etc/nginx/sites-available/kanban /etc/nginx/sites-enabled/kanban
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

# 11. Certbot SSL
apt-get install -y certbot python3-certbot-nginx
certbot --nginx -d kanban.balee.web.id --non-interactive --agree-tos -m baihaqiiqbal323@gmail.com

echo ""
echo "=== Setup selesai! https://kanban.balee.web.id ==="
