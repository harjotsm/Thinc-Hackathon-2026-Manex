import Link from "next/link";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-6 py-14">
      <h1 className="text-3xl font-semibold">Resolve MVP</h1>
      <p className="text-zinc-600">
        Closed-loop quality intelligence prototype: Listen → Reason → Resolve.
      </p>

      <div className="grid gap-4 md:grid-cols-3">
        <Link className="rounded border border-zinc-200 p-4 hover:bg-zinc-50" href="/capture">
          <h2 className="font-semibold">Operator Lens</h2>
          <p className="text-sm text-zinc-600">Capture a new signal from floor/customer voice.</p>
        </Link>

        <Link className="rounded border border-zinc-200 p-4 hover:bg-zinc-50" href="/dashboard">
          <h2 className="font-semibold">Leadership Lens</h2>
          <p className="text-sm text-zinc-600">Portfolio of incidents and initiatives.</p>
        </Link>

        <div className="rounded border border-zinc-200 p-4">
          <h2 className="font-semibold">Engineer Lens</h2>
          <p className="text-sm text-zinc-600">
            Open <code>/investigate/&lt;incidentId&gt;</code> after first incident is created.
          </p>
        </div>
      </div>
    </main>
  );
}
