using MediatR;
using SystemService.Application.Abstractions.Persistence;
using SystemService.Application.Features.Roles.Dtos;
using SystemService.Application.Features.Roles.Mappings;
using SystemService.Domain.Exceptions;

namespace SystemService.Application.Features.Roles.UpdateRole;

public sealed class UpdateRoleCommandHandler(IRoleRepository roles) : IRequestHandler<UpdateRoleCommand, RoleDto>
{
    public async Task<RoleDto> Handle(UpdateRoleCommand request, CancellationToken cancellationToken)
    {
        var role = await roles.FindByIdWithGrantsAsync(request.Id, cancellationToken)
                   ?? throw new NotFoundException("Role", request.Id);

        if (request.Name is not null)
        {
            role.Name = request.Name.Trim();
        }

        if (request.Description is not null)
        {
            role.Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim();
        }

        return role.ToDto();
    }
}
