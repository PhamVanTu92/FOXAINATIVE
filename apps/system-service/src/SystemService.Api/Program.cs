using Microsoft.AspNetCore.Server.Kestrel.Core;
using Microsoft.EntityFrameworkCore;
using Serilog;
using SystemService.Api.GrpcServices;
using SystemService.Api.Interceptors;
using SystemService.Application;
using SystemService.Infrastructure;
using SystemService.Infrastructure.Helpers;
using SystemService.Infrastructure.Persistence;
using SystemService.Infrastructure.Persistence.Seeding;

// Load .env từ repo root (đi ngược lên từ CWD đến khi tìm thấy .env hoặc tới drive root).
// Cho phép cả monorepo (System Service .NET + API Gateway NestJS + docker-compose) dùng
// chung 1 file .env duy nhất. Env var sẵn có trong process sẽ KHÔNG bị override (--false).
DotNetEnv.Env.TraversePath().Load();

var builder = WebApplication.CreateBuilder(args);

builder.Configuration.AddEnvironmentVariables();

builder.Host.UseSerilog((ctx, _, lc) => lc
    .ReadFrom.Configuration(ctx.Configuration)
    .Enrich.FromLogContext()
    .Enrich.WithEnvironmentName()
    .WriteTo.Console());

var grpcPort = int.TryParse(builder.Configuration["GRPC_PORT"], out var gp) ? gp : 50051;
var httpPort = int.TryParse(builder.Configuration["HTTP_PORT"]
                           ?? builder.Configuration["SYSTEM_SERVICE_PORT"], out var hp) ? hp : 3002;

if (!builder.Environment.IsEnvironment("Test"))
{
    builder.WebHost.ConfigureKestrel(opts =>
    {
        opts.ListenAnyIP(grpcPort, lo => lo.Protocols = HttpProtocols.Http2);
        opts.ListenAnyIP(httpPort, lo => lo.Protocols = HttpProtocols.Http1);
    });
}

builder.Services.AddApplication();
builder.Services.AddInfrastructure(builder.Configuration);

builder.Services.AddGrpc(options =>
{
    options.EnableDetailedErrors = builder.Environment.IsDevelopment();
    options.Interceptors.Add<LoggingInterceptor>();
    options.Interceptors.Add<ExceptionInterceptor>();
});
builder.Services.AddGrpcReflection();
builder.Services.AddGrpcHealthChecks().AddCheck("self", () => Microsoft.Extensions.Diagnostics.HealthChecks.HealthCheckResult.Healthy());

var dbUrlForHealth = builder.Configuration["SYSTEM_DATABASE_URL"]
                     ?? builder.Configuration.GetConnectionString("SystemDb");
if (!string.IsNullOrWhiteSpace(dbUrlForHealth))
{
    var healthConn = PostgresUrlParser.ToNpgsqlConnectionString(dbUrlForHealth);
    builder.Services.AddHealthChecks().AddNpgSql(healthConn, name: "system-db");
}

var app = builder.Build();

var autoMigrate = app.Environment.IsDevelopment()
                  || app.Environment.IsEnvironment("Test")
                  || string.Equals(app.Configuration["SYSTEM_SERVICE_AUTOMIGRATE"], "true", StringComparison.OrdinalIgnoreCase);
var autoSeed = app.Environment.IsDevelopment()
               || app.Environment.IsEnvironment("Test")
               || string.Equals(app.Configuration["SYSTEM_SERVICE_SEED"], "true", StringComparison.OrdinalIgnoreCase);

if (autoMigrate)
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<SystemDbContext>();
    await db.Database.MigrateAsync();
    if (autoSeed)
    {
        await DataSeeder.SeedAsync(scope.ServiceProvider);
    }
}

app.MapGrpcService<AuthGrpcService>();
app.MapGrpcService<UsersGrpcService>();
app.MapGrpcService<RolesGrpcService>();
app.MapGrpcService<ModuleGroupsGrpcService>();
app.MapGrpcService<ModulesGrpcService>();
app.MapGrpcService<PermissionActionsGrpcService>();
app.MapGrpcService<OrganizationsGrpcService>();

// gRPC reflection exposes service metadata (method signatures), không leak business data.
// Bật mặc định để Postman / grpcui / grpcurl discover được. Có thể disable qua env nếu muốn:
//   GRPC_REFLECTION=false  →  tắt reflection (vd staging/prod muốn khóa).
var reflectionEnabled = !string.Equals(
    app.Configuration["GRPC_REFLECTION"], "false", StringComparison.OrdinalIgnoreCase);
if (reflectionEnabled)
{
    app.MapGrpcReflectionService();
}

app.MapGrpcHealthChecksService();
app.MapHealthChecks("/health");
app.MapGet("/", () => Results.Ok(new
{
    service = "foxai-system-service",
    version = "0.1.0",
    grpcPort,
    httpPort,
}));

await app.RunAsync();

public partial class Program { }
