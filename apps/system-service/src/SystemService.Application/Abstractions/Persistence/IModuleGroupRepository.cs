using SystemService.Domain.Entities;

namespace SystemService.Application.Abstractions.Persistence;

public interface IModuleGroupRepository
{
    Task<ModuleGroup?> FindByIdAsync(Guid id, CancellationToken ct = default);

    Task<ModuleGroup?> FindByCodeAsync(string code, CancellationToken ct = default);

    Task<bool> CodeExistsAsync(string code, CancellationToken ct = default);

    /// <summary>Trả về toàn bộ groups + modules con (eager load) sort theo SortOrder.</summary>
    Task<IReadOnlyList<ModuleGroup>> ListWithModulesAsync(bool activeOnly, CancellationToken ct = default);

    Task<bool> HasModulesAsync(Guid groupId, CancellationToken ct = default);

    void Add(ModuleGroup group);

    void Remove(ModuleGroup group);
}
