using SystemService.Application.Common.Markers;

namespace SystemService.Application.Features.Users.DeleteUser;

public sealed record DeleteUserCommand(Guid Id) : ITransactionalRequest<bool>;
