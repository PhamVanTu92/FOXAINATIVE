using MediatR;
using SystemService.Application.Abstractions.Persistence;
using SystemService.Application.Common.Models;
using SystemService.Application.Features.Users.Dtos;
using SystemService.Application.Features.Users.Mappings;

namespace SystemService.Application.Features.Users.ListUsers;

public sealed class ListUsersQueryHandler(IUserRepository users) : IRequestHandler<ListUsersQuery, PagedResult<UserDto>>
{
    public async Task<PagedResult<UserDto>> Handle(ListUsersQuery request, CancellationToken cancellationToken)
    {
        var p = request.Pagination;
        var (items, total) = await users.SearchAsync(
            p.Page,
            p.PageSize,
            p.Search,
            request.Status,
            request.OrganizationId,
            p.SortBy,
            p.SortOrder,
            cancellationToken);

        return new PagedResult<UserDto>(
            items.Select(u => u.ToDto()).ToList(),
            p.Page,
            p.PageSize,
            total);
    }
}
