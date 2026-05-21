using MediatR;
using SystemService.Application.Features.Organizations.Dtos;

namespace SystemService.Application.Features.Organizations.GetNode;

public sealed record GetNodeQuery(Guid Id) : IRequest<OrganizationNodeDto>;
