using MediatR;
using SystemService.Application.Common.Models;
using SystemService.Application.Features.Users.Dtos;

namespace SystemService.Application.Features.Organizations.ListUsersByOrg;

public sealed record ListUsersByOrgQuery(
    Guid OrganizationId,
    PageRequest Pagination,
    bool IncludeSubOrgs) : IRequest<PagedResult<UserDto>>;
