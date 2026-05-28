# ============================================
# INDEX SERVICE DOCKERFILE
# Optimized with UV and Multi-stage Build
# Runtime: python:3.12-slim (not distroless due to libreoffice requirement)
# ============================================

# ============================================
# CONFIGURATION ARGUMENTS
# ============================================
ARG PYTHON_VERSION=3.12
# Replace with actual SHA256 digest: docker buildx imagetools inspect ghcr.io/astral-sh/uv:python3.12-bookworm-slim --format '{{json .Manifest}}' | jq -r .digest
ARG SHA256_DIGEST_BUILDER=51ba01a1b91be564ccbd0ffc8c8bc6dd26f5fe11b4454b2a4d11803ecae3cb40

# ============================================
# Builder Stage: Install dependencies with UV
# ============================================
FROM ghcr.io/astral-sh/uv:python${PYTHON_VERSION}-bookworm-slim@sha256:${SHA256_DIGEST_BUILDER} AS builder

# UV Environment Variables
ENV UV_LINK_MODE=copy \
    UV_COMPILE_BYTECODE=1 \
    UV_PYTHON_DOWNLOADS=never

# Install build dependencies (only needed during compilation)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    gcc \
    g++ \
    pkg-config \
    libpq-dev \
    libjpeg-dev \
    libpng-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /build

# Install Python dependencies using UV
COPY pyproject.toml uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv \
    --mount=type=bind,source=uv.lock,target=uv.lock \
    --mount=type=bind,source=pyproject.toml,target=pyproject.toml \
    uv sync --frozen --no-install-project --no-dev --no-editable

# ============================================
# Runtime Stage: Production image with runtime dependencies
# ============================================
FROM python:${PYTHON_VERSION}-slim-bookworm AS runtime

# Re-declare ARG for use in this stage
ARG PYTHON_VERSION=3.12

# Metadata
LABEL maintainer="Kitto Dekiru"
LABEL maintainer.email="cuongtn.dekiru@gmail.com"
LABEL image.description="Index service with UV and document processing"
LABEL org.opencontainers.image.version="1.0.0"

# Install runtime dependencies (no build tools)
# - libmagic1: File type detection (python-magic)
# - libpq5: PostgreSQL client library
# - curl: Health check
RUN apt-get update && apt-get install -y --no-install-recommends \
    libmagic1 \
    libpq5 \
    curl \
    libjpeg62-turbo \
    libpng16-16 \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd --gid 1000 app \
    && useradd --uid 1000 --gid app --shell /bin/bash --create-home app

WORKDIR /app

# Copy virtual environment from builder
COPY --from=builder --chown=app:app /build/.venv /app/.venv

# Copy application code
COPY --chown=app:app . /app/

# Create necessary directories for logs
RUN mkdir -p /app/logs && \
    chown -R app:app /app/logs && \
    chmod -R 755 /app/logs

# Environment variables
ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONPATH="/app:/app/.venv/lib/python3.12/site-packages" \
    LANG=C.UTF-8 \
    PYTHONUNBUFFERED=1 \
    PYTHONFAULTHANDLER=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONHASHSEED=random \
    HOST=0.0.0.0 \
    PORT=8000

# Switch to non-root user
USER app

# Health check
HEALTHCHECK --interval=30s --timeout=30s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/ || exit 1

# Expose port
EXPOSE 8000

# Run the application
CMD ["python", "main.py"]
