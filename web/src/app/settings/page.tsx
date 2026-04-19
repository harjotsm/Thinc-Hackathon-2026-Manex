export default function SettingsPage() {
  return (
    <main style={{ padding: "20px 24px" }}>
      <div>
        <div className="eyebrow">Workspace</div>
        <h1 style={{ margin: "6px 0 16px", fontSize: 22, fontWeight: 600, color: "var(--ink-primary)" }}>
          Settings
        </h1>
      </div>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 16 }}>
        <div className="panel" style={{ padding: 16 }}>
          <div className="eyebrow">Presentation</div>
          <div style={{ marginTop: 8, fontSize: 16, fontWeight: 600, color: "var(--ink-primary)" }}>
            Interface preferences
          </div>
          <div className="col" style={{ gap: 10, marginTop: 14 }}>
            <div className="card" style={{ padding: 12 }}>
              Default lens: Engineer
            </div>
            <div className="card" style={{ padding: 12 }}>
              Navigation shell: enabled
            </div>
          </div>
        </div>

        <div className="panel" style={{ padding: 16 }}>
          <div className="eyebrow">Environment</div>
          <div style={{ marginTop: 8, fontSize: 16, fontWeight: 600, color: "var(--ink-primary)" }}>
            Demo configuration
          </div>
          <div className="col" style={{ gap: 10, marginTop: 14 }}>
            <div className="card" style={{ padding: 12 }}>
              Seed data: available
            </div>
            <div className="card" style={{ padding: 12 }}>
              Stream status: ready
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
