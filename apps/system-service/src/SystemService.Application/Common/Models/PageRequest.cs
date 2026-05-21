namespace SystemService.Application.Common.Models;

public sealed record PageRequest(int Page, int PageSize, string? Search, string? SortBy, string? SortOrder)
{
    public const int DefaultPageSize = 20;
    public const int MaxPageSize = 100;

    public PageRequest Normalize() => new(
        Page <= 0 ? 1 : Page,
        PageSize switch
        {
            <= 0 => DefaultPageSize,
            > MaxPageSize => MaxPageSize,
            _ => PageSize,
        },
        string.IsNullOrWhiteSpace(Search) ? null : Search.Trim(),
        string.IsNullOrWhiteSpace(SortBy) ? null : SortBy.Trim(),
        string.IsNullOrWhiteSpace(SortOrder) ? null : SortOrder.Trim().ToLowerInvariant());
}
