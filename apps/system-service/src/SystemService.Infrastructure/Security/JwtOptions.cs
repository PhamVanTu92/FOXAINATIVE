namespace SystemService.Infrastructure.Security;

public sealed class JwtOptions
{
    public const string SectionName = "Jwt";

    public string Secret { get; set; } = string.Empty;
    public string Issuer { get; set; } = "foxai-system-service";
    public string Audience { get; set; } = "foxai-platform";
    public string ExpiresIn { get; set; } = "7d";
    public int RefreshTokenDays { get; set; } = 30;

    public TimeSpan ParseAccessTokenLifetime()
    {
        if (string.IsNullOrWhiteSpace(ExpiresIn))
        {
            return TimeSpan.FromDays(7);
        }

        var raw = ExpiresIn.Trim().ToLowerInvariant();
        var suffix = raw[^1];

        if (char.IsDigit(suffix))
        {
            return TimeSpan.FromSeconds(int.Parse(raw, System.Globalization.CultureInfo.InvariantCulture));
        }

        var numericPart = raw[..^1];
        if (!int.TryParse(numericPart, System.Globalization.NumberStyles.Integer, System.Globalization.CultureInfo.InvariantCulture, out var value))
        {
            return TimeSpan.FromDays(7);
        }

        return suffix switch
        {
            's' => TimeSpan.FromSeconds(value),
            'm' => TimeSpan.FromMinutes(value),
            'h' => TimeSpan.FromHours(value),
            'd' => TimeSpan.FromDays(value),
            _ => TimeSpan.FromDays(value),
        };
    }
}
