using SystemService.Application.Features.Users.Dtos;
using SystemService.Domain.Entities;

namespace SystemService.Application.Features.Users.Mappings;

internal static class UserDtoMapping
{
    public static UserDto ToDto(this User user)
    {
        var roles = user.UserRoles?.Select(ur => ur.Role.Code).Distinct().ToArray() ?? Array.Empty<string>();
        return new UserDto(
            Id: user.Id,
            Email: user.Email,
            FullName: user.FullName,
            Phone: user.Phone,
            AvatarUrl: user.AvatarUrl,
            Status: user.Status,
            OrganizationId: user.OrganizationId,
            Roles: roles,
            CreatedAt: user.CreatedAt,
            UpdatedAt: user.UpdatedAt,
            LastLoginAt: user.LastLoginAt);
    }
}
