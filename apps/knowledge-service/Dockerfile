# syntax=docker/dockerfile:1.7

# ===== Build stage =====
FROM mcr.microsoft.com/dotnet/sdk:9.0-bookworm-slim AS build
WORKDIR /src

COPY apps/knowledge-service/KnowledgeService.sln apps/knowledge-service/

COPY apps/knowledge-service/src/KnowledgeService.Domain/*.csproj         apps/knowledge-service/src/KnowledgeService.Domain/
COPY apps/knowledge-service/src/KnowledgeService.Application/*.csproj    apps/knowledge-service/src/KnowledgeService.Application/
COPY apps/knowledge-service/src/KnowledgeService.Infrastructure/*.csproj apps/knowledge-service/src/KnowledgeService.Infrastructure/
COPY apps/knowledge-service/src/KnowledgeService.Api/*.csproj            apps/knowledge-service/src/KnowledgeService.Api/

# Proto files needed at restore time for Grpc.Tools code generation
COPY packages/shared-proto/proto packages/shared-proto/proto

RUN dotnet restore apps/knowledge-service/KnowledgeService.sln \
    /p:UseAppHost=false

COPY apps/knowledge-service/ apps/knowledge-service/

RUN dotnet publish apps/knowledge-service/src/KnowledgeService.Api/KnowledgeService.Api.csproj \
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

EXPOSE 50052 3005

ENV ASPNETCORE_ENVIRONMENT=Production \
    DOTNET_RUNNING_IN_CONTAINER=true \
    DOTNET_SYSTEM_GLOBALIZATION_INVARIANT=false

HEALTHCHECK --interval=20s --timeout=5s --start-period=15s --retries=5 \
  CMD wget --quiet --tries=1 --spider http://localhost:3005/health || exit 1

ENTRYPOINT ["dotnet", "KnowledgeService.Api.dll"]
