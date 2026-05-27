namespace SystemService.Infrastructure.Persistence.Seeding;

internal static class PermissionActionSeedData
{
    public const string Read = "READ";
    public const string Create = "CREATE";
    public const string Update = "UPDATE";
    public const string Delete = "DELETE";
    public const string Export = "EXPORT";

    public static readonly ActionSeed[] All =
    {
        new(Read,   "Xem",   "Xem dữ liệu của phân hệ.", 10),
        new(Create, "Thêm",  "Tạo mới bản ghi.",         20),
        new(Update, "Sửa",   "Cập nhật bản ghi.",        30),
        new(Delete, "Xóa",   "Xóa bản ghi.",             40),
        new(Export, "Xuất",  "Xuất dữ liệu ra file.",    50),
    };

    public sealed record ActionSeed(string Code, string Name, string Description, int SortOrder);
}
