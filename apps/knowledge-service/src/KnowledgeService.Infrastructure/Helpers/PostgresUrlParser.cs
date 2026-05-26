using System.Text.RegularExpressions;

namespace KnowledgeService.Infrastructure.Helpers;

public static class PostgresUrlParser
{
    private static readonly Regex UrlPattern = new(
        @"^postgresql://(?<user>[^:]+):(?<pass>[^@]+)@(?<host>[^:/]+)(?::(?<port>\d+))?/(?<db>.+)$",
        RegexOptions.Compiled);

    public static string ToNpgsqlConnectionString(string url)
    {
        var m = UrlPattern.Match(url);
        if (!m.Success)
            return url;

        var host = m.Groups["host"].Value;
        var port = m.Groups["port"].Success ? m.Groups["port"].Value : "5432";
        var db = m.Groups["db"].Value;
        var user = m.Groups["user"].Value;
        var pass = m.Groups["pass"].Value;

        return $"Host={host};Port={port};Database={db};Username={user};Password={pass};Pooling=true;MinPoolSize=2;MaxPoolSize=50;";
    }
}
