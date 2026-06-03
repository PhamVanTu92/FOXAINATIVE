using MediatR;
using SystemService.Application.Features.Stats.Dtos;

namespace SystemService.Application.Features.Stats;

public sealed record GetSystemStatsQuery : IRequest<SystemStatsDto>;
