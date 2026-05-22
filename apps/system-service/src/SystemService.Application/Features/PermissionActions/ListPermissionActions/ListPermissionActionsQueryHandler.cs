using MediatR;
using SystemService.Application.Abstractions.Persistence;
using SystemService.Application.Features.PermissionActions.Dtos;
using SystemService.Application.Features.PermissionActions.Mappings;

namespace SystemService.Application.Features.PermissionActions.ListPermissionActions;

public sealed class ListPermissionActionsQueryHandler(IPermissionActionRepository actions)
    : IRequestHandler<ListPermissionActionsQuery, IReadOnlyList<PermissionActionDto>>
{
    public async Task<IReadOnlyList<PermissionActionDto>> Handle(
        ListPermissionActionsQuery request, CancellationToken cancellationToken)
    {
        var items = await actions.ListAsync(request.ActiveOnly, cancellationToken);
        return items.Select(a => a.ToDto()).ToList();
    }
}
