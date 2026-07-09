export default function DashboardLoading() {
  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-5 animate-pulse">
      <div className="space-y-1.5">
        <div className="h-6 bg-gray-200 rounded w-48" />
        <div className="h-4 bg-gray-100 rounded w-32" />
      </div>
      <div className="grid grid-cols-3 gap-2">
        {[1,2,3].map(i => <div key={i} className="h-20 bg-gray-200 rounded-2xl" />)}
      </div>
      <div className="h-40 bg-gray-200 rounded-2xl" />
      <div className="h-48 bg-gray-200 rounded-2xl" />
      <div className="h-48 bg-gray-200 rounded-2xl" />
    </div>
  )
}
