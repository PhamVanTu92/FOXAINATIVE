using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.DependencyInjection;
using SystemService.Application.Abstractions.Clock;
using SystemService.Application.Abstractions.Persistence;
using SystemService.Application.Abstractions.Security;
using SystemService.Infrastructure.Helpers;
using SystemService.Infrastructure.Persistence;
using SystemService.Infrastructure.Persistence.Interceptors;
using SystemService.Infrastructure.Persistence.Repositories;
using SystemService.Infrastructure.Security;
using SystemService.Infrastructure.Services;

namespace SystemService.Infrastructure;

public static class DependencyInjection
{
    public static IServiceCollection AddInfrastructure(this IServiceCollection services, IConfiguration configuration)
    {
        services.AddSingleton<IDateTimeProvider, DateTimeProvider>();

        services.Configure<JwtOptions>(configuration.GetSection(JwtOptions.SectionName));
        services.PostConfigure<JwtOptions>(opts =>
        {
            if (string.IsNullOrWhiteSpace(opts.Secret))
            {
                opts.Secret = configuration["JWT_SECRET"] ?? string.Empty;
            }
            if (!string.IsNullOrWhiteSpace(configuration["JWT_EXPIRES_IN"]))
            {
                opts.ExpiresIn = configuration["JWT_EXPIRES_IN"]!;
            }
            if (opts.Secret.Length < 32)
            {
                throw new InvalidOperationException(
                    "JWT_SECRET must be at least 32 characters. Set the JWT_SECRET environment variable or Jwt:Secret config.");
            }
        });

        services.AddScoped<IPasswordHasher, BCryptPasswordHasher>();
        services.AddScoped<IJwtTokenService, JwtTokenService>();

        services.AddScoped<AuditingInterceptor>();

        services.AddDbContext<SystemDbContext>((sp, options) =>
        {
            var cfg = sp.GetRequiredService<IConfiguration>();
            var rawUrl = cfg["SYSTEM_DATABASE_URL"]
                         ?? cfg.GetConnectionString("SystemDb")
                         ?? throw new InvalidOperationException("SYSTEM_DATABASE_URL not configured.");
            var connString = PostgresUrlParser.ToNpgsqlConnectionString(rawUrl);

            options.UseNpgsql(connString)
                   .UseSnakeCaseNamingConvention()
                   .AddInterceptors(sp.GetRequiredService<AuditingInterceptor>());
        });

        services.AddScoped<IUnitOfWork, UnitOfWork>();
        services.AddScoped<IUserRepository, UserRepository>();
        services.AddScoped<IRoleRepository, RoleRepository>();
        services.AddScoped<IPermissionRepository, PermissionRepository>();
        services.AddScoped<IOrganizationRepository, OrganizationRepository>();
        services.AddScoped<IRefreshTokenRepository, RefreshTokenRepository>();

        return services;
    }
}
