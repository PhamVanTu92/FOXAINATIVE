using MediatR;
using SystemService.Application.Abstractions.Persistence;
using SystemService.Application.Features.ModuleGroups.Dtos;
using SystemService.Application.Features.ModuleGroups.Mappings;

namespace SystemService.Application.Features.ModuleGroups.ListModuleGroups;

public sealed class ListModuleGroupsQueryHandler(IModuleGroupRepository groups)
    : IRequestHandler<ListModuleGroupsQuery, IReadOnlyList<ModuleGroupDto>>
{
    public async Task<IReadOnlyList<ModuleGroupDto>> Handle(ListModuleGroupsQuery request, CancellationToken cancellationToken)
    {
        var items = await groups.ListWithModulesAsync(request.ActiveOnly, cancellationToken);
        return items.Select(g => g.ToDto()).ToList();
    }
}
