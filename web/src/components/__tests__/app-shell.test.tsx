// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { renderToString } from "react-dom/server";
import { AppShell } from "../app-shell";

vi.mock("next/navigation", () => ({
  usePathname: () => "/inbox",
}));

vi.mock("next/link", () => ({
  default: ({ href, children, ...rest }: { href: string; children: ReactNode }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

vi.mock("next/image", () => ({
  default: ({ alt, ...rest }: { alt: string }) => <img alt={alt} {...rest} />,
}));

describe("AppShell hydration-safe sidebar state", () => {
  beforeEach(() => {
    window.localStorage.clear();
    window.localStorage.setItem("resolve.nav.collapsed", "true");
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/api/themes")) {
        return new Response(JSON.stringify({ themes: [{ id: "t1" }] }), { status: 200 });
      }
      if (url.includes("/api/incidents")) {
        return new Response(JSON.stringify({ pagination: { total: 1 } }), { status: 200 });
      }
      if (url.includes("/api/initiatives")) {
        return new Response(JSON.stringify({ pagination: { total: 1 } }), { status: 200 });
      }
      return new Response(JSON.stringify({}), { status: 200 });
    });
  });

  it("keeps SSR markup deterministic and applies persisted collapse after mount", async () => {
    const ssrHtml = renderToString(
      <AppShell>
        <div>child</div>
      </AppShell>,
    );
    expect(ssrHtml).toContain("grid-cols-[232px_minmax(0,1fr)]");
    expect(ssrHtml).not.toContain("grid-cols-[56px_minmax(0,1fr)]");

    const { container } = render(
      <AppShell>
        <div>child</div>
      </AppShell>,
    );

    const root = container.firstElementChild as HTMLElement;

    await waitFor(() => {
      expect(root.className).toContain("grid-cols-[56px_minmax(0,1fr)]");
    });
  });
});
