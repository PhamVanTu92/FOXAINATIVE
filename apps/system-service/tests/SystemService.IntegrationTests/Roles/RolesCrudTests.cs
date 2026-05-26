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
    private ModulesService.ModulesServiceClient _modules = default!;
    private PermissionActionsService.PermissionActionsServiceClient _actions = default!;

    public Task InitializeAsync()
    {
        _factory = new SystemServiceApplicationFactory(postgres.ConnectionUrl);
        _ = _factory.CreateDefaultClient();
        var channel = GrpcTestClientFactory.CreateChannel(_factory);
        _roles = new RolesService.RolesServiceClient(channel);
        _modules = new ModulesService.ModulesServiceClient(channel);
        _actions = new PermissionActionsService.PermissionActionsServiceClient(channel);
        return Task.CompletedTask;
    }

    public Task DisposeAsync()
    {
        _factory.Dispose();
        return Task.CompletedTask;
    }

    [Fact]
    public async Task CreateRole_returns_role_without_grants()
    {
        var code = $"TEST_ROLE_{Guid.NewGuid():N}".ToUpperInvariant();
        var created = await _roles.CreateRoleAsync(new CreateRoleRequest
        {
            Code = code,
            Name = "Test Role",
            Description = "Vai trò cho test",
        });

        created.Code.Should().Be(code);
        created.IsSystem.Should().BeFalse();
        created.Grants.Should().BeEmpty();
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
    public async Task AssignPermissions_then_RevokePermissions_works_on_module_action_pairs()
    {
        var code = $"PERM_ROLE_{Guid.NewGuid():N}".ToUpperInvariant();
        var role = await _roles.CreateRoleAsync(new CreateRoleRequest { Code = code, Name = "Perm Test" });

        // Fetch a couple modules + actions from seed
        var modules = await _modules.ListModulesAsync(new ListModulesRequest { ActiveOnly = true });
        var actions = await _actions.ListPermissionActionsAsync(new ListPermissionActionsRequest { ActiveOnly = true });
        var moduleA = modules.Items.First(m => m.Code == "DASHBOARD");
        var moduleB = modules.Items.First(m => m.Code == "REPORTS");
        var actionRead = actions.Items.First(a => a.Code == "READ");
        var actionExport = actions.Items.First(a => a.Code == "EXPORT");

        var assignReq = new AssignPermissionsRequest { RoleId = role.Id };
        assignReq.Grants.Add(new RolePermissionPair { ModuleId = moduleA.Id, ActionId = actionRead.Id });
        assignReq.Grants.Add(new RolePermissionPair { ModuleId = moduleB.Id, ActionId = actionRead.Id });
        assignReq.Grants.Add(new RolePermissionPair { ModuleId = moduleB.Id, ActionId = actionExport.Id });

        var afterAssign = await _roles.AssignPermissionsAsync(assignReq);
        afterAssign.Grants.Should().HaveCount(3);

        var revokeReq = new RevokePermissionsRequest { RoleId = role.Id };
        revokeReq.Grants.Add(new RolePermissionPair { ModuleId = moduleB.Id, ActionId = actionExport.Id });

        var afterRevoke = await _roles.RevokePermissionsAsync(revokeReq);
        afterRevoke.Grants.Should().HaveCount(2);
        afterRevoke.Grants.Should().NotContain(g => g.ModuleCode == "REPORTS" && g.ActionCode == "EXPORT");
    }

    [Fact]
    public async Task RevokePermissions_on_SUPER_ADMIN_returns_FailedPrecondition()
    {
        var list = await _roles.ListRolesAsync(new ListRolesRequest
        {
            Pagination = new Foxai.Common.PageRequest { Page = 1, PageSize = 100 },
        });
        var superAdmin = list.Items.Single(r => r.Code == "SUPER_ADMIN");

        var req = new RevokePermissionsRequest { RoleId = superAdmin.Id };
        req.Grants.Add(new RolePermissionPair { ModuleId = Guid.NewGuid().ToString(), ActionId = Guid.NewGuid().ToString() });

        Func<Task> act = async () => await _roles.RevokePermissionsAsync(req);
        (await act.Should().ThrowAsync<RpcException>()).Which.StatusCode.Should().Be(StatusCode.FailedPrecondition);
    }

    [Fact]
    public async Task ListRoles_with_includeGrants_returns_seeded_system_roles_with_grants()
    {
        var list = await _roles.ListRolesAsync(new ListRolesRequest
        {
            Pagination = new Foxai.Common.PageRequest { Page = 1, PageSize = 100 },
            IncludeGrants = true,
        });

        var codes = list.Items.Select(r => r.Code).ToList();
        codes.Should().Contain(new[] { "SUPER_ADMIN", "ADMIN", "USER" });

        var superAdmin = list.Items.Single(r => r.Code == "SUPER_ADMIN");
        superAdmin.Grants.Should().NotBeEmpty("SUPER_ADMIN cấp toàn bộ module × action");
    }
}
