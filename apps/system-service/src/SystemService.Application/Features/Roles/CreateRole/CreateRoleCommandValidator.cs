using FluentValidation;

namespace SystemService.Application.Features.Roles.CreateRole;

public sealed class CreateRoleCommandValidator : AbstractValidator<CreateRoleCommand>
{
    public CreateRoleCommandValidator()
    {
        // Code optional: nếu truyền vào phải đúng format; nếu null/empty -> handler tự sinh từ Name.
        RuleFor(x => x.Code!)
            .MaximumLength(64)
            .Matches(@"^[A-Z][A-Z0-9_]*$").WithMessage("Code phải dùng UPPER_SNAKE_CASE.")
            .When(x => !string.IsNullOrWhiteSpace(x.Code));

        RuleFor(x => x.Name)
            .NotEmpty()
            .MaximumLength(100);

        RuleFor(x => x.Description)
            .MaximumLength(500)
            .When(x => x.Description is not null);
    }
}
