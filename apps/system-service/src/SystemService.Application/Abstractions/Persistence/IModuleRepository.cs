using SystemService.Domain.Entities;

namespace SystemService.Application.Abstractions.Persistence;

public interface IModuleRepository
{
    Task<Module?> FindByIdAsync(Guid id, CancellationToken ct = default);

    Task<Module?> FindByCodeAsync(string code, CancellationToken ct = default);

    Task<bool> CodeExistsAsync(string code, CancellationToken ct = default);

    Task<IReadOnlyList<Module>> ListAsync(Guid? groupId, bool activeOnly, CancellationToken ct = default);

    Task<IReadOnlyList<Module>> FindByIdsAsync(IEnumerable<Guid> ids, CancellationToken ct = default);

    Task<bool> HasRolePermissionsAsync(Guid moduleId, CancellationToken ct = default);

    void Add(Module module);

    void Remove(Module module);
}
