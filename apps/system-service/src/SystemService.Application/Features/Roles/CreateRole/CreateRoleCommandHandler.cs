using MediatR;
using SystemService.Application.Abstractions.Persistence;
using SystemService.Application.Features.Roles.Dtos;
using SystemService.Application.Features.Roles.Mappings;
using SystemService.Domain.Entities;
using SystemService.Domain.Exceptions;

namespace SystemService.Application.Features.Roles.CreateRole;

public sealed class CreateRoleCommandHandler(IRoleRepository roles)
    : IRequestHandler<CreateRoleCommand, RoleDto>
{
    public async Task<RoleDto> Handle(CreateRoleCommand request, CancellationToken cancellationToken)
    {
        var code = request.Code.Trim().ToUpperInvariant();
        if (await roles.CodeExistsAsync(code, cancellationToken))
        {
            throw new CodeAlreadyExistsException("Role", code);
        }

        var role = new Role
        {
            Id = Guid.NewGuid(),
            Code = code,
            Name = request.Name.Trim(),
            Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim(),
            IsSystem = false,
        };

        roles.Add(role);

        // Trả về DTO với Grants rỗng (sau khi tạo, FE gọi AssignPermissions để cấp grant).
        return role.ToDto();
    }
}
