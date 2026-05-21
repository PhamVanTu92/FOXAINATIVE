using SystemService.Application.Features.Roles.Dtos;
using RolesProto = Foxai.System.V1;

namespace SystemService.Api.Mapping;

internal static class RoleMappings
{
    public static RolesProto.RoleDto ToProto(this RoleDto dto)
    {
        var msg = new RolesProto.RoleDto
        {
            Id = dto.Id.ToString(),
            Code = dto.Code,
            Name = dto.Name,
            IsSystem = dto.IsSystem,
            CreatedAt = dto.CreatedAt.ToIso8601(),
            UpdatedAt = dto.UpdatedAt.ToIso8601(),
        };

        if (!string.IsNullOrEmpty(dto.Description)) msg.Description = dto.Description;
        msg.Permissions.AddRange(dto.Permissions);
        return msg;
    }
}
