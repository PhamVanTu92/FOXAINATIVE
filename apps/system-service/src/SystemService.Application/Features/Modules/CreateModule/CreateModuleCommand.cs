using SystemService.Application.Common.Markers;
using SystemService.Application.Features.Modules.Dtos;

namespace SystemService.Application.Features.Modules.CreateModule;

public sealed record CreateModuleCommand(
    Guid GroupId,
    string Code,
    string Name,
    string? Description,
    int SortOrder) : ITransactionalRequest<ModuleDto>;
