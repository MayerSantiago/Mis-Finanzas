export default function MovimientosLoading() {
  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-4 animate-pulse">
      <div className="grid grid-cols-3 gap-2">
        {[1,2,3].map(i => <div key={i} className="h-16 bg-gray-200 rounded-2xl" />)}
      </div>
      <div className="space-y-3">
        {[1,2,3,4,5].map(i => (
          <div key={i} className="flex items-center gap-3 py-2">
            <div className="h-9 w-9 bg-gray-200 rounded-full" />
            <div className="flex-1 space-y-1.5">
              <div className="h-3.5 bg-gray-200 rounded w-32" />
              <div className="h-3 bg-gray-100 rounded w-20" />
            </div>
            <div className="h-4 bg-gray-200 rounded w-20" />
          </div>
        ))}
      </div>
    </div>
  )
}
