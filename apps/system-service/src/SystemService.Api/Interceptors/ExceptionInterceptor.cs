using FluentValidation;
using Grpc.Core;
using Grpc.Core.Interceptors;
using SystemService.Domain.Exceptions;

namespace SystemService.Api.Interceptors;

public sealed class ExceptionInterceptor(ILogger<ExceptionInterceptor> logger) : Interceptor
{
    public override async Task<TResponse> UnaryServerHandler<TRequest, TResponse>(
        TRequest request,
        ServerCallContext context,
        UnaryServerMethod<TRequest, TResponse> continuation)
    {
        try
        {
            return await continuation(request, context);
        }
        catch (RpcException)
        {
            throw;
        }
        catch (ValidationException ex)
        {
            // gRPC metadata text values phải là ASCII. Error messages có thể chứa tiếng Việt
            // (non-ASCII) → đẩy vào status detail message (UTF-8 OK) thay vì metadata.
            // Nếu cần truyền structured field errors về client, encode base64 vào metadata `-bin`.
            var details = string.Join(
                "; ",
                ex.Errors.Select(e => $"{e.PropertyName}: {e.ErrorMessage}"));

            var metadata = new Metadata();
            foreach (var failure in ex.Errors)
            {
                var keyAscii = AsciiOnly(failure.PropertyName).ToLowerInvariant();
                var valueBytes = System.Text.Encoding.UTF8.GetBytes(failure.ErrorMessage);
                metadata.Add($"validation-{keyAscii}-bin", valueBytes);
            }

            throw new RpcException(new Status(StatusCode.InvalidArgument, details), metadata);
        }
        catch (UnauthorizedException ex)
        {
            throw new RpcException(new Status(StatusCode.Unauthenticated, ex.Message));
        }
        catch (ForbiddenException ex)
        {
            throw new RpcException(new Status(StatusCode.PermissionDenied, ex.Message));
        }
        catch (NotFoundException ex)
        {
            throw new RpcException(new Status(StatusCode.NotFound, ex.Message));
        }
        catch (EmailAlreadyExistsException ex)
        {
            throw new RpcException(new Status(StatusCode.AlreadyExists, ex.Message));
        }
        catch (CodeAlreadyExistsException ex)
        {
            throw new RpcException(new Status(StatusCode.AlreadyExists, ex.Message));
        }
        catch (CircularOrganizationTreeException ex)
        {
            throw new RpcException(new Status(StatusCode.FailedPrecondition, ex.Message));
        }
        catch (SystemRoleProtectedException ex)
        {
            throw new RpcException(new Status(StatusCode.FailedPrecondition, ex.Message));
        }
        catch (BusinessRuleViolationException ex)
        {
            throw new RpcException(new Status(StatusCode.FailedPrecondition, ex.Message));
        }
        catch (DomainValidationException ex)
        {
            throw new RpcException(new Status(StatusCode.InvalidArgument, ex.Message));
        }
        catch (Exception ex)
        {
            logger.LogError(ex, "Unhandled exception in gRPC call {Method}", context.Method);
            throw new RpcException(new Status(StatusCode.Internal, "Internal server error."));
        }
    }

    private static string AsciiOnly(string input)
    {
        if (string.IsNullOrEmpty(input)) return "field";
        var chars = input.Where(c => (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z')
                                     || (c >= '0' && c <= '9') || c is '-' or '_' or '.').ToArray();
        return chars.Length == 0 ? "field" : new string(chars);
    }
}
