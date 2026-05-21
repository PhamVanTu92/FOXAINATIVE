using MediatR;
using SystemService.Application.Abstractions.Persistence;
using SystemService.Application.Features.Roles.Dtos;
using SystemService.Application.Features.Roles.Mappings;
using SystemService.Domain.Exceptions;

namespace SystemService.Application.Features.Roles.GetRole;

public sealed class GetRoleQueryHandler(IRoleRepository roles) : IRequestHandler<GetRoleQuery, RoleDto>
{
    public async Task<RoleDto> Handle(GetRoleQuery request, CancellationToken cancellationToken)
    {
        var role = await roles.FindByIdWithPermissionsAsync(request.Id, cancellationToken)
                   ?? throw new NotFoundException("Role", request.Id);
        return role.ToDto();
    }
}
