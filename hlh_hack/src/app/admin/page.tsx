export default function AdminPage() {
  return (
    <div className="w-full min-h-[70vh] ui-scale">
      <h1 className="text-white font-bold mb-4">Admin</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="rounded-[12px] border border-[color:var(--color-border)] bg-[color:var(--color-input-background)] p-4">
          <h2 className="text-white font-medium mb-2">Launch Test</h2>
          <p className="text-[color:var(--color-muted-foreground)]">빠르게 기능 점검하는 레이아웃 (디자인 최소)</p>
        </div>
        <div className="rounded-[12px] border border-[color:var(--color-border)] bg-[color:var(--color-input-background)] p-4">
          <h2 className="text-white font-medium mb-2">Index Test</h2>
          <p className="text-[color:var(--color-muted-foreground)]">리스트/정렬/필터 동작 점검용</p>
        </div>
      </div>
    </div>
  );
}
