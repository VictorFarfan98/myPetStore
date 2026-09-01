export default function Loading() {
  return (
    <div className="mx-auto max-w-7xl animate-pulse p-6">
      <div className="h-5 w-32 rounded bg-slate-200" />
      <div className="mt-3 h-9 w-72 rounded bg-slate-200" />
      <div className="mt-2 h-5 w-full max-w-2xl rounded bg-slate-100" />
      <div className="mt-6 h-96 rounded-lg bg-slate-100" />
    </div>
  );
}
