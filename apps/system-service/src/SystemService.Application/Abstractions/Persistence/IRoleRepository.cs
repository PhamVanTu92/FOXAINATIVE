using SystemService.Domain.Entities;

namespace SystemService.Application.Abstractions.Persistence;

public interface IRoleRepository
{
    Task<Role?> FindByIdAsync(Guid id, CancellationToken ct = default);

    /// <summary>Load Role kèm RolePermissions (eager Module + Action navigation).</summary>
    Task<Role?> FindByIdWithGrantsAsync(Guid id, CancellationToken ct = default);

    Task<Role?> FindByCodeAsync(string code, CancellationToken ct = default);

    Task<Role?> FindByCodeWithGrantsAsync(string code, CancellationToken ct = default);

    Task<bool> CodeExistsAsync(string code, CancellationToken ct = default);

    Task<(IReadOnlyList<Role> Items, long Total)> SearchAsync(
        int page,
        int pageSize,
        string? search,
        bool includeGrants,
        string? sortBy,
        string? sortOrder,
        CancellationToken ct = default);

    Task<IReadOnlyList<Role>> FindByCodesAsync(IEnumerable<string> codes, CancellationToken ct = default);

    /// <summary>Trả về set (module_id, action_id) đã được cấp cho role này (lookup nhanh cho grid UI).</summary>
    Task<IReadOnlyList<(Guid ModuleId, Guid ActionId)>> GetGrantPairsAsync(Guid roleId, CancellationToken ct = default);

    void Add(Role role);

    void Remove(Role role);
}
