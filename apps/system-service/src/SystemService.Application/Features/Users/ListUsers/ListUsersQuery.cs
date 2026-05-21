using MediatR;
using SystemService.Application.Common.Models;
using SystemService.Application.Features.Users.Dtos;
using SystemService.Domain.Enums;

namespace SystemService.Application.Features.Users.ListUsers;

public sealed record ListUsersQuery(
    PageRequest Pagination,
    UserStatus? Status,
    Guid? OrganizationId) : IRequest<PagedResult<UserDto>>;
