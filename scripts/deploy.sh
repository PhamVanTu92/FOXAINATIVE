#!/usr/bin/env bash
# ==============================================================
# FOXAI Deploy Script – Ubuntu Server
#
# Luồng upload trực tiếp (không dùng git trên server):
#   1. Máy local: bash scripts/upload.sh user@server-ip
#   2. Server:    bash scripts/deploy.sh --build
#   3. Server:    bash scripts/deploy.sh
#
# Luồng git (server tự pull):
#   1. Lần đầu:   bash scripts/deploy.sh --setup
#   2. Cập nhật:  bash scripts/deploy.sh --build   (khi đổi code)
#                 bash scripts/deploy.sh            (restart nhanh)
# ==============================================================
set -euo pipefail

APP_DIR="${APP_DIR:-$HOME/FOXNATIVE}"
COMPOSE_FILE="docker-compose.prod.yml"
GIT_BRANCH="${GIT_BRANCH:-main}"

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
log()   { echo -e "${GREEN}[FOXAI]${NC} $1"; }
info()  { echo -e "${BLUE}[INFO]${NC}  $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# ── Kiểm tra công cụ bắt buộc ─────────────────────────────────────────────────
check_deps() {
    for cmd in docker curl; do
        command -v "$cmd" >/dev/null 2>&1 || error "Thiếu: $cmd. Hãy cài đặt trước."
    done
    docker compose version >/dev/null 2>&1 || error "Cần Docker Compose v2 (plugin). Hãy cài đặt: https://docs.docker.com/compose/install/"
    log "Kiểm tra công cụ: OK"
}

# ── Cài đặt môi trường lần đầu ────────────────────────────────────────────────
setup() {
    log "=== FOXAI First-Time Setup ==="

    if ! command -v docker >/dev/null 2>&1; then
        info "Cài đặt Docker..."
        curl -fsSL https://get.docker.com | sh
        sudo usermod -aG docker "$USER"
        warn "Đã thêm user vào group docker. Vui lòng đăng xuất và đăng nhập lại, rồi chạy script này một lần nữa."
        exit 0
    fi

    sudo mkdir -p "$APP_DIR"
    sudo chown "$USER":"$USER" "$APP_DIR"

    # Clone repo nếu dùng luồng git (tùy chọn)
    if [ ! -d "$APP_DIR/.git" ] && command -v git >/dev/null 2>&1; then
        read -rp "Nhập Git repo URL (Enter để bỏ qua nếu dùng upload trực tiếp): " REPO_URL
        [ -n "$REPO_URL" ] && git clone "$REPO_URL" "$APP_DIR"
    fi

    if [ ! -f "$APP_DIR/.env" ]; then
        [ -f "$APP_DIR/.env.production.example" ] && cp "$APP_DIR/.env.production.example" "$APP_DIR/.env"
        warn "Hãy chỉnh sửa file .env trước khi tiếp tục: nano $APP_DIR/.env"
        exit 0
    fi

    log "Setup hoàn tất."
}

# ── Pull code qua git (tùy chọn) ─────────────────────────────────────────────
pull_code() {
    if [ -d "$APP_DIR/.git" ] && command -v git >/dev/null 2>&1; then
        log "Pull code từ branch $GIT_BRANCH..."
        git fetch origin
        git checkout "$GIT_BRANCH"
        git pull origin "$GIT_BRANCH"
    else
        info "Bỏ qua git pull (dùng files đã upload sẵn)."
    fi
}

# ── Build Docker images ───────────────────────────────────────────────────────
build_images() {
    log "Build Docker images..."
    # shellcheck disable=SC1091
    set -a; source .env; set +a
    docker compose -f "$COMPOSE_FILE" build
}

# ── Deploy ────────────────────────────────────────────────────────────────────
deploy() {
    log "Dừng containers cũ..."
    docker compose -f "$COMPOSE_FILE" down --remove-orphans --timeout 30

    log "Khởi động services (dùng images hiện có)..."
    docker compose -f "$COMPOSE_FILE" up -d --no-build

    log "Chờ services khởi động..."
    local max_wait=120
    local elapsed=0
    while [ $elapsed -lt $max_wait ]; do
        if docker compose -f "$COMPOSE_FILE" ps --filter "status=running" | grep -q "api-gateway"; then
            break
        fi
        sleep 5
        elapsed=$((elapsed + 5))
    done

    log "Trạng thái services:"
    docker compose -f "$COMPOSE_FILE" ps
}

# ── Kiểm tra health ───────────────────────────────────────────────────────────
healthcheck() {
    log "Kiểm tra health..."
    local host="${HEALTHCHECK_HOST:-localhost}"
    local services=("http://$host/nginx-health:Nginx" "http://$host/api/health:API-Gateway")
    for entry in "${services[@]}"; do
        local url="${entry%%:*}"
        local name="${entry##*:}"
        if curl -sf "$url" >/dev/null 2>&1; then
            echo -e "  ${GREEN}✓${NC} $name"
        else
            echo -e "  ${RED}✗${NC} $name ($url)"
        fi
    done
}

# ─────────────────────────────────────────────────────────────────────────────
main() {
    local cmd="${1:-deploy}"

    case "$cmd" in
        --setup|setup)
            check_deps
            setup
            ;;
        --build|build)
            check_deps
            [ -f "$APP_DIR/.env" ] || error "Thiếu $APP_DIR/.env"
            cd "$APP_DIR"
            build_images
            log "Build hoàn tất. Chạy 'bash scripts/deploy.sh' để khởi động."
            ;;
        deploy|"")
            check_deps
            [ -f "$APP_DIR/.env" ] || error "Thiếu $APP_DIR/.env. Chạy: bash scripts/deploy.sh --setup"
            cd "$APP_DIR"
            pull_code
            deploy
            healthcheck
            log "Deploy hoàn tất!"
            ;;
        --logs|logs)
            cd "$APP_DIR"
            docker compose -f "$COMPOSE_FILE" logs --tail=50 -f
            ;;
        --health|health)
            cd "$APP_DIR"
            healthcheck
            ;;
        --status|status)
            cd "$APP_DIR"
            docker compose -f "$COMPOSE_FILE" ps
            ;;
        --down|down)
            cd "$APP_DIR"
            docker compose -f "$COMPOSE_FILE" down
            ;;
        *)
            echo "Usage: $0 [deploy|--build|--setup|--logs|--health|--status|--down]"
            exit 1
            ;;
    esac
}

main "$@"
