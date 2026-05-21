using MediatR;
using SystemService.Application.Abstractions.Persistence;
using SystemService.Application.Features.Permissions.Dtos;

namespace SystemService.Application.Features.Permissions.ListPermissions;

public sealed class ListPermissionsQueryHandler(IPermissionRepository permissions)
    : IRequestHandler<ListPermissionsQuery, IReadOnlyList<PermissionDto>>
{
    public async Task<IReadOnlyList<PermissionDto>> Handle(ListPermissionsQuery request, CancellationToken cancellationToken)
    {
        var items = await permissions.ListAsync(request.Module, cancellationToken);
        return items
            .Select(p => new PermissionDto(p.Id, p.Code, p.Name, p.Module, p.Action, p.Resource))
            .ToList();
    }
}
