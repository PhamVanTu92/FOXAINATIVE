using Foxai.Common;
using AppPage = SystemService.Application.Common.Models.PageRequest;
using SystemService.Application.Common.Models;

namespace SystemService.Api.Mapping;

internal static class CommonMappings
{
    public static AppPage ToAppPageRequest(this Foxai.Common.PageRequest? proto)
    {
        if (proto is null)
        {
            return new AppPage(1, AppPage.DefaultPageSize, null, null, null).Normalize();
        }

        return new AppPage(
            proto.Page,
            proto.PageSize,
            proto.Search,
            proto.SortBy,
            proto.SortOrder).Normalize();
    }

    public static PageMetadata ToProtoPage<T>(PagedResult<T> result) => new()
    {
        Page = result.Page,
        PageSize = result.PageSize,
        TotalItems = result.TotalItems,
        TotalPages = result.TotalPages,
    };

    public static PageMetadata ToProtoPage(int page, int pageSize, long totalItems)
    {
        var totalPages = pageSize == 0 ? 0 : (int)Math.Ceiling((double)totalItems / pageSize);
        return new PageMetadata
        {
            Page = page,
            PageSize = pageSize,
            TotalItems = totalItems,
            TotalPages = totalPages,
        };
    }

    public static string ToIso8601(this DateTime value) =>
        value.Kind == DateTimeKind.Unspecified
            ? DateTime.SpecifyKind(value, DateTimeKind.Utc).ToString("O")
            : value.ToUniversalTime().ToString("O");

    public static string? ToIso8601(this DateTime? value) => value?.ToIso8601();
}
