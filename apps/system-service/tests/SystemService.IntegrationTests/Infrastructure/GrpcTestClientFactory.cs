using Grpc.Net.Client;

namespace SystemService.IntegrationTests.Infrastructure;

internal static class GrpcTestClientFactory
{
    public static GrpcChannel CreateChannel(SystemServiceApplicationFactory factory)
    {
        var handler = factory.Server.CreateHandler();
        var http = new HttpClient(new ResponseVersionHandler { InnerHandler = handler })
        {
            BaseAddress = factory.Server.BaseAddress,
            DefaultRequestVersion = new Version(2, 0),
        };
        return GrpcChannel.ForAddress(http.BaseAddress!, new GrpcChannelOptions { HttpClient = http });
    }

    private sealed class ResponseVersionHandler : DelegatingHandler
    {
        protected override async Task<HttpResponseMessage> SendAsync(HttpRequestMessage request, CancellationToken cancellationToken)
        {
            request.Version = new Version(2, 0);
            var response = await base.SendAsync(request, cancellationToken);
            response.Version = new Version(2, 0);
            return response;
        }
    }
}
