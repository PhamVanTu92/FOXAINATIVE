using SystemService.Application.Features.Organizations.Dtos;
using OrgProto = Foxai.System.V1;

namespace SystemService.Api.Mapping;

internal static class OrganizationMappings
{
    public static OrgProto.OrganizationNodeDto ToProto(this OrganizationNodeDto dto)
    {
        var msg = new OrgProto.OrganizationNodeDto
        {
            Id = dto.Id.ToString(),
            Code = dto.Code,
            Name = dto.Name,
            Level = dto.Level,
            Path = dto.Path,
            CreatedAt = dto.CreatedAt.ToIso8601(),
            UpdatedAt = dto.UpdatedAt.ToIso8601(),
        };

        if (dto.ParentId is not null) msg.ParentId = dto.ParentId.Value.ToString();
        msg.Children.AddRange(dto.Children.Select(c => c.ToProto()));
        return msg;
    }
}
