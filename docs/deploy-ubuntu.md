# Hướng dẫn Deploy FOXAI lên Ubuntu Server

## Yêu cầu hệ thống

| Thành phần | Phiên bản tối thiểu |
|---|---|
| Ubuntu | 22.04 LTS |
| Docker Engine | 24.0+ |
| Docker Compose | v2 (plugin) |
| RAM | 4 GB |
| Disk | 20 GB |
| Redis | Đã chạy sẵn (Docker container, port 6379) |

---

## Bước 1 — Cài đặt Docker trên server

```bash
# Cài Docker Engine
curl -fsSL https://get.docker.com | sh

# Thêm user hiện tại vào group docker (không cần sudo mỗi lần)
sudo usermod -aG docker $USER

# Đăng xuất và đăng nhập lại để áp dụng, sau đó kiểm tra
docker version
docker compose version
```

---

## Bước 2 — Clone repository

```bash
# Tạo thư mục và clone code
sudo mkdir -p /opt/foxai
sudo chown $USER:$USER /opt/foxai

git clone <your-git-repo-url> /opt/foxai
cd /opt/foxai
```

> Nếu dùng SSH key, đảm bảo đã thêm public key của server vào GitHub/GitLab trước.

---

## Bước 3 — Tạo file cấu hình môi trường

```bash
cd /opt/foxai
cp .env.production.example .env
nano .env
```

Điền đầy đủ các giá trị sau (thay toàn bộ `CHANGE_ME_*`):

```bash
# ── Database credentials ──────────────────────────────────────
SYSTEM_DB_USER=foxai_system
SYSTEM_DB_PASSWORD=<mật-khẩu-mạnh-1>
SYSTEM_DB_NAME=system_db

OCR_DB_USER=foxai_ocr
OCR_DB_PASSWORD=<mật-khẩu-mạnh-2>
OCR_DB_NAME=ocr_db

CHATBOT_DB_USER=foxai_chatbot
CHATBOT_DB_PASSWORD=<mật-khẩu-mạnh-3>
CHATBOT_DB_NAME=chatbot_db

KNOWLEDGE_DB_USER=foxai_kb
KNOWLEDGE_DB_PASSWORD=<mật-khẩu-mạnh-4>
KNOWLEDGE_DB_NAME=knowledge_db

# ── Redis (container đang chạy sẵn trên host) ─────────────────
REDIS_HOST=host.docker.internal
REDIS_PORT=6379
REDIS_PASSWORD=                        # để trống nếu không có password

# ── JWT ────────────────────────────────────────────────────────
# Tạo secret: openssl rand -hex 32
JWT_SECRET=<chuỗi-ngẫu-nhiên-64-ký-tự>
JWT_EXPIRES_IN=7d

# ── API Keys ───────────────────────────────────────────────────
GEMINI_API_KEY=<gemini-api-key>
OPENAI_API_KEY=<openai-api-key>
OCR_PROVIDER=gemini

# ── Frontend (URL công khai trỏ đến server này) ───────────────
NEXT_PUBLIC_API_URL=http://<IP-hoặc-domain>/api
```

Lưu file: `Ctrl+O` → `Enter` → `Ctrl+X`

---

## Bước 4 — Build Docker images

> Chỉ cần thực hiện bước này lần đầu hoặc khi có thay đổi code.

```bash
cd /opt/foxai
bash scripts/deploy.sh --build
```

Quá trình build bao gồm:
- Build `.NET 9` cho system-service và knowledge-service
- Build `NestJS` cho api-gateway, ocr-service, chatbot-service
- Build `Next.js` cho web-portal (embed `NEXT_PUBLIC_API_URL` vào lúc build)

**Thời gian ước tính:** 10–20 phút lần đầu (tùy tốc độ mạng và CPU server).

---

## Bước 5 — Khởi động tất cả services

```bash
bash scripts/deploy.sh
```

Script sẽ tự động:
1. Pull code mới nhất từ nhánh `main`
2. Dừng containers cũ (nếu đang chạy)
3. Khởi động lại với images đã build sẵn
4. Kiểm tra health các endpoint

---

## Bước 6 — Kiểm tra kết quả

```bash
# Xem trạng thái tất cả containers
bash scripts/deploy.sh --status

# Hoặc dùng docker compose trực tiếp
cd /opt/foxai
docker compose -f docker-compose.prod.yml ps
```

Tất cả services phải ở trạng thái **Up** hoặc **healthy**:

```
NAME                    STATUS
foxai-nginx             Up
foxai-api-gateway       Up (healthy)
foxai-web-portal        Up
foxai-system-service    Up (healthy)
foxai-knowledge-service Up (healthy)
foxai-ocr-api           Up (healthy)
foxai-chatbot-service   Up
foxai-system-db         Up (healthy)
foxai-ocr-db            Up (healthy)
foxai-chatbot-db        Up (healthy)
foxai-knowledge-db      Up (healthy)
```

Kiểm tra ứng dụng trên trình duyệt:

| Endpoint | Mô tả |
|---|---|
| `http://<server-ip>/` | Web Portal (giao diện người dùng) |
| `http://<server-ip>/api/health` | API Gateway health check |
| `http://<server-ip>/nginx-health` | Nginx health check |

---

## Các lệnh thường dùng

