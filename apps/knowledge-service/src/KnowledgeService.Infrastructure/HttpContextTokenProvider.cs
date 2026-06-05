using KnowledgeService.Application.Common.Abstractions;
using Microsoft.AspNetCore.Http;

namespace KnowledgeService.Infrastructure;

public class HttpContextTokenProvider(IHttpContextAccessor accessor) : ICurrentTokenProvider
{
    public string? GetToken()
    {
        var header = accessor.HttpContext?.Request.Headers.Authorization.ToString();
        return string.IsNullOrEmpty(header) ? null : header;
    }
}
