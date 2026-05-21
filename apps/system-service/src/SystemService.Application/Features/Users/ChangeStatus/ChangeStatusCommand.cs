using SystemService.Application.Common.Markers;
using SystemService.Application.Features.Users.Dtos;
using SystemService.Domain.Enums;

namespace SystemService.Application.Features.Users.ChangeStatus;

public sealed record ChangeStatusCommand(Guid UserId, UserStatus Status) : ITransactionalRequest<UserDto>;
