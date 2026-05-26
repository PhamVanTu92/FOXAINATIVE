using System.Text.RegularExpressions;
using SystemService.Domain.Exceptions;

namespace SystemService.Domain.ValueObjects;

public sealed partial record Email
{
    private static readonly Regex Pattern = EmailRegex();

    public string Value { get; }

    private Email(string value)
    {
        Value = value;
    }

    public static Email Create(string value)
    {
        if (string.IsNullOrWhiteSpace(value))
        {
            throw new DomainValidationException("Email không được để trống.");
        }

        var normalized = value.Trim().ToLowerInvariant();
        if (normalized.Length > 254 || !Pattern.IsMatch(normalized))
        {
            throw new DomainValidationException($"Email không hợp lệ: '{value}'.");
        }

        return new Email(normalized);
    }

    public override string ToString() => Value;

    public static implicit operator string(Email email) => email.Value;

    [GeneratedRegex(@"^[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}$", RegexOptions.IgnoreCase)]
    private static partial Regex EmailRegex();
}
