using KnowledgeService.Api.GrpcServices;
using KnowledgeService.Api.Interceptors;
using KnowledgeService.Application;
using KnowledgeService.Infrastructure;
using KnowledgeService.Infrastructure.Helpers;
using KnowledgeService.Infrastructure.Persistence;
using KnowledgeService.Infrastructure.Persistence.Seeding;
using Microsoft.AspNetCore.Server.Kestrel.Core;
using Microsoft.EntityFrameworkCore;
using Serilog;

DotNetEnv.Env.TraversePath().Load();

var builder = WebApplication.CreateBuilder(args);
builder.Configuration.AddEnvironmentVariables();

builder.Host.UseSerilog((ctx, _, lc) => lc
    .ReadFrom.Configuration(ctx.Configuration)
    .Enrich.FromLogContext()
    .Enrich.WithEnvironmentName()
    .WriteTo.Console());

var grpcPort = int.TryParse(builder.Configuration["GRPC_PORT"], out var gp) ? gp : 50052;
var httpPort = int.TryParse(builder.Configuration["HTTP_PORT"], out var hp) ? hp : 3005;

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

builder.Services.AddControllers(opts =>
    opts.Filters.Add<KnowledgeService.Api.Filters.AppExceptionFilter>());
builder.Services.AddEndpointsApiExplorer();

builder.Services.AddGrpc(options =>
{
    options.EnableDetailedErrors = builder.Environment.IsDevelopment();
    options.Interceptors.Add<LoggingInterceptor>();
    options.Interceptors.Add<ExceptionInterceptor>();
});
builder.Services.AddGrpcReflection();
builder.Services.AddGrpcHealthChecks()
    .AddCheck("self", () => Microsoft.Extensions.Diagnostics.HealthChecks.HealthCheckResult.Healthy());

var dbUrlForHealth = builder.Configuration["KNOWLEDGE_DATABASE_URL"];
if (!string.IsNullOrWhiteSpace(dbUrlForHealth))
{
    var healthConn = PostgresUrlParser.ToNpgsqlConnectionString(dbUrlForHealth);
    builder.Services.AddHealthChecks().AddNpgSql(healthConn, name: "knowledge-db");
}

var app = builder.Build();

var autoMigrate = app.Environment.IsDevelopment()
    || app.Environment.IsEnvironment("Test")
    || string.Equals(app.Configuration["KNOWLEDGE_SERVICE_AUTOMIGRATE"], "true", StringComparison.OrdinalIgnoreCase);
var autoSeed = app.Environment.IsDevelopment()
    || app.Environment.IsEnvironment("Test")
    || string.Equals(app.Configuration["KNOWLEDGE_SERVICE_SEED"], "true", StringComparison.OrdinalIgnoreCase);

if (autoMigrate)
{
    using var scope = app.Services.CreateScope();
    var db = scope.ServiceProvider.GetRequiredService<KnowledgeDbContext>();
    await db.Database.MigrateAsync();
    if (autoSeed)
        await DataSeeder.SeedAsync(scope.ServiceProvider);
}

app.MapGrpcService<KnowledgeGrpcService>();

var reflectionEnabled = !string.Equals(
    app.Configuration["GRPC_REFLECTION"], "false", StringComparison.OrdinalIgnoreCase);
if (reflectionEnabled)
    app.MapGrpcReflectionService();

app.MapGrpcHealthChecksService();
app.MapHealthChecks("/health");
app.MapControllers();
app.MapGet("/", () => Results.Ok(new
{
    service = "foxai-knowledge-service",
    version = "0.1.0",
    grpcPort,
    httpPort
}));

await app.RunAsync();

public partial class Program { }
