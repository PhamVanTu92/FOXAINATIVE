using FluentAssertions;
using Foxai.System.V1;
using Grpc.Core;
using SystemService.IntegrationTests.Infrastructure;
using Xunit;
using DataSeeder = SystemService.Infrastructure.Persistence.Seeding.DataSeeder;

namespace SystemService.IntegrationTests.Auth;

[Collection(PostgresCollection.Name)]
public sealed class LoginTests(PostgresContainerFixture postgres) : IAsyncLifetime
{
    private SystemServiceApplicationFactory _factory = default!;
    private AuthService.AuthServiceClient _client = default!;

    public Task InitializeAsync()
    {
        _factory = new SystemServiceApplicationFactory(postgres.ConnectionUrl);
        _ = _factory.CreateDefaultClient();
        _client = new AuthService.AuthServiceClient(GrpcTestClientFactory.CreateChannel(_factory));
        return Task.CompletedTask;
    }

    public Task DisposeAsync()
    {
        _factory.Dispose();
        return Task.CompletedTask;
    }

    [Fact]
    public async Task Login_with_seeded_admin_returns_access_and_refresh_tokens()
    {
        var response = await _client.LoginAsync(new LoginRequest
        {
            Email = DataSeeder.DefaultAdminEmail,
            Password = DataSeeder.DefaultAdminPassword,
        });

        response.AccessToken.Should().NotBeNullOrWhiteSpace();
        response.RefreshToken.Should().NotBeNullOrWhiteSpace();
        response.ExpiresIn.Should().BeGreaterThan(0);
        response.User.Should().NotBeNull();
        response.User.Email.Should().Be(DataSeeder.DefaultAdminEmail);
        response.User.Roles.Should().Contain("SUPER_ADMIN");
        response.User.Permissions.Should().Contain("SYSTEM_ADMIN");
    }

    [Fact]
    public async Task Login_with_wrong_password_returns_Unauthenticated()
    {
        Func<Task> act = async () => await _client.LoginAsync(new LoginRequest
        {
            Email = DataSeeder.DefaultAdminEmail,
            Password = "wrong-password",
        });

        var ex = await act.Should().ThrowAsync<RpcException>();
        ex.Which.StatusCode.Should().Be(StatusCode.Unauthenticated);
    }

    [Fact]
    public async Task Login_with_empty_email_returns_InvalidArgument()
    {
        Func<Task> act = async () => await _client.LoginAsync(new LoginRequest
        {
            Email = string.Empty,
            Password = "anything",
        });

        var ex = await act.Should().ThrowAsync<RpcException>();
        ex.Which.StatusCode.Should().Be(StatusCode.InvalidArgument);
    }
}
