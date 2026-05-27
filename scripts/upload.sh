#!/usr/bin/env bash
# ==============================================================
# Upload code từ máy local lên Ubuntu server qua rsync/scp
# Dùng khi không muốn pull qua git trên server
#
# Cách dùng:
#   bash scripts/upload.sh user@server-ip
#   bash scripts/upload.sh user@server-ip --port 2222
# ==============================================================
set -euo pipefail

RED='\033[0;31m'; GREEN='\033[0;32m'; YELLOW='\033[1;33m'; BLUE='\033[0;34m'; NC='\033[0m'
log()   { echo -e "${GREEN}[UPLOAD]${NC} $1"; }
warn()  { echo -e "${YELLOW}[WARN]${NC}  $1"; }
error() { echo -e "${RED}[ERROR]${NC} $1"; exit 1; }

# ── Tham số ──────────────────────────────────────────────────────────────────
TARGET="${1:-}"
SSH_PORT="${SSH_PORT:-22}"
REMOTE_DIR="${REMOTE_DIR:-/opt/foxai}"

# Đọc --port nếu có
shift || true
while [[ $# -gt 0 ]]; do
    case "$1" in
        --port|-p) SSH_PORT="$2"; shift 2 ;;
        *) shift ;;
    esac
done

[ -n "$TARGET" ] || error "Thiếu địa chỉ server. Cách dùng: bash scripts/upload.sh user@server-ip"

# ── Xác định thư mục gốc của repo ────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

log "Nguồn : $REPO_ROOT"
log "Đích   : $TARGET:$REMOTE_DIR"
log "SSH port: $SSH_PORT"
echo ""

# ── Kiểm tra rsync ────────────────────────────────────────────────────────────
command -v rsync >/dev/null 2>&1 || error "Cần cài rsync. macOS: brew install rsync | Windows: dùng WSL hoặc Git Bash"

# ── Đảm bảo thư mục đích tồn tại trên server ─────────────────────────────────
log "Tạo thư mục $REMOTE_DIR trên server (nếu chưa có)..."
ssh -p "$SSH_PORT" "$TARGET" "mkdir -p $REMOTE_DIR"

# ── Rsync — loại trừ các file không cần thiết ────────────────────────────────
log "Đang upload..."
rsync -avz --delete \
    --progress \
    -e "ssh -p $SSH_PORT" \
    \
    --exclude='node_modules/' \
    --exclude='.git/' \
    --exclude='.pnpm-store/' \
    \
    --exclude='*.tsbuildinfo' \
    --exclude='**/dist/' \
    --exclude='**/.next/' \
    --exclude='**/build/' \
    --exclude='**/out/' \
    --exclude='**/bin/' \
    --exclude='**/obj/' \
    \
    --exclude='.env' \
    --exclude='.env.local' \
    --exclude='.env.*.local' \
    \
    --exclude='**/uploads/' \
    --exclude='logs/' \
    --exclude='*.log' \
    \
    --exclude='.vscode/' \
    --exclude='.idea/' \
    --exclude='.DS_Store' \
    --exclude='Thumbs.db' \
    --exclude='coverage/' \
    \
    "$REPO_ROOT/" \
    "$TARGET:$REMOTE_DIR/"

echo ""
log "Upload hoàn tất!"
echo ""
echo -e "${BLUE}Bước tiếp theo trên server:${NC}"
echo "  ssh -p $SSH_PORT $TARGET"
echo "  cd $REMOTE_DIR"
echo ""
echo "  # Lần đầu — tạo .env:"
echo "  cp .env.production.example .env && nano .env"
echo ""
echo "  # Build images:"
echo "  bash scripts/deploy.sh --build"
echo ""
echo "  # Khởi động:"
echo "  bash scripts/deploy.sh"
