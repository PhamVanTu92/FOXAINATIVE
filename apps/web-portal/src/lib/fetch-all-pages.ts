/**
 * Tự động fetch tất cả các trang của một paginated endpoint.
 * Page 1 được fetch trước để lấy totalPages, rồi fetch song song các trang còn lại.
 *
 * @param fetcher  Hàm nhận (page, pageSize) → Promise<{ items: T[]; totalPages: number }>
 * @param pageSize Số item mỗi trang (mặc định 100 — giới hạn thường của backend)
 */
export async function fetchAllPages<T>(
  fetcher: (page: number, pageSize: number) => Promise<{ items: T[]; totalPages: number }>,
  pageSize = 100,
): Promise<T[]> {
  const first = await fetcher(1, pageSize);
  if (first.totalPages <= 1) return first.items;

  const rest = await Promise.all(
    Array.from({ length: first.totalPages - 1 }, (_, i) => fetcher(i + 2, pageSize)),
  );

  return [first.items, ...rest.map(r => r.items)].flat();
}
