namespace KnowledgeService.Application.Common.Abstractions;

/// <summary>Cung cấp Authorization token của request hiện tại (Bearer ...). Null nếu không có context.</summary>
public interface ICurrentTokenProvider
{
    string? GetToken();
}
