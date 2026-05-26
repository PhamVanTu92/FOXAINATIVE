using System.Diagnostics;
using Grpc.Core;
using Grpc.Core.Interceptors;

namespace SystemService.Api.Interceptors;

public sealed class LoggingInterceptor(ILogger<LoggingInterceptor> logger) : Interceptor
{
    public override async Task<TResponse> UnaryServerHandler<TRequest, TResponse>(
        TRequest request,
        ServerCallContext context,
        UnaryServerMethod<TRequest, TResponse> continuation)
    {
        var sw = Stopwatch.StartNew();
        try
        {
            var response = await continuation(request, context);
            sw.Stop();
            logger.LogInformation(
                "[gRPC OK] {Method} completed in {Elapsed}ms",
                context.Method,
                sw.ElapsedMilliseconds);
            return response;
        }
        catch (Exception ex)
        {
            sw.Stop();
            logger.LogWarning(
                "[gRPC FAIL] {Method} after {Elapsed}ms: {Message}",
                context.Method,
                sw.ElapsedMilliseconds,
                ex.Message);
            throw;
        }
    }
}
