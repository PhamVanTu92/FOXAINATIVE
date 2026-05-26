using MediatR;
using SystemService.Application.Features.Organizations.Dtos;

namespace SystemService.Application.Features.Organizations.GetTree;

public sealed record GetTreeQuery(Guid? RootId) : IRequest<IReadOnlyList<OrganizationNodeDto>>;
