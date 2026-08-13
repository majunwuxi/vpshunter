export const metadata = {
  title: 'History - VPS Hunter'
};

export default function HistoryPage() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-4 py-8">
      <h1 className="text-2xl font-bold">
        Price History
      </h1>
      <p className="mt-2 text-sm text-zinc-500">
        Historical price trends.
      </p>
    </main>
  );
}