using SystemService.Application.Common.Markers;

namespace SystemService.Application.Features.Users.ChangePassword;

public sealed record ChangePasswordCommand(
    Guid UserId,
    string OldPassword,
    string NewPassword) : ITransactionalRequest<bool>;
