using FluentAssertions;
using Xunit;

namespace SystemService.UnitTests;

public class SmokeTests
{
    [Fact]
    public void Project_compiles_and_xunit_runs()
    {
        true.Should().BeTrue();
    }
}
