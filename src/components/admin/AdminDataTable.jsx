export default function AdminDataTable({
  columns,
  rows,
  onRowClick,
  selectedRows = [],
  onToggleRow,
  onToggleAll,
  isLoading = false,
  emptyLabel = "No records found",
}) {
  return (
    <div className="border border-[#E5E7EB] rounded-xl bg-white overflow-hidden">
      <div className={`text-[12px] text-[#9CA3AF] px-4 py-2 flex items-center gap-2 border-b border-[#E5E7EB] ${isLoading ? "animate-pulse" : ""}`}>
        {isLoading ? "Updating results…" : `Showing ${rows.length} results`}
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-[13px]">
          <thead className="bg-[#FAFAFA] text-[11px] uppercase tracking-[0.1em] text-[#9CA3AF] sticky top-0">
            <tr>
              {onToggleRow && (
                <th className="py-3 px-4">
                  <input type="checkbox" onChange={(e) => onToggleAll?.(e.target.checked)} />
                </th>
              )}
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={`py-3 px-4 ${col.sortable ? "cursor-pointer" : ""}`}
                  onClick={col.sortable ? col.onSort : undefined}
                >
                  {col.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={columns.length + (onToggleRow ? 1 : 0)} className="px-4 py-6">
                  <div className="space-y-3">
                    {[...Array(3)].map((_, idx) => (
                      <div key={idx} className="h-3 rounded-full skeleton" />
                    ))}
                  </div>
                </td>
              </tr>
            ) : rows.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (onToggleRow ? 1 : 0)} className="px-4 py-6 text-[13px] text-[#9CA3AF]">
                  {emptyLabel}
                </td>
              </tr>
            ) : (
              rows.map((row) => (
                <tr
                  key={row.id}
                  className="border-b border-[#F3F4F6] hover:bg-[#FAFAFA] transition-colors cursor-pointer"
                  onClick={() => onRowClick?.(row)}
                >
                  {onToggleRow && (
                    <td className="py-3 px-4" onClick={(e) => e.stopPropagation()}>
                      <input type="checkbox" checked={selectedRows.includes(row.id)} onChange={() => onToggleRow(row.id)} />
                    </td>
                  )}
                  {columns.map((col) => (
                    <td key={col.key} className="py-3 px-4">
                      {col.render ? col.render(row) : row[col.key]}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
