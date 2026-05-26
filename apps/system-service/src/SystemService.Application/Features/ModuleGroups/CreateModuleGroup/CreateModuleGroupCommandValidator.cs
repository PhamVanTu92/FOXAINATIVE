using FluentValidation;

namespace SystemService.Application.Features.ModuleGroups.CreateModuleGroup;

public sealed class CreateModuleGroupCommandValidator : AbstractValidator<CreateModuleGroupCommand>
{
    public CreateModuleGroupCommandValidator()
    {
        RuleFor(x => x.Code)
            .NotEmpty()
            .MaximumLength(64)
            .Matches(@"^[A-Z][A-Z0-9_]*$").WithMessage("Code phải UPPER_SNAKE_CASE.");

        RuleFor(x => x.Name).NotEmpty().MaximumLength(200);
        RuleFor(x => x.Description).MaximumLength(500).When(x => x.Description is not null);
        RuleFor(x => x.SortOrder).GreaterThanOrEqualTo(0);
    }
}
