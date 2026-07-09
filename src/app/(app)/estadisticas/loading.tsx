export default function EstadisticasLoading() {
  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-5 animate-pulse">
      <div className="h-6 bg-gray-200 rounded w-36" />
      <div className="grid grid-cols-2 gap-3">
        <div className="h-24 bg-gray-200 rounded-2xl" />
        <div className="h-24 bg-gray-200 rounded-2xl" />
      </div>
      <div className="h-64 bg-gray-200 rounded-2xl" />
      <div className="h-48 bg-gray-200 rounded-2xl" />
      <div className="h-48 bg-gray-200 rounded-2xl" />
    </div>
  )
}
