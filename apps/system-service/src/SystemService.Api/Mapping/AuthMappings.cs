using Foxai.Common;
using SystemService.Application.Features.Auth.Dtos;
using AuthProto = Foxai.System.V1;

namespace SystemService.Api.Mapping;

internal static class AuthMappings
{
    public static AuthProto.UserProfile ToProto(this UserProfileDto dto)
    {
        var profile = new AuthProto.UserProfile
        {
            Id = dto.Id.ToString(),
            Email = dto.Email,
            FullName = dto.FullName,
        };
        profile.Roles.AddRange(dto.Roles);
        profile.Permissions.AddRange(dto.Permissions);
        if (dto.OrganizationId is not null)
        {
            profile.OrganizationId = dto.OrganizationId.Value.ToString();
        }
        return profile;
    }

    public static AuthProto.LoginResponse ToProto(this LoginResponse dto) => new()
    {
        AccessToken = dto.AccessToken,
        RefreshToken = dto.RefreshToken,
        ExpiresIn = dto.ExpiresIn,
        User = dto.User.ToProto(),
    };

    public static EmptyResponse Empty() => new();
}
