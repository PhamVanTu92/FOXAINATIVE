using MediatR;
using SystemService.Application.Abstractions.Persistence;
using SystemService.Application.Features.Users.Dtos;
using SystemService.Application.Features.Users.Mappings;
using SystemService.Domain.Exceptions;

namespace SystemService.Application.Features.Users.GetUserById;

public sealed class GetUserByIdQueryHandler(IUserRepository users) : IRequestHandler<GetUserByIdQuery, UserDto>
{
    public async Task<UserDto> Handle(GetUserByIdQuery request, CancellationToken cancellationToken)
    {
        var user = await users.FindByIdWithRolesAndPermissionsAsync(request.Id, cancellationToken)
                   ?? throw new NotFoundException("User", request.Id);
        return user.ToDto();
    }
}
