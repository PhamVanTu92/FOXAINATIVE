using FluentValidation;

namespace KnowledgeService.Application.Features.KnowledgeDocuments.CreateVersion;

public class CreateDocumentVersionCommandValidator : AbstractValidator<CreateDocumentVersionCommand>
{
    public CreateDocumentVersionCommandValidator()
    {
        RuleFor(x => x.Id).NotEmpty();
        RuleFor(x => x.ChangeNote).NotEmpty().MaximumLength(500);
    }
}
