using FluentValidation;

namespace SystemService.Application.Features.PermissionActions.CreatePermissionAction;

public sealed class CreatePermissionActionCommandValidator : AbstractValidator<CreatePermissionActionCommand>
{
    public CreatePermissionActionCommandValidator()
    {
        RuleFor(x => x.Code)
            .NotEmpty()
            .MaximumLength(32)
            .Matches(@"^[A-Z][A-Z0-9_]*$").WithMessage("Code phải UPPER_SNAKE_CASE.");
        RuleFor(x => x.Name).NotEmpty().MaximumLength(100);
        RuleFor(x => x.Description).MaximumLength(500).When(x => x.Description is not null);
        RuleFor(x => x.SortOrder).GreaterThanOrEqualTo(0);
    }
}
