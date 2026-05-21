using SystemService.Domain.Entities;

namespace SystemService.Application.Abstractions.Persistence;

public interface IPermissionRepository
{
    Task<Permission?> FindByIdAsync(Guid id, CancellationToken ct = default);

    Task<IReadOnlyList<Permission>> ListAsync(string? module, CancellationToken ct = default);

    Task<IReadOnlyList<Permission>> FindByCodesAsync(IEnumerable<string> codes, CancellationToken ct = default);
}
