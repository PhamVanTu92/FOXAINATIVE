using MediatR;
using SystemService.Application.Features.Modules.Dtos;

namespace SystemService.Application.Features.Modules.GetModule;

public sealed record GetModuleQuery(Guid Id) : IRequest<ModuleDto>;
