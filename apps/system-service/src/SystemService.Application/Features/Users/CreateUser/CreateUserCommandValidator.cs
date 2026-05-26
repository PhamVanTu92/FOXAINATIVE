using FluentValidation;

namespace SystemService.Application.Features.Users.CreateUser;

public sealed class CreateUserCommandValidator : AbstractValidator<CreateUserCommand>
{
    public CreateUserCommandValidator()
    {
        RuleFor(x => x.Username)
            .NotEmpty()
            .MaximumLength(64)
            .Matches(@"^[a-z][a-z0-9._-]*$")
            .WithMessage("Tên đăng nhập phải bắt đầu bằng chữ thường, chỉ chứa chữ thường/số/./_/-.");

        RuleFor(x => x.Email)
            .NotEmpty()
            .EmailAddress()
            .MaximumLength(254);

        RuleFor(x => x.Password)
            .NotEmpty()
            .MinimumLength(8).WithMessage("Mật khẩu phải có ít nhất 8 ký tự.")
            .Matches("[A-Za-z]").WithMessage("Mật khẩu phải có ít nhất một chữ cái.")
            .Matches(@"\d").WithMessage("Mật khẩu phải có ít nhất một chữ số.");

        RuleFor(x => x.FullName)
            .NotEmpty()
            .MaximumLength(200);

        RuleFor(x => x.Phone)
            .MaximumLength(50)
            .When(x => !string.IsNullOrEmpty(x.Phone));
    }
}
