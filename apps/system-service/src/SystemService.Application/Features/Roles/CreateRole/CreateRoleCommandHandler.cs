using System.Globalization;
using System.Text;
using MediatR;
using SystemService.Application.Abstractions.Persistence;
using SystemService.Application.Features.Roles.Dtos;
using SystemService.Application.Features.Roles.Mappings;
using SystemService.Domain.Entities;
using SystemService.Domain.Exceptions;

namespace SystemService.Application.Features.Roles.CreateRole;

public sealed class CreateRoleCommandHandler(IRoleRepository roles)
    : IRequestHandler<CreateRoleCommand, RoleDto>
{
    private const int MaxCodeLength = 64;
    private const int MaxUniquenessAttempts = 100;

    public async Task<RoleDto> Handle(CreateRoleCommand request, CancellationToken cancellationToken)
    {
        var name = request.Name.Trim();

        string code;
        if (string.IsNullOrWhiteSpace(request.Code))
        {
            code = await GenerateUniqueCodeAsync(name, cancellationToken);
        }
        else
        {
            code = request.Code.Trim().ToUpperInvariant();
            if (await roles.CodeExistsAsync(code, cancellationToken))
            {
                throw new CodeAlreadyExistsException("Role", code);
            }
        }

        var role = new Role
        {
            Id = Guid.NewGuid(),
            Code = code,
            Name = name,
            Description = string.IsNullOrWhiteSpace(request.Description) ? null : request.Description.Trim(),
            IsSystem = false,
        };

        roles.Add(role);

        // Trả về DTO với Grants rỗng (sau khi tạo, FE gọi AssignPermissions để cấp grant).
        return role.ToDto();
    }

    private async Task<string> GenerateUniqueCodeAsync(string name, CancellationToken ct)
    {
        var baseCode = Slugify(name);
        if (string.IsNullOrEmpty(baseCode))
        {
            baseCode = "ROLE";
        }

        // Reserve room cho suffix "_N" (tối đa _100).
        var maxBaseLen = MaxCodeLength - 4;
        if (baseCode.Length > maxBaseLen)
        {
            baseCode = baseCode[..maxBaseLen];
        }

        if (!await roles.CodeExistsAsync(baseCode, ct))
        {
            return baseCode;
        }

        for (var i = 2; i <= MaxUniquenessAttempts; i++)
        {
            var candidate = $"{baseCode}_{i}";
            if (!await roles.CodeExistsAsync(candidate, ct))
            {
                return candidate;
            }
        }

        throw new DomainValidationException(
            $"Không thể sinh code duy nhất cho role '{name}' sau {MaxUniquenessAttempts} lần thử.");
    }

    private static string Slugify(string input)
    {
        // 1. Normalize NFD và bỏ dấu (đ -> d xử lý riêng vì không phải combining mark).
        var normalized = input.Normalize(NormalizationForm.FormD);
        var sb = new StringBuilder(normalized.Length);
        foreach (var ch in normalized)
        {
            var cat = CharUnicodeInfo.GetUnicodeCategory(ch);
            if (cat == UnicodeCategory.NonSpacingMark) continue;

            // Xử lý đ/Đ tiếng Việt.
            if (ch is 'đ' or 'Đ') { sb.Append('d'); continue; }

            sb.Append(ch);
        }

        // 2. Upper + thay non-alphanumeric thành '_'.
        var ascii = sb.ToString().ToUpperInvariant();
        var result = new StringBuilder(ascii.Length);
        foreach (var ch in ascii)
        {
            if ((ch >= 'A' && ch <= 'Z') || (ch >= '0' && ch <= '9'))
            {
                result.Append(ch);
            }
            else
            {
                result.Append('_');
            }
        }

        // 3. Collapse multiple underscores, trim leading/trailing.
        var collapsed = System.Text.RegularExpressions.Regex.Replace(result.ToString(), "_+", "_").Trim('_');

        // 4. Code phải bắt đầu bằng chữ cái (regex ^[A-Z][A-Z0-9_]*$).
        if (collapsed.Length > 0 && !(collapsed[0] >= 'A' && collapsed[0] <= 'Z'))
        {
            collapsed = "R_" + collapsed;
        }

        return collapsed;
    }
}
