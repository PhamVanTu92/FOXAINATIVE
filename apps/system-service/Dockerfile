# syntax=docker/dockerfile:1.7

# ===== Build stage =====
FROM mcr.microsoft.com/dotnet/sdk:9.0-bookworm-slim AS build
WORKDIR /src

# Copy solution + project files first to leverage layer caching
COPY apps/system-service/SystemService.sln                  apps/system-service/
COPY apps/system-service/Directory.Build.props              apps/system-service/
COPY apps/system-service/Directory.Packages.props           apps/system-service/
COPY apps/system-service/global.json                        apps/system-service/

COPY apps/system-service/src/SystemService.Domain/*.csproj         apps/system-service/src/SystemService.Domain/
COPY apps/system-service/src/SystemService.Application/*.csproj    apps/system-service/src/SystemService.Application/
COPY apps/system-service/src/SystemService.Infrastructure/*.csproj apps/system-service/src/SystemService.Infrastructure/
COPY apps/system-service/src/SystemService.Api/*.csproj            apps/system-service/src/SystemService.Api/
COPY apps/system-service/tests/SystemService.UnitTests/*.csproj         apps/system-service/tests/SystemService.UnitTests/
COPY apps/system-service/tests/SystemService.IntegrationTests/*.csproj  apps/system-service/tests/SystemService.IntegrationTests/

# Need proto files at restore time because Grpc.Tools generates stubs during restore/build
COPY packages/shared-proto/proto packages/shared-proto/proto

RUN dotnet restore apps/system-service/SystemService.sln \
    /p:UseAppHost=false

# Copy the rest of the sources
COPY apps/system-service/ apps/system-service/

RUN dotnet publish apps/system-service/src/SystemService.Api/SystemService.Api.csproj \
    -c Release \
    -o /app/publish \
    /p:UseAppHost=false

# ===== Runtime stage =====
FROM mcr.microsoft.com/dotnet/aspnet:9.0-bookworm-slim AS runtime
WORKDIR /app

RUN apt-get update \
 && apt-get install -y --no-install-recommends wget \
 && rm -rf /var/lib/apt/lists/*

COPY --from=build --chown=app:app /app/publish ./

USER app

EXPOSE 50051 3002

ENV ASPNETCORE_ENVIRONMENT=Production \
    DOTNET_RUNNING_IN_CONTAINER=true \
    DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=false

HEALTHCHECK --interval=20s --timeout=5s --start-period=15s --retries=5 \
  CMD wget --quiet --tries=1 --spider http://localhost:3002/health || exit 1

ENTRYPOINT ["dotnet", "SystemService.Api.dll"]
