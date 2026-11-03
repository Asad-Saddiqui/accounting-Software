import { entryCsv, getEntry } from "@/lib/journal";

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const entry = getEntry(Number((await params).id));
  if (!entry) return new Response("Not found", { status: 404 });
  return new Response(entryCsv(entry), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${entry.number}.csv"`,
    },
  });
}
