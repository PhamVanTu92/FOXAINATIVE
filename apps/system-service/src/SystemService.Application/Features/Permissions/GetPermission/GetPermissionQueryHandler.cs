using MediatR;
using SystemService.Application.Abstractions.Persistence;
using SystemService.Application.Features.Permissions.Dtos;
using SystemService.Domain.Exceptions;

namespace SystemService.Application.Features.Permissions.GetPermission;

public sealed class GetPermissionQueryHandler(IPermissionRepository permissions)
    : IRequestHandler<GetPermissionQuery, PermissionDto>
{
    public async Task<PermissionDto> Handle(GetPermissionQuery request, CancellationToken cancellationToken)
    {
        var perm = await permissions.FindByIdAsync(request.Id, cancellationToken)
                   ?? throw new NotFoundException("Permission", request.Id);
        return new PermissionDto(perm.Id, perm.Code, perm.Name, perm.Module, perm.Action, perm.Resource);
    }
}
