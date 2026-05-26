using System.Web;

namespace SystemService.Infrastructure.Helpers;

public static class PostgresUrlParser
{
    public static string ToNpgsqlConnectionString(string url)
    {
        if (string.IsNullOrWhiteSpace(url))
        {
            throw new ArgumentException("Connection URL cannot be empty.", nameof(url));
        }

        if (LooksLikeKeyValueFormat(url))
        {
            return url;
        }

        var uri = new Uri(url);
        if (uri.Scheme is not ("postgres" or "postgresql"))
        {
            throw new ArgumentException($"Unsupported scheme '{uri.Scheme}'. Expected 'postgres' or 'postgresql'.", nameof(url));
        }

        var userInfo = uri.UserInfo.Split(':', 2);
        var username = HttpUtility.UrlDecode(userInfo[0]);
        var password = userInfo.Length > 1 ? HttpUtility.UrlDecode(userInfo[1]) : string.Empty;

        var host = uri.Host;
        var port = uri.IsDefaultPort ? 5432 : uri.Port;
        var database = uri.AbsolutePath.TrimStart('/');

        var parts = new List<string>
        {
            $"Host={host}",
            $"Port={port}",
            $"Username={username}",
            $"Password={password}",
            $"Database={database}",
        };

        var query = HttpUtility.ParseQueryString(uri.Query);
        foreach (var key in query.AllKeys)
        {
            if (key is null) continue;
            var value = query[key];
            if (string.IsNullOrEmpty(value)) continue;

            var mapped = MapQueryKey(key);
            if (mapped is not null)
            {
                parts.Add($"{mapped}={value}");
            }
        }

        return string.Join(';', parts);
    }

    private static bool LooksLikeKeyValueFormat(string s) =>
        s.Contains('=', StringComparison.Ordinal) &&
        !s.StartsWith("postgres://", StringComparison.OrdinalIgnoreCase) &&
        !s.StartsWith("postgresql://", StringComparison.OrdinalIgnoreCase);

    private static string? MapQueryKey(string key) => key.ToLowerInvariant() switch
    {
        "sslmode" => "SSL Mode",
        "schema" => "Search Path",
        "application_name" => "Application Name",
        "connect_timeout" => "Timeout",
        _ => null,
    };
}
