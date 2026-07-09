export default function DeudasLoading() {
  return (
    <div className="p-4 md:p-6 max-w-2xl mx-auto space-y-5 animate-pulse">
      <div className="flex justify-between items-center">
        <div className="h-6 bg-gray-200 rounded w-24" />
        <div className="h-8 bg-gray-200 rounded-lg w-20" />
      </div>
      <div className="h-32 bg-gray-200 rounded-2xl" />
      <div className="space-y-3">
        {[1,2,3].map(i => <div key={i} className="h-36 bg-gray-200 rounded-2xl" />)}
      </div>
    </div>
  )
}
