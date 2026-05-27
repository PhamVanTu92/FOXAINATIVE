using SystemService.Application.Features.Modules.Dtos;
using MProto = Foxai.System.V1;

namespace SystemService.Api.Mapping;

internal static class ModuleMappings
{
    public static MProto.ModuleDto ToProto(this ModuleDto dto)
    {
        var msg = new MProto.ModuleDto
        {
            Id = dto.Id.ToString(),
            GroupId = dto.GroupId.ToString(),
            GroupCode = dto.GroupCode,
            GroupName = dto.GroupName,
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
