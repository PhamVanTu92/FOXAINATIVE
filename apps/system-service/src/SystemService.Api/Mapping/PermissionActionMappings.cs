using SystemService.Application.Features.PermissionActions.Dtos;
using PaProto = Foxai.System.V1;

namespace SystemService.Api.Mapping;

internal static class PermissionActionMappings
{
    public static PaProto.PermissionActionDto ToProto(this PermissionActionDto dto)
    {
        var msg = new PaProto.PermissionActionDto
        {
            Id = dto.Id.ToString(),
            Code = dto.Code,
            Name = dto.Name,
            SortOrder = dto.SortOrder,
            IsActive = dto.IsActive,
            CreatedAt = dto.CreatedAt.ToIso8601(),
            UpdatedAt = dto.UpdatedAt.ToIso8601(),
        };

        if (!string.IsNullOrEmpty(dto.Description)) msg.Description = dto.Description;
        return msg;
    }
}
