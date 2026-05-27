using SystemService.Application.Features.PermissionActions.Dtos;
using SystemService.Domain.Entities;

namespace SystemService.Application.Features.PermissionActions.Mappings;

internal static class PermissionActionDtoMapping
{
    public static PermissionActionDto ToDto(this PermissionAction a) => new(
        Id: a.Id,
        Code: a.Code,
        Name: a.Name,
        Description: a.Description,
        SortOrder: a.SortOrder,
        IsActive: a.IsActive,
        CreatedAt: a.CreatedAt,
        UpdatedAt: a.UpdatedAt);
}
