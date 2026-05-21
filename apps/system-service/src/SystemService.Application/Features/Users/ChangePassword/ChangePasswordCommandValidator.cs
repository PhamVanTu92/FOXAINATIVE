using FluentValidation;

namespace SystemService.Application.Features.Users.ChangePassword;

public sealed class ChangePasswordCommandValidator : AbstractValidator<ChangePasswordCommand>
{
    public ChangePasswordCommandValidator()
    {
        RuleFor(x => x.UserId).NotEmpty();
        RuleFor(x => x.OldPassword).NotEmpty();
        RuleFor(x => x.NewPassword)
            .NotEmpty()
            .MinimumLength(8).WithMessage("Mật khẩu phải có ít nhất 8 ký tự.")
            .Matches("[A-Za-z]").WithMessage("Mật khẩu phải có ít nhất một chữ cái.")
            .Matches(@"\d").WithMessage("Mật khẩu phải có ít nhất một chữ số.")
            .NotEqual(x => x.OldPassword).WithMessage("Mật khẩu mới phải khác mật khẩu cũ.");
    }
}
