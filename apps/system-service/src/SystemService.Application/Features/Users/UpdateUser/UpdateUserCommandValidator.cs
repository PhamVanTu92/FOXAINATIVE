using FluentValidation;

namespace SystemService.Application.Features.Users.UpdateUser;

public sealed class UpdateUserCommandValidator : AbstractValidator<UpdateUserCommand>
{
    public UpdateUserCommandValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
        RuleFor(x => x.FullName).MaximumLength(200).When(x => x.FullName is not null);
        RuleFor(x => x.Phone).MaximumLength(50).When(x => x.Phone is not null);
        RuleFor(x => x.AvatarUrl).MaximumLength(500).When(x => x.AvatarUrl is not null);
    }
}
