#!/bin/bash
# Database migration runner for Query Service
# Handles database migrations with automatic rollback on failure

set -e

echo "=========================================="
echo "Database Migration Runner - Query Service"
echo "Time: $(date '+%Y-%m-%d %H:%M:%S')"
echo "=========================================="
echo ""

# Wait for database to be ready
echo "Waiting for database connection..."
MAX_RETRIES=30
RETRY_COUNT=0

while ! pg_isready -h "${POSTGRES__HOST}" -p "${POSTGRES__PORT:-5432}" -U "${POSTGRES__USERNAME}" >/dev/null 2>&1; do
  RETRY_COUNT=$((RETRY_COUNT + 1))
  if [ $RETRY_COUNT -ge $MAX_RETRIES ]; then
    echo "ERROR: Database not ready after ${MAX_RETRIES} attempts"
    exit 1
  fi
  echo "Attempt ${RETRY_COUNT}/${MAX_RETRIES}..."
  sleep 2
done

echo "Database connection established"
echo ""

# Get current migration version
echo "Checking current database version..."
CURRENT_VERSION=$(alembic current 2>/dev/null | grep -oP '(?<=\().*?(?=\))' | head -1 || echo "none")
if [ "$CURRENT_VERSION" = "none" ] || [ -z "$CURRENT_VERSION" ]; then
  echo "Current version: Empty database (no migrations applied)"
else
  echo "Current version: $CURRENT_VERSION"
fi
echo ""

# Run database migration
echo "Running database migration: alembic upgrade head"
if alembic upgrade head 2>&1 | tee /tmp/migration.log; then
  # Check for errors in output
  if grep -qi "error\|failed\|traceback" /tmp/migration.log; then
    echo ""
    echo "ERROR: Migration failed - errors detected in output"

    # Attempt rollback if possible
    if [ "$CURRENT_VERSION" != "none" ] && [ -n "$CURRENT_VERSION" ]; then
      echo "Attempting rollback to version: $CURRENT_VERSION"
      alembic downgrade "$CURRENT_VERSION" 2>&1 || true
    fi
    exit 1
  fi

  # Migration successful
  NEW_VERSION=$(alembic current 2>/dev/null | grep -oP '(?<=\().*?(?=\))' | head -1 || echo "unknown")
  echo ""
  echo "=========================================="
  echo "Migration completed successfully"
  echo "From: ${CURRENT_VERSION:-none}"
  echo "To:   ${NEW_VERSION}"
  echo "Time: $(date '+%Y-%m-%d %H:%M:%S')"
  echo "=========================================="
  exit 0
else
  # Migration command failed
  echo ""
  echo "ERROR: Migration command failed"

  # Attempt rollback if possible
  if [ "$CURRENT_VERSION" != "none" ] && [ -n "$CURRENT_VERSION" ]; then
    echo "Attempting rollback to version: $CURRENT_VERSION"
    if alembic downgrade "$CURRENT_VERSION" 2>&1; then
      echo "Rollback completed successfully"
    else
      echo "WARNING: Rollback failed - manual intervention required"
    fi
  fi
  exit 1
fi

      echo "✅ Rollback successful - database restored to previous state"
      echo "   Version: $CURRENT_VERSION"
    else
      echo "❌ Rollback failed - database may be in inconsistent state!"
      echo "⚠️  MANUAL INTERVENTION REQUIRED!"
      echo ""
      echo "To manually rollback, run:"
      echo "   docker-compose run query-migration alembic downgrade $CURRENT_VERSION"
    fi
  else
    echo "⚠️  No previous version to rollback to (database was empty)"
    echo "   Database remains empty - safe to retry after fixing migration"
  fi

  echo ""
  echo "📋 Next steps:"
  echo "   1. Check migration files in: src/query/joint/postgres/migrations/versions/"
  echo "   2. Fix the migration error"
  echo "   3. Test locally: docker-compose up query-migration"
  echo "   4. Retry deployment"
  echo ""
  echo "Timestamp: $(date '+%Y-%m-%d %H:%M:%S')"
  echo "=================================================="

  exit 1
fi
