using SystemService.Application.Features.Users.Dtos;
using SystemService.Domain.Enums;
using UsersProto = Foxai.System.V1;

namespace SystemService.Api.Mapping;

internal static class UserMappings
{
    public static UsersProto.UserDto ToProto(this UserDto dto)
    {
        var msg = new UsersProto.UserDto
        {
            Id = dto.Id.ToString(),
            Email = dto.Email,
            FullName = dto.FullName,
            Status = dto.Status.ToString().ToUpperInvariant(),
            CreatedAt = dto.CreatedAt.ToIso8601(),
            UpdatedAt = dto.UpdatedAt.ToIso8601(),
        };

        if (!string.IsNullOrEmpty(dto.Phone)) msg.Phone = dto.Phone;
        if (!string.IsNullOrEmpty(dto.AvatarUrl)) msg.AvatarUrl = dto.AvatarUrl;
        if (dto.OrganizationId is not null) msg.OrganizationId = dto.OrganizationId.Value.ToString();
        if (dto.LastLoginAt is not null) msg.LastLoginAt = dto.LastLoginAt.Value.ToIso8601();

        msg.Roles.AddRange(dto.Roles);
        return msg;
    }

    public static UserStatus ParseStatusOrThrow(string raw)
    {
        if (string.IsNullOrWhiteSpace(raw))
        {
            throw new ArgumentException("Status is required.", nameof(raw));
        }

        if (!Enum.TryParse<UserStatus>(raw, ignoreCase: true, out var status))
        {
            throw new ArgumentException($"Invalid status '{raw}'. Allowed: ACTIVE, INACTIVE, LOCKED.", nameof(raw));
        }

        return status;
    }
}
