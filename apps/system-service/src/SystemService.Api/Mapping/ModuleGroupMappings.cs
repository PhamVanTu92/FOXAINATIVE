using SystemService.Application.Features.ModuleGroups.Dtos;
using MgProto = Foxai.System.V1;

namespace SystemService.Api.Mapping;

internal static class ModuleGroupMappings
{
    public static MgProto.ModuleGroupDto ToProto(this ModuleGroupDto dto)
    {
        var msg = new MgProto.ModuleGroupDto
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

        foreach (var m in dto.Modules)
        {
            var summary = new MgProto.ModuleSummaryDto
            {
                Id = m.Id.ToString(),
                Code = m.Code,
                Name = m.Name,
                SortOrder = m.SortOrder,
                IsActive = m.IsActive,
            };
            summary.AllowedActions.AddRange(m.AllowedActions.Select(a => new MgProto.ModuleAllowedActionDto
            {
                Id = a.Id.ToString(),
                Code = a.Code,
                Name = a.Name,
                SortOrder = a.SortOrder,
            }));
            msg.Modules.Add(summary);
        }

        return msg;
    }
}
