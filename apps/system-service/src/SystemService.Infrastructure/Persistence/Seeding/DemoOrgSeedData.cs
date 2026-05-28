namespace SystemService.Infrastructure.Persistence.Seeding;

/// <summary>
/// Company org chart — 3 levels:
///   Level 0: root company
///   Level 1: departments (phòng ban)
///   Level 2: teams / tổ (sub-units within each department)
/// </summary>
internal static class DemoOrgSeedData
{
    // ── Level 0 ───────────────────────────────────────────────────────────────
    public const string RootCode = "FOXAI";

    // ── Level 1 — Departments ─────────────────────────────────────────────────
    public const string BanGiamDoc     = "BAN_GIAM_DOC";
    public const string PhongKeToan    = "PHONG_KE_TOAN";
    public const string PhongOcr       = "PHONG_OCR";
    public const string PhongKinhDoanh = "PHONG_KINH_DOANH";
    public const string PhongCongNghe  = "PHONG_CONG_NGHE";

    // ── Level 2 — Teams ───────────────────────────────────────────────────────
    // Ban Giám đốc
    public const string VpGiamDoc = "VP_GIAM_DOC";
    public const string BoPháp    = "BO_PHAP_CHE";

    // Phòng Kế toán
    public const string ToKeToanTh  = "TO_KE_TOAN_TH";
    public const string ToThanhToan = "TO_THANH_TOAN";

    // Phòng OCR
    public const string ToNhanDang = "TO_NHAN_DANG";
    public const string ToChuanHoa = "TO_CHUAN_HOA";

    // Phòng Kinh doanh
    public const string ToKinhDoanh = "TO_KINH_DOANH";
    public const string ToCskh      = "TO_CSKH";

    // Phòng Công nghệ
    public const string ToPhatTrien = "TO_PHAT_TRIEN";
    public const string ToHaTang    = "TO_HA_TANG";

    // ── Data ──────────────────────────────────────────────────────────────────
    public static readonly OrgSeed Root = new(
        RootCode, "FOXAI Corporation", 0, $"/{RootCode}", null);

    public static readonly OrgSeed[] Departments =
    {
        new(BanGiamDoc,     "Ban Giám đốc",               1, $"/{RootCode}/{BanGiamDoc}",     RootCode),
        new(PhongKeToan,    "Phòng Kế toán & Tài chính",  1, $"/{RootCode}/{PhongKeToan}",    RootCode),
        new(PhongOcr,       "Phòng OCR & Xử lý Tài liệu", 1, $"/{RootCode}/{PhongOcr}",      RootCode),
        new(PhongKinhDoanh, "Phòng Kinh doanh & CSKH",    1, $"/{RootCode}/{PhongKinhDoanh}", RootCode),
        new(PhongCongNghe,  "Phòng Công nghệ Thông tin",  1, $"/{RootCode}/{PhongCongNghe}",  RootCode),
    };

    public static readonly OrgSeed[] Teams =
    {
        // Ban Giám đốc
        new(VpGiamDoc, "Văn phòng Giám đốc",          2, $"/{RootCode}/{BanGiamDoc}/{VpGiamDoc}", BanGiamDoc),
        new(BoPháp,    "Bộ phận Pháp chế & Tuân thủ", 2, $"/{RootCode}/{BanGiamDoc}/{BoPháp}",   BanGiamDoc),

        // Phòng Kế toán
        new(ToKeToanTh,  "Tổ Kế toán Tổng hợp",    2, $"/{RootCode}/{PhongKeToan}/{ToKeToanTh}",  PhongKeToan),
        new(ToThanhToan, "Tổ Thanh toán & Ngân quỹ", 2, $"/{RootCode}/{PhongKeToan}/{ToThanhToan}", PhongKeToan),

        // Phòng OCR
        new(ToNhanDang, "Tổ Nhận dạng OCR",     2, $"/{RootCode}/{PhongOcr}/{ToNhanDang}", PhongOcr),
        new(ToChuanHoa, "Tổ Chuẩn hóa Dữ liệu", 2, $"/{RootCode}/{PhongOcr}/{ToChuanHoa}", PhongOcr),

        // Phòng Kinh doanh
        new(ToKinhDoanh, "Tổ Kinh doanh B2B",      2, $"/{RootCode}/{PhongKinhDoanh}/{ToKinhDoanh}", PhongKinhDoanh),
        new(ToCskh,      "Tổ Chăm sóc Khách hàng", 2, $"/{RootCode}/{PhongKinhDoanh}/{ToCskh}",      PhongKinhDoanh),

        // Phòng Công nghệ
        new(ToPhatTrien, "Tổ Phát triển Phần mềm", 2, $"/{RootCode}/{PhongCongNghe}/{ToPhatTrien}", PhongCongNghe),
        new(ToHaTang,    "Tổ Hạ tầng & DevOps",    2, $"/{RootCode}/{PhongCongNghe}/{ToHaTang}",    PhongCongNghe),
    };

    public sealed record OrgSeed(
        string Code,
        string Name,
        int Level,
        string Path,
        string? ParentCode
    );
}
