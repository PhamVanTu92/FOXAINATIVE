using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.AspNetCore.TestHost;
using Microsoft.Extensions.Configuration;

namespace SystemService.IntegrationTests.Infrastructure;

public sealed class SystemServiceApplicationFactory(string databaseUrl) : WebApplicationFactory<Program>
{
    private const string TestJwtSecret = "integration-test-secret-key-32-chars-minimum-length";

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Test");
        builder.UseTestServer();

        builder.ConfigureAppConfiguration((_, cfg) =>
        {
            cfg.AddInMemoryCollection(new Dictionary<string, string?>
            {
                ["SYSTEM_DATABASE_URL"] = databaseUrl,
                ["JWT_SECRET"] = TestJwtSecret,
                ["JWT_EXPIRES_IN"] = "1h",
                ["Jwt:Secret"] = TestJwtSecret,
                ["Jwt:Issuer"] = "foxai-system-service",
                ["Jwt:Audience"] = "foxai-platform",
                ["Jwt:ExpiresIn"] = "1h",
                ["Jwt:RefreshTokenDays"] = "1",
                ["GRPC_PORT"] = "0",
                ["HTTP_PORT"] = "0",
            });
        });
    }
}
