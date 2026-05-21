using FluentAssertions;
using Foxai.System.V1;
using Grpc.Core;
using SystemService.IntegrationTests.Infrastructure;
using Xunit;

namespace SystemService.IntegrationTests.Roles;

[Collection(PostgresCollection.Name)]
public sealed class RolesCrudTests(PostgresContainerFixture postgres) : IAsyncLifetime
{
    private SystemServiceApplicationFactory _factory = default!;
    private RolesService.RolesServiceClient _roles = default!;

    public Task InitializeAsync()
    {
        _factory = new SystemServiceApplicationFactory(postgres.ConnectionUrl);
        _ = _factory.CreateDefaultClient();
        _roles = new RolesService.RolesServiceClient(GrpcTestClientFactory.CreateChannel(_factory));
        return Task.CompletedTask;
    }

    public Task DisposeAsync()
    {
        _factory.Dispose();
        return Task.CompletedTask;
    }

    [Fact]
    public async Task CreateRole_with_permissions_returns_role_with_permissions()
    {
        var code = $"TEST_ROLE_{Guid.NewGuid():N}".ToUpperInvariant();
        var created = await _roles.CreateRoleAsync(new CreateRoleRequest
        {
            Code = code,
            Name = "Test Role",
            Description = "Vai trò cho test",
            PermissionCodes = { "USER_READ", "ROLE_READ" },
        });

        created.Code.Should().Be(code);
        created.IsSystem.Should().BeFalse();
        created.Permissions.Should().BeEquivalentTo(new[] { "USER_READ", "ROLE_READ" });
    }

    [Fact]
    public async Task CreateRole_invalid_code_returns_InvalidArgument()
    {
        Func<Task> act = async () => await _roles.CreateRoleAsync(new CreateRoleRequest
        {
            Code = "lowercase",
            Name = "Bad",
        });

        (await act.Should().ThrowAsync<RpcException>()).Which.StatusCode.Should().Be(StatusCode.InvalidArgument);
    }

    [Fact]
    public async Task CreateRole_duplicate_code_returns_AlreadyExists()
    {
        var code = $"DUP_ROLE_{Guid.NewGuid():N}".ToUpperInvariant();
        await _roles.CreateRoleAsync(new CreateRoleRequest { Code = code, Name = "A" });

        Func<Task> act = async () => await _roles.CreateRoleAsync(new CreateRoleRequest { Code = code, Name = "B" });
        (await act.Should().ThrowAsync<RpcException>()).Which.StatusCode.Should().Be(StatusCode.AlreadyExists);
    }

    [Fact]
    public async Task DeleteRole_system_role_returns_FailedPrecondition()
    {
        var list = await _roles.ListRolesAsync(new ListRolesRequest
        {
            Pagination = new Foxai.Common.PageRequest { Page = 1, PageSize = 100 },
        });
        var superAdmin = list.Items.Single(r => r.Code == "SUPER_ADMIN");

        Func<Task> act = async () => await _roles.DeleteRoleAsync(new DeleteRoleRequest { Id = superAdmin.Id });
        (await act.Should().ThrowAsync<RpcException>()).Which.StatusCode.Should().Be(StatusCode.FailedPrecondition);
    }

    [Fact]
    public async Task AssignPermissions_then_RevokePermissions_works()
    {
        var code = $"PERM_ROLE_{Guid.NewGuid():N}".ToUpperInvariant();
        var role = await _roles.CreateRoleAsync(new CreateRoleRequest { Code = code, Name = "Perm Test" });

        var afterAssign = await _roles.AssignPermissionsAsync(new AssignPermissionsRequest
        {
            RoleId = role.Id,
            PermissionCodes = { "USER_CREATE", "USER_UPDATE" },
        });
        afterAssign.Permissions.Should().BeEquivalentTo(new[] { "USER_CREATE", "USER_UPDATE" });

        var afterRevoke = await _roles.RevokePermissionsAsync(new RevokePermissionsRequest
        {
            RoleId = role.Id,
            PermissionCodes = { "USER_CREATE" },
        });
        afterRevoke.Permissions.Should().Equal("USER_UPDATE");
    }

    [Fact]
    public async Task RevokePermissions_on_SUPER_ADMIN_returns_FailedPrecondition()
    {
        var list = await _roles.ListRolesAsync(new ListRolesRequest
        {
            Pagination = new Foxai.Common.PageRequest { Page = 1, PageSize = 100 },
        });
        var superAdmin = list.Items.Single(r => r.Code == "SUPER_ADMIN");

        Func<Task> act = async () => await _roles.RevokePermissionsAsync(new RevokePermissionsRequest
        {
            RoleId = superAdmin.Id,
            PermissionCodes = { "SYSTEM_ADMIN" },
        });
        (await act.Should().ThrowAsync<RpcException>()).Which.StatusCode.Should().Be(StatusCode.FailedPrecondition);
    }

    [Fact]
    public async Task ListRoles_includes_seeded_system_roles()
    {
        var list = await _roles.ListRolesAsync(new ListRolesRequest
        {
            Pagination = new Foxai.Common.PageRequest { Page = 1, PageSize = 100 },
            IncludePermissions = true,
        });

        var codes = list.Items.Select(r => r.Code).ToList();
        codes.Should().Contain(new[] { "SUPER_ADMIN", "ADMIN", "USER" });
    }
}
