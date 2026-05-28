# ============================================
# QUERY SERVICE DOCKERFILE
# Optimized with UV and Distroless
# ============================================

# ============================================
# CONFIGURATION ARGUMENTS
# ============================================
ARG PYTHON_VERSION=3.12
# Replace with actual SHA256 digest: docker buildx imagetools inspect ghcr.io/astral-sh/uv:python3.12-bookworm-slim --format '{{json .Manifest}}' | jq -r .digest
ARG SHA256_DIGEST_BUILDER=51ba01a1b91be564ccbd0ffc8c8bc6dd26f5fe11b4454b2a4d11803ecae3cb40
# Replace with actual SHA256 digest: docker buildx imagetools inspect gcr.io/distroless/base-debian12:nonroot --format '{{json .Manifest}}' | jq -r .digest
ARG SHA256_DIGEST_RUNTIME=748987b77724fc1a9cf1acc8afb7f2cecff8cd91f24f43423647f1896eb7262f
ARG TARGETARCH

# ============================================
# Builder Stage: Install dependencies
# ============================================
FROM ghcr.io/astral-sh/uv:python${PYTHON_VERSION}-bookworm-slim@sha256:${SHA256_DIGEST_BUILDER} AS builder

# UV Environment Variables
# UV_HTTP_TIMEOUT: default 30s isn't enough for large wheels (pandas, numpy,
# pymupdf, magika...) on slow networks — bump to 10 min to avoid spurious fails.
ENV UV_LINK_MODE=copy \
    UV_COMPILE_BYTECODE=1 \
    UV_PYTHON_DOWNLOADS=never \
    UV_HTTP_TIMEOUT=600

# Install build dependencies for compiling Python packages (cryptography, bcrypt, etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    libpq-dev \
    pkg-config \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copy multi-arch shared libraries
RUN if [ "$TARGETARCH" = "amd64" ]; then \
        LIBARCH="x86_64"; \
    elif [ "$TARGETARCH" = "arm64" ]; then \
        LIBARCH="aarch64"; \
    else \
        LIBARCH="$(uname -m)"; \
    fi && \
    mkdir -p /lib/multi-arch && \
    # Core C libraries
    cp /lib/${LIBARCH}-linux-gnu/libc.so.6 /lib/multi-arch/ && \
    cp /lib/${LIBARCH}-linux-gnu/libm.so.6 /lib/multi-arch/ && \
    # Compression library
    cp /lib/${LIBARCH}-linux-gnu/libz.so.1 /lib/multi-arch/ && \
    # GCC support library
    cp /lib/${LIBARCH}-linux-gnu/libgcc_s.so.1 /lib/multi-arch/ && \
    # C++ standard library (needed for PyMuPDF/fitz)
    cp /usr/lib/${LIBARCH}-linux-gnu/libstdc++.so.6 /lib/multi-arch/ && \
    # SQLite library (needed for qdrant-client local persistence)
    cp /usr/lib/${LIBARCH}-linux-gnu/libsqlite3.so.0 /lib/multi-arch/ && \
    # FFI library (needed for Python ctypes/multiprocessing)
    cp /usr/lib/${LIBARCH}-linux-gnu/libffi.so.8 /lib/multi-arch/ && \
    # OpenSSL libraries (needed for psycopg/libpq SSL connections)
    cp /usr/lib/${LIBARCH}-linux-gnu/libssl.so.3 /lib/multi-arch/ && \
    cp /usr/lib/${LIBARCH}-linux-gnu/libcrypto.so.3 /lib/multi-arch/ && \
    # XML libraries (needed for lxml from markitdown[all])
    cp /usr/lib/${LIBARCH}-linux-gnu/libxml2.so.2 /lib/multi-arch/ 2>/dev/null || true && \
    cp /usr/lib/${LIBARCH}-linux-gnu/libxslt.so.1 /lib/multi-arch/ 2>/dev/null || true && \
    cp /usr/lib/${LIBARCH}-linux-gnu/libexslt.so.0 /lib/multi-arch/ 2>/dev/null || true && \
    cp /usr/lib/${LIBARCH}-linux-gnu/libicuuc.so.72 /lib/multi-arch/ 2>/dev/null || cp /usr/lib/${LIBARCH}-linux-gnu/libicuuc.so.* /lib/multi-arch/ 2>/dev/null || true && \
    cp /usr/lib/${LIBARCH}-linux-gnu/libicudata.so.72 /lib/multi-arch/ 2>/dev/null || cp /usr/lib/${LIBARCH}-linux-gnu/libicudata.so.* /lib/multi-arch/ 2>/dev/null || true && \
    cp /usr/lib/${LIBARCH}-linux-gnu/liblzma.so.5 /lib/multi-arch/ 2>/dev/null || true && \
    # PostgreSQL client library dependencies (Kerberos, LDAP, SASL)
    cp /usr/lib/${LIBARCH}-linux-gnu/libgssapi_krb5.so.2 /lib/multi-arch/ 2>/dev/null || true && \
    cp /usr/lib/${LIBARCH}-linux-gnu/libldap-2.5.so.0 /lib/multi-arch/ 2>/dev/null || cp /usr/lib/${LIBARCH}-linux-gnu/libldap.so.2 /lib/multi-arch/ 2>/dev/null || true && \
    cp /usr/lib/${LIBARCH}-linux-gnu/liblber-2.5.so.0 /lib/multi-arch/ 2>/dev/null || cp /usr/lib/${LIBARCH}-linux-gnu/liblber.so.2 /lib/multi-arch/ 2>/dev/null || true && \
    cp /usr/lib/${LIBARCH}-linux-gnu/libsasl2.so.2 /lib/multi-arch/ 2>/dev/null || true && \
    cp /usr/lib/${LIBARCH}-linux-gnu/libkrb5.so.3 /lib/multi-arch/ 2>/dev/null || true && \
    cp /usr/lib/${LIBARCH}-linux-gnu/libk5crypto.so.3 /lib/multi-arch/ 2>/dev/null || true && \
    cp /usr/lib/${LIBARCH}-linux-gnu/libcom_err.so.2 /lib/multi-arch/ 2>/dev/null || true && \
    cp /usr/lib/${LIBARCH}-linux-gnu/libkrb5support.so.0 /lib/multi-arch/ 2>/dev/null || true && \
    cp /lib/${LIBARCH}-linux-gnu/libkeyutils.so.1 /lib/multi-arch/ 2>/dev/null || true && \
    # PostgreSQL client library (needed for psycopg)
    cp /usr/lib/${LIBARCH}-linux-gnu/libpq.so.5 /lib/multi-arch/

