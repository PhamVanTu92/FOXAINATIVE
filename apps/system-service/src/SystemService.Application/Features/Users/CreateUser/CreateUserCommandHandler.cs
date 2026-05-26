using MediatR;
using SystemService.Application.Abstractions.Persistence;
using SystemService.Application.Abstractions.Security;
using SystemService.Application.Features.Users.Dtos;
using SystemService.Application.Features.Users.Mappings;
using SystemService.Domain.Entities;
using SystemService.Domain.Enums;
using SystemService.Domain.Exceptions;
using SystemService.Domain.ValueObjects;

namespace SystemService.Application.Features.Users.CreateUser;

public sealed class CreateUserCommandHandler(
    IUserRepository users,
    IRoleRepository roles,
    IOrganizationRepository organizations,
    IPasswordHasher hasher) : IRequestHandler<CreateUserCommand, UserDto>
{
    public async Task<UserDto> Handle(CreateUserCommand request, CancellationToken cancellationToken)
    {
        var username = request.Username.Trim().ToLowerInvariant();
        var email = Email.Create(request.Email).Value;

        if (await users.UsernameExistsAsync(username, cancellationToken))
        {
            throw new UsernameAlreadyExistsException(username);
        }

        if (await users.EmailExistsAsync(email, cancellationToken))
        {
            throw new EmailAlreadyExistsException(email);
        }

        if (request.OrganizationId is { } orgId)
        {
            var org = await organizations.FindByIdAsync(orgId, cancellationToken)
                      ?? throw new NotFoundException("OrganizationNode", orgId);
            _ = org;
        }

        var requestedCodes = request.RoleCodes?.Where(c => !string.IsNullOrWhiteSpace(c)).Distinct().ToList()
                             ?? new List<string>();
        IReadOnlyList<Role> resolvedRoles = Array.Empty<Role>();
        if (requestedCodes.Count > 0)
        {
            resolvedRoles = await roles.FindByCodesAsync(requestedCodes, cancellationToken);
            var missing = requestedCodes.Except(resolvedRoles.Select(r => r.Code)).ToList();
            if (missing.Count > 0)
            {
                throw new NotFoundException("Role", string.Join(", ", missing));
            }
        }

        var user = new User
        {
            Id = Guid.NewGuid(),
            Username = username,
            Email = email,
            PasswordHash = hasher.Hash(request.Password),
            FullName = request.FullName.Trim(),
            Phone = string.IsNullOrWhiteSpace(request.Phone) ? null : request.Phone.Trim(),
            Status = UserStatus.Active,
            OrganizationId = request.OrganizationId,
        };

        foreach (var role in resolvedRoles)
        {
            user.UserRoles.Add(new UserRole
            {
                User = user,
                Role = role,
                AssignedAt = DateTime.UtcNow,
            });
        }

        users.Add(user);

        return user.ToDto();
    }
}
