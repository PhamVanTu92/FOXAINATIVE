using KnowledgeService.Application.Common.Exceptions;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.Mvc.Filters;

namespace KnowledgeService.Api.Filters;

public class AppExceptionFilter : IExceptionFilter
{
    private readonly ILogger<AppExceptionFilter> _logger;

    public AppExceptionFilter(ILogger<AppExceptionFilter> logger) => _logger = logger;

    public void OnException(ExceptionContext context)
    {
        switch (context.Exception)
        {
            case NotFoundException ex:
                _logger.LogWarning(ex, "Not found: {Message}", ex.Message);
                context.Result = new NotFoundObjectResult(new { error = ex.Message });
                break;

            case ConflictException ex:
                _logger.LogWarning(ex, "Conflict: {Message}", ex.Message);
                context.Result = new ConflictObjectResult(new { error = ex.Message });
                break;

            default:
                _logger.LogError(context.Exception, "Unhandled exception");
                context.Result = new ObjectResult(new { error = "Lỗi máy chủ nội bộ." })
                {
                    StatusCode = StatusCodes.Status500InternalServerError
                };
                break;
        }

        context.ExceptionHandled = true;
    }
}
