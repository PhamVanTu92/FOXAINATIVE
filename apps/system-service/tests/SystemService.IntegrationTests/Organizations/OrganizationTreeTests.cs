using FluentAssertions;
using Foxai.System.V1;
using Grpc.Core;
using SystemService.IntegrationTests.Infrastructure;
using Xunit;

namespace SystemService.IntegrationTests.Organizations;

[Collection(PostgresCollection.Name)]
public sealed class OrganizationTreeTests(PostgresContainerFixture postgres) : IAsyncLifetime
{
    private SystemServiceApplicationFactory _factory = default!;
    private OrganizationsService.OrganizationsServiceClient _orgs = default!;
    private UsersService.UsersServiceClient _users = default!;

    public Task InitializeAsync()
    {
        _factory = new SystemServiceApplicationFactory(postgres.ConnectionUrl);
        _ = _factory.CreateDefaultClient();
        var channel = GrpcTestClientFactory.CreateChannel(_factory);
        _orgs = new OrganizationsService.OrganizationsServiceClient(channel);
        _users = new UsersService.UsersServiceClient(channel);
        return Task.CompletedTask;
    }

    public Task DisposeAsync()
    {
        _factory.Dispose();
        return Task.CompletedTask;
    }

    [Fact]
    public async Task CreateNode_root_then_child_sets_level_and_path_correctly()
    {
        var rootCode = $"root-{Guid.NewGuid():N}";
        var root = await _orgs.CreateNodeAsync(new CreateNodeRequest { Code = rootCode, Name = "Root" });
        root.Level.Should().Be(0);
        root.Path.Should().Be("/" + rootCode);
        root.ParentId.Should().BeNullOrEmpty();

        var childCode = $"child-{Guid.NewGuid():N}";
        var child = await _orgs.CreateNodeAsync(new CreateNodeRequest
        {
            Code = childCode,
            Name = "Child",
            ParentId = root.Id,
        });
        child.Level.Should().Be(1);
        child.Path.Should().Be($"/{rootCode}/{childCode}");
        child.ParentId.Should().Be(root.Id);
    }

    [Fact]
    public async Task CreateNode_with_invalid_code_returns_InvalidArgument()
    {
        Func<Task> act = async () => await _orgs.CreateNodeAsync(new CreateNodeRequest
        {
            Code = "_invalid",
            Name = "Bad",
        });

        (await act.Should().ThrowAsync<RpcException>()).Which.StatusCode.Should().Be(StatusCode.InvalidArgument);
    }

    [Fact]
    public async Task CreateNode_duplicate_code_returns_AlreadyExists()
    {
        var code = $"dup-{Guid.NewGuid():N}";
        await _orgs.CreateNodeAsync(new CreateNodeRequest { Code = code, Name = "A" });

        Func<Task> act = async () => await _orgs.CreateNodeAsync(new CreateNodeRequest { Code = code, Name = "B" });
        (await act.Should().ThrowAsync<RpcException>()).Which.StatusCode.Should().Be(StatusCode.AlreadyExists);
    }

    [Fact]
    public async Task GetTree_returns_nested_structure()
    {
        var rCode = $"tr-{Guid.NewGuid():N}";
        var root = await _orgs.CreateNodeAsync(new CreateNodeRequest { Code = rCode, Name = "TreeRoot" });
        var c1 = await _orgs.CreateNodeAsync(new CreateNodeRequest { Code = $"tr-c1-{Guid.NewGuid():N}", Name = "C1", ParentId = root.Id });
        var c2 = await _orgs.CreateNodeAsync(new CreateNodeRequest { Code = $"tr-c2-{Guid.NewGuid():N}", Name = "C2", ParentId = root.Id });
        var c11 = await _orgs.CreateNodeAsync(new CreateNodeRequest { Code = $"tr-c11-{Guid.NewGuid():N}", Name = "C1.1", ParentId = c1.Id });

        var tree = await _orgs.GetTreeAsync(new GetTreeRequest { RootId = root.Id });

        tree.Nodes.Should().HaveCount(1);
        var rootDto = tree.Nodes[0];
        rootDto.Id.Should().Be(root.Id);
        rootDto.Children.Should().HaveCount(2);
        var c1Dto = rootDto.Children.Single(c => c.Id == c1.Id);
        c1Dto.Children.Should().HaveCount(1);
        c1Dto.Children[0].Id.Should().Be(c11.Id);
    }

