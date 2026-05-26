using MediatR;
using SystemService.Application.Abstractions.Persistence;
using SystemService.Application.Features.Users.Dtos;
using SystemService.Application.Features.Users.Mappings;
using SystemService.Domain.Exceptions;

namespace SystemService.Application.Features.Users.UpdateUser;

public sealed class UpdateUserCommandHandler(
    IUserRepository users,
    IOrganizationRepository organizations) : IRequestHandler<UpdateUserCommand, UserDto>
{
    public async Task<UserDto> Handle(UpdateUserCommand request, CancellationToken cancellationToken)
    {
        var user = await users.FindByIdWithGrantsAsync(request.Id, cancellationToken)
                   ?? throw new NotFoundException("User", request.Id);

        if (request.FullName is not null)
        {
            user.FullName = request.FullName.Trim();
        }

        if (request.Phone is not null)
        {
            user.Phone = string.IsNullOrWhiteSpace(request.Phone) ? null : request.Phone.Trim();
        }

        if (request.AvatarUrl is not null)
        {
            user.AvatarUrl = string.IsNullOrWhiteSpace(request.AvatarUrl) ? null : request.AvatarUrl.Trim();
        }

        if (request.OrganizationId.HasValue)
        {
            var orgId = request.OrganizationId.Value;
            if (orgId == Guid.Empty)
            {
                user.OrganizationId = null;
            }
            else
            {
                _ = await organizations.FindByIdAsync(orgId, cancellationToken)
                    ?? throw new NotFoundException("OrganizationNode", orgId);
                user.OrganizationId = orgId;
            }
        }

        return user.ToDto();
    }
}