```bash
# Xem logs toàn bộ (Ctrl+C để thoát)
bash scripts/deploy.sh --logs

# Xem logs của một service cụ thể
docker compose -f docker-compose.prod.yml logs -f api-gateway
docker compose -f docker-compose.prod.yml logs -f system-service

# Kiểm tra health
bash scripts/deploy.sh --health

# Xem trạng thái containers
bash scripts/deploy.sh --status

# Dừng toàn bộ
bash scripts/deploy.sh --down

# Build lại images (sau khi cập nhật code)
bash scripts/deploy.sh --build

# Deploy không build lại (restart nhanh)
bash scripts/deploy.sh
```

---

## Quy trình cập nhật code

Mỗi khi có code mới cần deploy:

```bash
cd /opt/foxai

# Nếu chỉ thay đổi config/logic (không đổi dependencies hay Next.js pages)
bash scripts/deploy.sh --build   # build lại
bash scripts/deploy.sh            # restart

# Nếu chỉ restart mà không build lại
bash scripts/deploy.sh
```

> **Lưu ý `NEXT_PUBLIC_API_URL`:** Biến này được Next.js nhúng vào bundle lúc build. Nếu thay đổi giá trị này trong `.env`, phải chạy `--build` lại.

---

## Cấu hình SSL (HTTPS)

### Cài Let's Encrypt (certbot)

```bash
sudo apt install -y certbot
sudo certbot certonly --standalone -d your-domain.com

# Cert được lưu tại:
# /etc/letsencrypt/live/your-domain.com/fullchain.pem
# /etc/letsencrypt/live/your-domain.com/privkey.pem
```

### Copy cert vào thư mục nginx

```bash
sudo cp /etc/letsencrypt/live/your-domain.com/fullchain.pem /opt/foxai/nginx/ssl/
sudo cp /etc/letsencrypt/live/your-domain.com/privkey.pem /opt/foxai/nginx/ssl/
sudo chown $USER:$USER /opt/foxai/nginx/ssl/*
```

### Bật SSL trong nginx.conf

Mở file `/opt/foxai/nginx/nginx.conf` và bỏ comment các dòng SSL:

```nginx
# Bỏ comment dòng này trong server block:
listen 443 ssl;
ssl_certificate     /etc/nginx/ssl/fullchain.pem;
ssl_certificate_key /etc/nginx/ssl/privkey.pem;
ssl_protocols       TLSv1.2 TLSv1.3;

# Bật redirect HTTP → HTTPS (bỏ comment server block phía trên):
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$host$request_uri;
}
```

Cập nhật `.env`:
```bash
NEXT_PUBLIC_API_URL=https://your-domain.com/api
```

Rebuild và restart:
```bash
bash scripts/deploy.sh --build
bash scripts/deploy.sh
```

### Tự động gia hạn cert

```bash
# Kiểm tra certbot renew hoạt động
sudo certbot renew --dry-run

# Thêm cron job gia hạn tự động (chạy 2 lần/ngày)
echo "0 0,12 * * * root certbot renew --quiet && cp /etc/letsencrypt/live/your-domain.com/*.pem /opt/foxai/nginx/ssl/ && docker compose -f /opt/foxai/docker-compose.prod.yml restart nginx" | sudo tee /etc/cron.d/certbot-foxai
```

---

## Xử lý sự cố

### Containers không khởi động được

```bash
# Xem logs chi tiết của service bị lỗi
docker compose -f docker-compose.prod.yml logs system-service
docker compose -f docker-compose.prod.yml logs api-gateway

# Kiểm tra .env có đủ biến không
docker compose -f docker-compose.prod.yml config
```

### Không kết nối được Redis

```bash
# Kiểm tra Redis container đang chạy
docker ps | grep redis

# Test kết nối từ trong một container FOXAI
docker exec foxai-api-gateway sh -c "wget -qO- http://host.docker.internal:6379 || echo 'cannot reach'"

# Đảm bảo Redis bind 0.0.0.0 (không chỉ 127.0.0.1)
docker inspect <redis-container-name> | grep -A5 '"Ports"'
```

### Database migration thất bại

```bash
# Xem log của service cụ thể
docker compose -f docker-compose.prod.yml logs system-service --tail=100

# Chạy lại migration thủ công (system-service)
docker compose -f docker-compose.prod.yml restart system-service
```

### Hết dung lượng disk

```bash
# Xem dung lượng Docker đang chiếm
docker system df

# Dọn dẹp images và containers không dùng
docker system prune -f

# Dọn dẹp mạnh hơn (bao gồm volumes không dùng - cẩn thận!)
docker system prune -f --volumes
```

---

## Sơ đồ kiến trúc

```
Internet
    │
    ▼
┌─────────────────────────────────────┐
│  Nginx (port 80/443)                │
│  /api/* → API Gateway :3001         │
│  /*     → Web Portal  :3000         │
└──────────┬──────────────────────────┘
           │ Docker network: foxai-internal
    ┌──────┴───────┐
    │              │
    ▼              ▼
┌───────────┐  ┌────────────┐
│ API       │  │ Web Portal │
│ Gateway   │  │ (Next.js)  │
│ :3001     │  │ :3000      │
└─────┬─────┘  └────────────┘
      │
      ├── gRPC → system-service  :50051  ─── system-db   (PostgreSQL)
      ├── gRPC → knowledge-service:50052 ─── knowledge-db (PostgreSQL)
      ├── HTTP → ocr-api         :3003   ─── ocr-db      (pgvector)
      └── gRPC → chatbot-service :3004   ─── chatbot-db  (pgvector)
                      │
                      └── BullMQ → Redis (host container, :6379)
```
