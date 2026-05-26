using MediatR;
using SystemService.Application.Features.ModuleGroups.Dtos;

namespace SystemService.Application.Features.ModuleGroups.GetModuleGroup;

public sealed record GetModuleGroupQuery(Guid Id) : IRequest<ModuleGroupDto>;
