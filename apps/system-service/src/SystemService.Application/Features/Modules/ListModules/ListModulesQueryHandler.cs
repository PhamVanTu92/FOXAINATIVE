using MediatR;
using SystemService.Application.Abstractions.Persistence;
using SystemService.Application.Features.Modules.Dtos;
using SystemService.Application.Features.Modules.Mappings;

namespace SystemService.Application.Features.Modules.ListModules;

public sealed class ListModulesQueryHandler(IModuleRepository modules)
    : IRequestHandler<ListModulesQuery, IReadOnlyList<ModuleDto>>
{
    public async Task<IReadOnlyList<ModuleDto>> Handle(ListModulesQuery request, CancellationToken cancellationToken)
    {
        var items = await modules.ListAsync(request.GroupId, request.ActiveOnly, cancellationToken);
        return items.Select(m => m.ToDto()).ToList();
    }
}