    [Fact]
    public async Task MoveNode_into_descendant_returns_FailedPrecondition()
    {
        var rCode = $"mv-{Guid.NewGuid():N}";
        var root = await _orgs.CreateNodeAsync(new CreateNodeRequest { Code = rCode, Name = "MvRoot" });
        var child = await _orgs.CreateNodeAsync(new CreateNodeRequest { Code = $"mv-c-{Guid.NewGuid():N}", Name = "Child", ParentId = root.Id });
        var grand = await _orgs.CreateNodeAsync(new CreateNodeRequest { Code = $"mv-g-{Guid.NewGuid():N}", Name = "Grand", ParentId = child.Id });

        Func<Task> act = async () => await _orgs.MoveNodeAsync(new MoveNodeRequest
        {
            Id = root.Id,
            NewParentId = grand.Id,
        });

        (await act.Should().ThrowAsync<RpcException>()).Which.StatusCode.Should().Be(StatusCode.FailedPrecondition);
    }

    [Fact]
    public async Task MoveNode_to_another_parent_recomputes_path_and_level()
    {
        var rA = await _orgs.CreateNodeAsync(new CreateNodeRequest { Code = $"ma-{Guid.NewGuid():N}", Name = "A" });
        var rB = await _orgs.CreateNodeAsync(new CreateNodeRequest { Code = $"mb-{Guid.NewGuid():N}", Name = "B" });
        var leaf = await _orgs.CreateNodeAsync(new CreateNodeRequest { Code = $"ml-{Guid.NewGuid():N}", Name = "Leaf", ParentId = rA.Id });

        var moved = await _orgs.MoveNodeAsync(new MoveNodeRequest { Id = leaf.Id, NewParentId = rB.Id });

        moved.ParentId.Should().Be(rB.Id);
        moved.Level.Should().Be(1);
        moved.Path.Should().Be($"{rB.Path}/{leaf.Code}");
    }

    [Fact]
    public async Task DeleteNode_with_children_returns_FailedPrecondition()
    {
        var root = await _orgs.CreateNodeAsync(new CreateNodeRequest { Code = $"dr-{Guid.NewGuid():N}", Name = "D" });
        await _orgs.CreateNodeAsync(new CreateNodeRequest { Code = $"dc-{Guid.NewGuid():N}", Name = "DC", ParentId = root.Id });

        Func<Task> act = async () => await _orgs.DeleteNodeAsync(new DeleteNodeRequest { Id = root.Id });
        (await act.Should().ThrowAsync<RpcException>()).Which.StatusCode.Should().Be(StatusCode.FailedPrecondition);
    }

    [Fact]
    public async Task DeleteNode_leaf_succeeds_and_GetNode_returns_NotFound()
    {
        var leaf = await _orgs.CreateNodeAsync(new CreateNodeRequest { Code = $"leaf-{Guid.NewGuid():N}", Name = "Leaf" });
        await _orgs.DeleteNodeAsync(new DeleteNodeRequest { Id = leaf.Id });

        Func<Task> act = async () => await _orgs.GetNodeAsync(new GetNodeRequest { Id = leaf.Id });
        (await act.Should().ThrowAsync<RpcException>()).Which.StatusCode.Should().Be(StatusCode.NotFound);
    }

    [Fact]
    public async Task ListUsersByOrg_with_includeSubOrgs_returns_users_from_subtree()
    {
        var rootCode = $"lu-{Guid.NewGuid():N}";
        var root = await _orgs.CreateNodeAsync(new CreateNodeRequest { Code = rootCode, Name = "ListRoot" });
        var child = await _orgs.CreateNodeAsync(new CreateNodeRequest { Code = $"luc-{Guid.NewGuid():N}", Name = "ListChild", ParentId = root.Id });

        await _users.CreateUserAsync(new CreateUserRequest
        {
            Email = $"lu-1-{Guid.NewGuid():N}@foxai.local",
            Password = "Test@12345",
            FullName = "User in root",
            OrganizationId = root.Id,
        });
        await _users.CreateUserAsync(new CreateUserRequest
        {
            Email = $"lu-2-{Guid.NewGuid():N}@foxai.local",
            Password = "Test@12345",
            FullName = "User in child",
            OrganizationId = child.Id,
        });

        var rootOnly = await _orgs.ListUsersByOrgAsync(new ListUsersByOrgRequest
        {
            OrganizationId = root.Id,
            Pagination = new Foxai.Common.PageRequest { Page = 1, PageSize = 50 },
            IncludeSubOrgs = false,
        });
        rootOnly.Page.TotalItems.Should().Be(1);

        var withSubs = await _orgs.ListUsersByOrgAsync(new ListUsersByOrgRequest
        {
            OrganizationId = root.Id,
            Pagination = new Foxai.Common.PageRequest { Page = 1, PageSize = 50 },
            IncludeSubOrgs = true,
        });
        withSubs.Page.TotalItems.Should().Be(2);
    }
}
