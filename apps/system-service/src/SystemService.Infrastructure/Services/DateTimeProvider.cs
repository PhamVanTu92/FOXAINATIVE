using SystemService.Application.Abstractions.Clock;

namespace SystemService.Infrastructure.Services;

public sealed class DateTimeProvider : IDateTimeProvider
{
    public DateTime UtcNow => DateTime.UtcNow;
}