WORKDIR /build

# Install Python dependencies using UV
COPY pyproject.toml uv.lock ./
RUN --mount=type=cache,target=/root/.cache/uv \
    --mount=type=bind,source=uv.lock,target=uv.lock \
    --mount=type=bind,source=pyproject.toml,target=pyproject.toml \
    uv sync --frozen --no-install-project --no-dev --no-editable

# ============================================
# Runtime Stage: Production image
# ============================================
FROM gcr.io/distroless/base-debian12:nonroot@sha256:${SHA256_DIGEST_RUNTIME} AS runtime

# Re-declare ARG for use in this stage
ARG PYTHON_VERSION=3.12

# Metadata
LABEL maintainer="Kitto Dekiru"
LABEL maintainer.email="cuongtn@fox.ai.vn"
LABEL image.description="Query service with UV and Distroless"
LABEL org.opencontainers.image.version="1.0.0"

WORKDIR /app

# Copy shared libraries from builder
COPY --from=builder /lib/multi-arch/ /lib/multi-arch/

# Copy Python interpreter and standard library
COPY --from=builder /usr/local/lib/libpython${PYTHON_VERSION}.so.1.0 /usr/local/lib/libpython${PYTHON_VERSION}.so.1.0
COPY --from=builder /usr/local/lib/python${PYTHON_VERSION}/ /usr/local/lib/python${PYTHON_VERSION}/
COPY --from=builder /usr/local/bin/python3 /usr/local/bin/python3

# Copy virtual environment with dependencies
COPY --from=builder --chown=nonroot:nonroot /build/.venv /app/.venv

# Copy application code
COPY --chown=nonroot:nonroot . /app/

# Environment variables
ENV PATH="/app/.venv/bin:$PATH" \
    PYTHONPATH="/app:/app/.venv/lib/python3.12/site-packages" \
    LANG=C.UTF-8 \
    PYTHONUNBUFFERED=1 \
    PYTHONFAULTHANDLER=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PYTHONHASHSEED=random \
    LD_LIBRARY_PATH=/lib/multi-arch \
    HOST=0.0.0.0 \
    PORT=8000

# Expose port
EXPOSE 8000

# Entrypoint (distroless nonroot user already set, UID 65532)
ENTRYPOINT ["python3", "main.py"]
