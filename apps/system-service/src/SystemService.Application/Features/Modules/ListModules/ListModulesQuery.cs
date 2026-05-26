using MediatR;
using SystemService.Application.Features.Modules.Dtos;

namespace SystemService.Application.Features.Modules.ListModules;

public sealed record ListModulesQuery(Guid? GroupId, bool ActiveOnly) : IRequest<IReadOnlyList<ModuleDto>>;
