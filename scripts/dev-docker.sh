#!/bin/bash
# Switch sang Docker mode: dừng local dev, start full stack
echo "⚠️  Hãy dừng 'pnpm dev' trước (Ctrl+C trong terminal đang chạy)"
echo ""
echo "▶  Starting all containers..."
docker compose up -d
echo ""
echo "✅ Full stack chạy trên Docker"
echo "   Web:  http://localhost:3000"
echo "   API:  http://localhost:3001"
