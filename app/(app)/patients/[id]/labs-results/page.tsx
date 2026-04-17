import { notFound, redirect } from "next/navigation";
import { getServerSession } from "@/app/_lib/supabase/server";
import { getPatientOverview } from "@/app/_lib/db/drizzle/queries/patients";
import { getPatientOrdersAction } from "@/app/_actions/orders";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function LabsResultsPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id: patientId } = await params;
  const session = await getServerSession();

  if (!session) {
    redirect("/sign-in");
  }

  if (session.role !== "doctor" && session.role !== "nurse" && session.role !== "admin") {
    redirect("/");
  }

  const overview = await getPatientOverview(patientId);
  if (!overview) {
    notFound();
  }

  const orders = await getPatientOrdersAction(patientId);
  const resultItems = orders.filter((order) => {
    const type = order.type.toLowerCase();
    return type.includes("lab") || type.includes("imaging");
  });

  return (
    <div className="flex flex-1 flex-col gap-6 p-4 md:p-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Labs & Results</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Review lab and imaging orders/results linked to this chart.
        </p>
      </div>

      {resultItems.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-sm text-muted-foreground">
            No lab or imaging items have been documented yet.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {resultItems.map((item) => (
            <Card key={item.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="text-lg">{item.details || item.type}</CardTitle>
                  <Badge variant="outline">{item.type || "Result"}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm text-muted-foreground">
                <div>
                  <span className="font-medium text-foreground">Priority:</span>{" "}
                  {item.priority || "Routine"}
                </div>
                <div>
                  <span className="font-medium text-foreground">Status:</span>{" "}
                  {item.status || "Pending"}
                </div>
                <div>
                  <span className="font-medium text-foreground">Ordered:</span>{" "}
                  {item.dateOrdered || item.visitDate.toLocaleDateString()}
                </div>
                <div>
                  <span className="font-medium text-foreground">Ordered by:</span>{" "}
                  {item.orderedByName || "Care team"}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
