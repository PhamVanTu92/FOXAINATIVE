using Testcontainers.PostgreSql;
using Xunit;

namespace SystemService.IntegrationTests.Infrastructure;

public sealed class PostgresContainerFixture : IAsyncLifetime
{
    public PostgreSqlContainer Container { get; } = new PostgreSqlBuilder()
        .WithImage("postgres:16-alpine")
        .WithDatabase("system_db_test")
        .WithUsername("test_user")
        .WithPassword("test_pass")
        .WithCleanUp(true)
        .Build();

    public string ConnectionUrl =>
        $"postgresql://test_user:test_pass@{Container.Hostname}:{Container.GetMappedPublicPort(5432)}/system_db_test";

    public Task InitializeAsync() => Container.StartAsync();

    public Task DisposeAsync() => Container.DisposeAsync().AsTask();
}

[CollectionDefinition(Name)]
public sealed class PostgresCollection : ICollectionFixture<PostgresContainerFixture>
{
    public const string Name = "postgres";
}
