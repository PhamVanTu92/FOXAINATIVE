using System.Diagnostics;
using MediatR;
using Microsoft.Extensions.Logging;

namespace SystemService.Application.Common.Behaviors;

public sealed class LoggingBehavior<TRequest, TResponse>(ILogger<LoggingBehavior<TRequest, TResponse>> logger)
    : IPipelineBehavior<TRequest, TResponse>
    where TRequest : notnull
{
    public async Task<TResponse> Handle(
        TRequest request,
        RequestHandlerDelegate<TResponse> next,
        CancellationToken cancellationToken)
    {
        var requestName = typeof(TRequest).Name;
        var stopwatch = Stopwatch.StartNew();

        logger.LogInformation("[REQ ] {RequestName} started", requestName);

        try
        {
            var response = await next();
            stopwatch.Stop();
            logger.LogInformation(
                "[ OK ] {RequestName} completed in {ElapsedMs} ms",
                requestName,
                stopwatch.ElapsedMilliseconds);
            return response;
        }
        catch (Exception ex)
        {
            stopwatch.Stop();
            logger.LogWarning(
                ex,
                "[FAIL] {RequestName} failed in {ElapsedMs} ms: {Message}",
                requestName,
                stopwatch.ElapsedMilliseconds,
                ex.Message);
            throw;
        }
    }
}
