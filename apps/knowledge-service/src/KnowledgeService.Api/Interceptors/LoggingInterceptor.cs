using Grpc.Core;
using Grpc.Core.Interceptors;
using Microsoft.Extensions.Logging;

namespace KnowledgeService.Api.Interceptors;

public class LoggingInterceptor : Interceptor
{
    private readonly ILogger<LoggingInterceptor> _logger;
    public LoggingInterceptor(ILogger<LoggingInterceptor> logger) => _logger = logger;

    public override async Task<TResponse> UnaryServerHandler<TRequest, TResponse>(
        TRequest request,
        ServerCallContext context,
        UnaryServerMethod<TRequest, TResponse> continuation)
    {
        _logger.LogInformation("gRPC {Method} called", context.Method);
        var response = await continuation(request, context);
        _logger.LogInformation("gRPC {Method} completed", context.Method);
        return response;
    }
}
