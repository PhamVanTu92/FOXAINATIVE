using SystemService.Application.Common.Markers;
using SystemService.Application.Features.Modules.Dtos;

namespace SystemService.Application.Features.Modules.UpdateModule;

public sealed record UpdateModuleCommand(
    Guid Id,
    Guid? GroupId,
    string? Name,
    string? Description,
    int? SortOrder,
    bool? IsActive) : ITransactionalRequest<ModuleDto>;
