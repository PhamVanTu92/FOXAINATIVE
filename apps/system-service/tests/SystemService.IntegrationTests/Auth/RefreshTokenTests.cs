using FluentAssertions;
using Foxai.System.V1;
using Grpc.Core;
using SystemService.IntegrationTests.Infrastructure;
using Xunit;
using DataSeeder = SystemService.Infrastructure.Persistence.Seeding.DataSeeder;

namespace SystemService.IntegrationTests.Auth;

[Collection(PostgresCollection.Name)]
public sealed class RefreshTokenTests(PostgresContainerFixture postgres) : IAsyncLifetime
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
    public async Task RefreshToken_rotates_token_and_revokes_old()
    {
        var login = await _client.LoginAsync(new LoginRequest
        {
            Login = DataSeeder.DefaultAdminEmail,
            Password = DataSeeder.DefaultAdminPassword,
        });

        var refreshed = await _client.RefreshTokenAsync(new RefreshTokenRequest
        {
            RefreshToken = login.RefreshToken,
        });

        refreshed.AccessToken.Should().NotBeNullOrWhiteSpace();
        refreshed.RefreshToken.Should().NotBe(login.RefreshToken);

        Func<Task> usingOldToken = async () => await _client.RefreshTokenAsync(new RefreshTokenRequest
        {
            RefreshToken = login.RefreshToken,
        });

        var ex = await usingOldToken.Should().ThrowAsync<RpcException>();
        ex.Which.StatusCode.Should().Be(StatusCode.Unauthenticated);
    }

    [Fact]
    public async Task Logout_revokes_refresh_token()
    {
        var login = await _client.LoginAsync(new LoginRequest
        {
            Login = DataSeeder.DefaultAdminEmail,
            Password = DataSeeder.DefaultAdminPassword,
        });

        await _client.LogoutAsync(new LogoutRequest { RefreshToken = login.RefreshToken });

        Func<Task> act = async () => await _client.RefreshTokenAsync(new RefreshTokenRequest
        {
            RefreshToken = login.RefreshToken,
        });

        var ex = await act.Should().ThrowAsync<RpcException>();
        ex.Which.StatusCode.Should().Be(StatusCode.Unauthenticated);
    }

    [Fact]
    public async Task ValidateToken_returns_profile_for_valid_access_token()
    {
        var login = await _client.LoginAsync(new LoginRequest
        {
            Login = DataSeeder.DefaultAdminEmail,
            Password = DataSeeder.DefaultAdminPassword,
        });

        var result = await _client.ValidateTokenAsync(new ValidateTokenRequest
        {
            AccessToken = login.AccessToken,
        });

        result.Valid.Should().BeTrue();
        result.User.Email.Should().Be(DataSeeder.DefaultAdminEmail);
    }

    [Fact]
    public async Task ValidateToken_returns_invalid_for_garbage_token()
    {
        var result = await _client.ValidateTokenAsync(new ValidateTokenRequest
        {
            AccessToken = "not-a-real-jwt",
        });

        result.Valid.Should().BeFalse();
        result.Error.Should().NotBeNullOrWhiteSpace();
    }
}
