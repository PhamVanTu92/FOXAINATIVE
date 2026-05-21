using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using SystemService.Infrastructure.Helpers;

namespace SystemService.Infrastructure.Persistence;

public sealed class SystemDbContextFactory : IDesignTimeDbContextFactory<SystemDbContext>
{
    public SystemDbContext CreateDbContext(string[] args)
    {
        var rawUrl = Environment.GetEnvironmentVariable("SYSTEM_DATABASE_URL")
                     ?? "postgresql://myuser:mypassword@localhost:5432/system_db";

        var connString = PostgresUrlParser.ToNpgsqlConnectionString(rawUrl);

        var options = new DbContextOptionsBuilder<SystemDbContext>()
            .UseNpgsql(connString)
            .UseSnakeCaseNamingConvention()
            .Options;

        return new SystemDbContext(options);
    }
}
