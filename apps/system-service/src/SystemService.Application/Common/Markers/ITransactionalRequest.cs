using MediatR;

namespace SystemService.Application.Common.Markers;

public interface ITransactionalRequest<out TResponse> : IRequest<TResponse>
{
}
