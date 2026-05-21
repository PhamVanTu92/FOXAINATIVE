using FluentAssertions;
using Foxai.System.V1;
using SystemService.IntegrationTests.Infrastructure;
using Xunit;

namespace SystemService.IntegrationTests.Permissions;

[Collection(PostgresCollection.Name)]
public sealed class PermissionsTests(PostgresContainerFixture postgres) : IAsyncLifetime
{
    private SystemServiceApplicationFactory _factory = default!;
    private PermissionsService.PermissionsServiceClient _client = default!;

    public Task InitializeAsync()
    {
        _factory = new SystemServiceApplicationFactory(postgres.ConnectionUrl);
        _ = _factory.CreateDefaultClient();
        _client = new PermissionsService.PermissionsServiceClient(GrpcTestClientFactory.CreateChannel(_factory));
        return Task.CompletedTask;
    }

    public Task DisposeAsync()
    {
        _factory.Dispose();
        return Task.CompletedTask;
    }

    [Fact]
    public async Task ListPermissions_returns_all_seeded()
    {
        var response = await _client.ListPermissionsAsync(new ListPermissionsRequest());

        response.Items.Should().HaveCountGreaterThanOrEqualTo(24);
        response.Items.Select(p => p.Code).Should().Contain(new[]
        {
            "USER_CREATE", "ROLE_READ", "ORG_CREATE", "SYSTEM_ADMIN",
        });
    }

    [Fact]
    public async Task ListPermissions_with_module_filter_returns_only_module()
    {
        var response = await _client.ListPermissionsAsync(new ListPermissionsRequest { Module = "USER" });

        response.Items.Should().NotBeEmpty();
        response.Items.Should().OnlyContain(p => p.Module == "USER");
    }
}
