using FluentAssertions;
using Foxai.System.V1;
using Grpc.Core;
using SystemService.IntegrationTests.Infrastructure;
using Xunit;
using DataSeeder = SystemService.Infrastructure.Persistence.Seeding.DataSeeder;

namespace SystemService.IntegrationTests.Users;

[Collection(PostgresCollection.Name)]
public sealed class UserCrudTests(PostgresContainerFixture postgres) : IAsyncLifetime
{
    private SystemServiceApplicationFactory _factory = default!;
    private UsersService.UsersServiceClient _users = default!;
    private AuthService.AuthServiceClient _auth = default!;

    public Task InitializeAsync()
    {
        _factory = new SystemServiceApplicationFactory(postgres.ConnectionUrl);
        _ = _factory.CreateDefaultClient();
        var channel = GrpcTestClientFactory.CreateChannel(_factory);
        _users = new UsersService.UsersServiceClient(channel);
        _auth = new AuthService.AuthServiceClient(channel);
        return Task.CompletedTask;
    }

    public Task DisposeAsync()
    {
        _factory.Dispose();
        return Task.CompletedTask;
    }

    [Fact]
    public async Task CreateUser_then_GetUser_returns_same_data()
    {
        var email = $"user-{Guid.NewGuid():N}@foxai.local";
        var created = await _users.CreateUserAsync(new CreateUserRequest
        {
            Email = email,
            Password = "Test@12345",
            FullName = "Test User",
            RoleCodes = { "USER" },
        });

        created.Id.Should().NotBeNullOrWhiteSpace();
        created.Email.Should().Be(email);
        created.Status.Should().Be("ACTIVE");
        created.Roles.Should().Contain("USER");

        var fetched = await _users.GetUserAsync(new GetUserRequest { Id = created.Id });
        fetched.Email.Should().Be(email);
        fetched.FullName.Should().Be("Test User");
    }

    [Fact]
    public async Task CreateUser_duplicate_email_returns_AlreadyExists()
    {
        var email = $"dup-{Guid.NewGuid():N}@foxai.local";
        await _users.CreateUserAsync(new CreateUserRequest
        {
            Email = email,
            Password = "Test@12345",
            FullName = "First",
        });

        Func<Task> act = async () => await _users.CreateUserAsync(new CreateUserRequest
        {
            Email = email,
            Password = "Test@12345",
            FullName = "Second",
        });

        var ex = await act.Should().ThrowAsync<RpcException>();
        ex.Which.StatusCode.Should().Be(StatusCode.AlreadyExists);
    }

    [Fact]
    public async Task CreateUser_with_weak_password_returns_InvalidArgument()
    {
        Func<Task> act = async () => await _users.CreateUserAsync(new CreateUserRequest
        {
            Email = $"weak-{Guid.NewGuid():N}@foxai.local",
            Password = "abc",
            FullName = "Weak Pass",
        });

        var ex = await act.Should().ThrowAsync<RpcException>();
        ex.Which.StatusCode.Should().Be(StatusCode.InvalidArgument);
    }

    [Fact]
    public async Task UpdateUser_updates_full_name_and_phone()
    {
        var created = await _users.CreateUserAsync(new CreateUserRequest
        {
            Email = $"upd-{Guid.NewGuid():N}@foxai.local",
            Password = "Test@12345",
            FullName = "Old Name",
        });

        var updated = await _users.UpdateUserAsync(new UpdateUserRequest
        {
            Id = created.Id,
            FullName = "New Name",
            Phone = "+84-901-234-567",
        });

        updated.FullName.Should().Be("New Name");
        updated.Phone.Should().Be("+84-901-234-567");
    }

    [Fact]
    public async Task ListUsers_with_pagination_returns_paged()
    {
        var page = await _users.ListUsersAsync(new ListUsersRequest
        {
            Pagination = new Foxai.Common.PageRequest { Page = 1, PageSize = 10 },
        });

        page.Items.Should().NotBeEmpty();
        page.Page.Page.Should().Be(1);
        page.Page.PageSize.Should().Be(10);
        page.Page.TotalItems.Should().BeGreaterThan(0);
    }

