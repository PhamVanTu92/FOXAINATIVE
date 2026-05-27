using SystemService.Domain.Entities;

namespace SystemService.Application.Abstractions.Persistence;

public interface IOrganizationRepository
{
    Task<OrganizationNode?> FindByIdAsync(Guid id, CancellationToken ct = default);

    Task<OrganizationNode?> FindByCodeAsync(string code, CancellationToken ct = default);

    Task<bool> CodeExistsAsync(string code, CancellationToken ct = default);

    Task<bool> HasChildrenAsync(Guid nodeId, CancellationToken ct = default);

    Task<bool> HasUsersAsync(Guid nodeId, CancellationToken ct = default);

    Task<IReadOnlyList<OrganizationNode>> GetTreeAsync(Guid? rootId, CancellationToken ct = default);

    Task<(IReadOnlyList<OrganizationNode> Items, long Total)> SearchAsync(
        int page,
        int pageSize,
        string? search,
        CancellationToken ct = default);

    Task<IReadOnlyList<OrganizationNode>> GetDescendantsAsync(string pathPrefix, CancellationToken ct = default);

    void Add(OrganizationNode node);

    void Remove(OrganizationNode node);
}
