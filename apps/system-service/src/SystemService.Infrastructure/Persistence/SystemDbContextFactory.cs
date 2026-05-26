using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using SystemService.Infrastructure.Helpers;

namespace SystemService.Infrastructure.Persistence;

public sealed class SystemDbContextFactory : IDesignTimeDbContextFactory<SystemDbContext>
{
    public SystemDbContext CreateDbContext(string[] args)
    {
        // dotnet ef gọi factory này (không chạy Program.Main) nên cần tự load .env.
        // Tìm .env ngược lên repo root từ CWD; biến env đã có sẵn sẽ KHÔNG bị override.
        DotNetEnv.Env.TraversePath().Load();

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
