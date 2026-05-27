using FluentValidation;

namespace KnowledgeService.Application.Features.KnowledgeBases.Create;

public class CreateKnowledgeBaseCommandValidator : AbstractValidator<CreateKnowledgeBaseCommand>
{
    public CreateKnowledgeBaseCommandValidator()
    {
        RuleFor(x => x.Code)
            .NotEmpty().WithMessage("Mã bộ tri thức không được để trống.")
            .MaximumLength(20).WithMessage("Mã bộ tri thức tối đa 20 ký tự.")
            .Matches(@"^[A-Z0-9\-_]+$").WithMessage("Mã bộ tri thức chỉ gồm chữ hoa, số và dấu gạch.");

        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Tên bộ tri thức không được để trống.")
            .MaximumLength(200).WithMessage("Tên bộ tri thức tối đa 200 ký tự.");

        RuleFor(x => x.Description)
            .MaximumLength(1000).WithMessage("Mô tả tối đa 1000 ký tự.")
            .When(x => x.Description is not null);

        RuleFor(x => x.ManagingDepartmentId)
            .NotEmpty().WithMessage("Phòng ban quản lý không được để trống.");

        RuleFor(x => x.ManagingDepartmentName)
            .NotEmpty().WithMessage("Tên phòng ban quản lý không được để trống.")
            .MaximumLength(200);
    }
}
