using MediatR;
using SystemService.Application.Common.Models;
using SystemService.Application.Features.Organizations.Dtos;

namespace SystemService.Application.Features.Organizations.ListNodes;

public sealed record ListNodesQuery(PageRequest Pagination) : IRequest<PagedResult<OrganizationNodeDto>>;