    [Fact]
    public async Task DeleteUser_sets_status_inactive_and_blocks_login()
    {
        var email = $"del-{Guid.NewGuid():N}@foxai.local";
        var created = await _users.CreateUserAsync(new CreateUserRequest
        {
            Email = email,
            Password = "Test@12345",
            FullName = "To Be Deleted",
        });

        await _users.DeleteUserAsync(new DeleteUserRequest { Id = created.Id });

        var fetched = await _users.GetUserAsync(new GetUserRequest { Id = created.Id });
        fetched.Status.Should().Be("INACTIVE");

        Func<Task> loginAct = async () => await _auth.LoginAsync(new LoginRequest
        {
            Email = email,
            Password = "Test@12345",
        });

        var ex = await loginAct.Should().ThrowAsync<RpcException>();
        ex.Which.StatusCode.Should().Be(StatusCode.Unauthenticated);
    }

    [Fact]
    public async Task ChangePassword_works_with_old_password_and_blocks_old_credentials()
    {
        var email = $"pwd-{Guid.NewGuid():N}@foxai.local";
        var created = await _users.CreateUserAsync(new CreateUserRequest
        {
            Email = email,
            Password = "Old@12345",
            FullName = "Pwd Test",
        });

        await _users.ChangePasswordAsync(new ChangePasswordRequest
        {
            UserId = created.Id,
            OldPassword = "Old@12345",
            NewPassword = "New@67890",
        });

        var login = await _auth.LoginAsync(new LoginRequest { Email = email, Password = "New@67890" });
        login.AccessToken.Should().NotBeNullOrEmpty();

        Func<Task> loginOld = async () => await _auth.LoginAsync(new LoginRequest
        {
            Email = email,
            Password = "Old@12345",
        });
        (await loginOld.Should().ThrowAsync<RpcException>()).Which.StatusCode.Should().Be(StatusCode.Unauthenticated);
    }

    [Fact]
    public async Task AssignRole_then_UnassignRole_updates_roles()
    {
        var created = await _users.CreateUserAsync(new CreateUserRequest
        {
            Email = $"role-{Guid.NewGuid():N}@foxai.local",
            Password = "Test@12345",
            FullName = "Role Test",
        });

        await _users.AssignRoleAsync(new AssignRoleRequest
        {
            UserId = created.Id,
            RoleCode = "ADMIN",
        });

        var afterAssign = await _users.GetUserAsync(new GetUserRequest { Id = created.Id });
        afterAssign.Roles.Should().Contain("ADMIN");

        await _users.UnassignRoleAsync(new UnassignRoleRequest
        {
            UserId = created.Id,
            RoleCode = "ADMIN",
        });

        var afterUnassign = await _users.GetUserAsync(new GetUserRequest { Id = created.Id });
        afterUnassign.Roles.Should().NotContain("ADMIN");
    }

    [Fact]
    public async Task UnassignRole_blocks_last_SUPER_ADMIN_removal()
    {
        var admin = await _users.GetUserAsync(new GetUserRequest
        {
            Id = await GetAdminIdAsync(),
        });

        Func<Task> act = async () => await _users.UnassignRoleAsync(new UnassignRoleRequest
        {
            UserId = admin.Id,
            RoleCode = "SUPER_ADMIN",
        });

        var ex = await act.Should().ThrowAsync<RpcException>();
        ex.Which.StatusCode.Should().Be(StatusCode.FailedPrecondition);
    }

    private async Task<string> GetAdminIdAsync()
    {
        var login = await _auth.LoginAsync(new LoginRequest
        {
            Email = DataSeeder.DefaultAdminEmail,
            Password = DataSeeder.DefaultAdminPassword,
        });
        return login.User.Id;
    }

    [Fact]
    public async Task ChangeStatus_LOCKED_revokes_refresh_tokens()
    {
        var email = $"lock-{Guid.NewGuid():N}@foxai.local";
        var created = await _users.CreateUserAsync(new CreateUserRequest
        {
            Email = email,
            Password = "Test@12345",
            FullName = "Lock Test",
        });

        var login = await _auth.LoginAsync(new LoginRequest { Email = email, Password = "Test@12345" });

        await _users.ChangeStatusAsync(new ChangeStatusRequest
        {
            UserId = created.Id,
            Status = "LOCKED",
        });

        Func<Task> refreshAct = async () => await _auth.RefreshTokenAsync(new RefreshTokenRequest
        {
            RefreshToken = login.RefreshToken,
        });

        (await refreshAct.Should().ThrowAsync<RpcException>()).Which.StatusCode.Should().Be(StatusCode.Unauthenticated);
    }
}
