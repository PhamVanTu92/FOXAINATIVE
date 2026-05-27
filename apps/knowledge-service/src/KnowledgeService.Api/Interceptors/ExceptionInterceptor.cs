using Grpc.Core;
using Grpc.Core.Interceptors;
using KnowledgeService.Application.Common.Exceptions;
using Microsoft.Extensions.Logging;

namespace KnowledgeService.Api.Interceptors;

public class ExceptionInterceptor : Interceptor
{
    private readonly ILogger<ExceptionInterceptor> _logger;
    public ExceptionInterceptor(ILogger<ExceptionInterceptor> logger) => _logger = logger;

    public override async Task<TResponse> UnaryServerHandler<TRequest, TResponse>(
        TRequest request,
        ServerCallContext context,
        UnaryServerMethod<TRequest, TResponse> continuation)
    {
        try
        {
            return await continuation(request, context);
        }
        catch (NotFoundException ex)
        {
            throw new RpcException(new Status(StatusCode.NotFound, ex.Message));
        }
        catch (ConflictException ex)
        {
            throw new RpcException(new Status(StatusCode.AlreadyExists, ex.Message));
        }
        catch (FluentValidation.ValidationException ex)
        {
            var errors = string.Join("; ", ex.Errors.Select(e => e.ErrorMessage));
            throw new RpcException(new Status(StatusCode.InvalidArgument, errors));
        }
        catch (InvalidOperationException ex)
        {
            // Vi phạm quy tắc nghiệp vụ (vd: sai trạng thái) → 422 Unprocessable Entity
            throw new RpcException(new Status(StatusCode.FailedPrecondition, ex.Message));
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unhandled exception in gRPC method {Method}", context.Method);
            throw new RpcException(new Status(StatusCode.Internal, "Lỗi hệ thống nội bộ."));
        }
    }
}
