namespace SystemService.Domain.Exceptions;

public abstract class DomainException : Exception
{
    protected DomainException(string message)
        : base(message)
    {
    }

    protected DomainException(string message, Exception innerException)
        : base(message, innerException)
    {
    }
}

public sealed class DomainValidationException : DomainException
{
    public DomainValidationException(string message)
        : base(message)
    {
    }
}

public sealed class NotFoundException : DomainException
{
    public string EntityName { get; }
    public object Key { get; }

    public NotFoundException(string entityName, object key)
        : base($"{entityName} với khóa '{key}' không tồn tại.")
    {
        EntityName = entityName;
        Key = key;
    }
}

public sealed class EmailAlreadyExistsException : DomainException
{
    public string Email { get; }

    public EmailAlreadyExistsException(string email)
        : base($"Email '{email}' đã được sử dụng.")
    {
        Email = email;
    }
}

public sealed class UsernameAlreadyExistsException : DomainException
{
    public string Username { get; }

    public UsernameAlreadyExistsException(string username)
        : base($"Tên đăng nhập '{username}' đã được sử dụng.")
    {
        Username = username;
    }
}

public sealed class CodeAlreadyExistsException : DomainException
{
    public string EntityName { get; }
    public string Code { get; }

    public CodeAlreadyExistsException(string entityName, string code)
        : base($"{entityName} với mã '{code}' đã tồn tại.")
    {
        EntityName = entityName;
        Code = code;
    }
}

public sealed class UnauthorizedException : DomainException
{
    public UnauthorizedException(string message)
        : base(message)
    {
    }
}

public sealed class ForbiddenException : DomainException
{
    public ForbiddenException(string message)
        : base(message)
    {
    }
}

public sealed class CircularOrganizationTreeException : DomainException
{
    public CircularOrganizationTreeException(string message)
        : base(message)
    {
    }
}

public sealed class SystemRoleProtectedException : DomainException
{
    public string RoleCode { get; }

    public SystemRoleProtectedException(string roleCode)
        : base($"Role hệ thống '{roleCode}' không thể sửa hoặc xóa.")
    {
        RoleCode = roleCode;
    }
}

public sealed class BusinessRuleViolationException : DomainException
{
    public BusinessRuleViolationException(string message)
        : base(message)
    {
    }
}
