using SystemService.Application.Features.Permissions.Dtos;
using PermsProto = Foxai.System.V1;

namespace SystemService.Api.Mapping;

internal static class PermissionMappings
{
    public static PermsProto.PermissionDto ToProto(this PermissionDto dto) => new()
    {
        Id = dto.Id.ToString(),
        Code = dto.Code,
        Name = dto.Name,
        Module = dto.Module,
        Action = dto.Action,
        Resource = dto.Resource,
    };
}
