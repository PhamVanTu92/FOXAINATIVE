using FluentValidation;

namespace SystemService.Application.Features.Organizations.CreateNode;

public sealed class CreateNodeCommandValidator : AbstractValidator<CreateNodeCommand>
{
    public CreateNodeCommandValidator()
    {
        RuleFor(x => x.Code)
            .NotEmpty()
            .MaximumLength(64)
            .Matches(@"^[A-Za-z][A-Za-z0-9_-]*$").WithMessage("Code chỉ chứa chữ/số/_/-, bắt đầu bằng chữ.");

        RuleFor(x => x.Name)
            .NotEmpty()
            .MaximumLength(200);
    }
}
