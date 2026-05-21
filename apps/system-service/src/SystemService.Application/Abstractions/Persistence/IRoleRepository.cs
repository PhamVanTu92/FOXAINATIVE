using SystemService.Domain.Entities;

namespace SystemService.Application.Abstractions.Persistence;

public interface IRoleRepository
{
    Task<Role?> FindByIdAsync(Guid id, CancellationToken ct = default);

    Task<Role?> FindByIdWithPermissionsAsync(Guid id, CancellationToken ct = default);

    Task<Role?> FindByCodeAsync(string code, CancellationToken ct = default);

    Task<Role?> FindByCodeWithPermissionsAsync(string code, CancellationToken ct = default);

    Task<bool> CodeExistsAsync(string code, CancellationToken ct = default);

    Task<(IReadOnlyList<Role> Items, long Total)> SearchAsync(
        int page,
        int pageSize,
        string? search,
        bool includePermissions,
        string? sortBy,
        string? sortOrder,
        CancellationToken ct = default);

    Task<IReadOnlyList<Role>> FindByCodesAsync(IEnumerable<string> codes, CancellationToken ct = default);

    void Add(Role role);

    void Remove(Role role);
}
