using MediatR;
using SystemService.Application.Features.Users.Dtos;

namespace SystemService.Application.Features.Users.GetUserById;

public sealed record GetUserByIdQuery(Guid Id) : IRequest<UserDto>;
