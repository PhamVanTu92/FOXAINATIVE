using SystemService.Domain.Entities;

namespace SystemService.Application.Abstractions.Persistence;

public interface IPermissionActionRepository
{
    Task<PermissionAction?> FindByIdAsync(Guid id, CancellationToken ct = default);

    Task<PermissionAction?> FindByCodeAsync(string code, CancellationToken ct = default);

    Task<bool> CodeExistsAsync(string code, CancellationToken ct = default);

    Task<IReadOnlyList<PermissionAction>> ListAsync(bool activeOnly, CancellationToken ct = default);

    Task<IReadOnlyList<PermissionAction>> FindByIdsAsync(IEnumerable<Guid> ids, CancellationToken ct = default);

    Task<bool> HasRolePermissionsAsync(Guid actionId, CancellationToken ct = default);

    void Add(PermissionAction action);

    void Remove(PermissionAction action);
}
