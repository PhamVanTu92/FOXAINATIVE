using MediatR;
using SystemService.Application.Abstractions.Persistence;
using SystemService.Application.Features.ModuleGroups.Dtos;
using SystemService.Application.Features.ModuleGroups.Mappings;
using SystemService.Domain.Exceptions;

namespace SystemService.Application.Features.ModuleGroups.GetModuleGroup;

public sealed class GetModuleGroupQueryHandler(IModuleGroupRepository groups)
    : IRequestHandler<GetModuleGroupQuery, ModuleGroupDto>
{
    public async Task<ModuleGroupDto> Handle(GetModuleGroupQuery request, CancellationToken cancellationToken)
    {
        var group = await groups.FindByIdAsync(request.Id, cancellationToken)
                    ?? throw new NotFoundException("ModuleGroup", request.Id);
        return group.ToDto();
    }
}
