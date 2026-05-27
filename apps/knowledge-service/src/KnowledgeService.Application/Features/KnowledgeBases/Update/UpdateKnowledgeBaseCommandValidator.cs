using FluentValidation;

namespace KnowledgeService.Application.Features.KnowledgeBases.Update;

public class UpdateKnowledgeBaseCommandValidator : AbstractValidator<UpdateKnowledgeBaseCommand>
{
    public UpdateKnowledgeBaseCommandValidator()
    {
        RuleFor(x => x.Id).NotEmpty();

        RuleFor(x => x.Name)
            .NotEmpty().WithMessage("Tên bộ tri thức không được để trống.")
            .MaximumLength(200).WithMessage("Tên bộ tri thức tối đa 200 ký tự.");

        RuleFor(x => x.Description)
            .MaximumLength(1000).When(x => x.Description is not null);

        RuleFor(x => x.ManagingDepartmentId).NotEmpty();
        RuleFor(x => x.ManagingDepartmentName).NotEmpty().MaximumLength(200);
    }
}
