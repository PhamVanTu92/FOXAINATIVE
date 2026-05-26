using MediatR;
using SystemService.Application.Common.Models;
using SystemService.Application.Features.Roles.Dtos;

namespace SystemService.Application.Features.Roles.ListRoles;

public sealed record ListRolesQuery(PageRequest Pagination, bool IncludeGrants) : IRequest<PagedResult<RoleDto>>;
