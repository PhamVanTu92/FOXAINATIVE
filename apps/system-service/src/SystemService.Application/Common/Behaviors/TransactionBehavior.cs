using MediatR;
using SystemService.Application.Abstractions.Persistence;
using SystemService.Application.Common.Markers;

namespace SystemService.Application.Common.Behaviors;

public sealed class TransactionBehavior<TRequest, TResponse>(IUnitOfWork unitOfWork)
    : IPipelineBehavior<TRequest, TResponse>
    where TRequest : notnull
{
    public async Task<TResponse> Handle(
        TRequest request,
        RequestHandlerDelegate<TResponse> next,
        CancellationToken cancellationToken)
    {
        if (request is not ITransactionalRequest<TResponse>)
        {
            return await next();
        }

        var response = await next();
        await unitOfWork.SaveChangesAsync(cancellationToken);
        return response;
    }
}
