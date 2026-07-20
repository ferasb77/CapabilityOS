import { getWorkshops } from "@/infrastructure/repositories/workshops";

import { CreateWorkshopDialog } from "@/features/workshops/components/create-workshop-dialog";

export default async function WorkshopsPage() {
  const workshops = await getWorkshops();

  return (
    <main className="mx-auto max-w-7xl p-10">

      <div className="mb-8 flex items-center justify-between">

        <div>
          <h1 className="text-4xl font-bold">
            Workshops
          </h1>

          <p className="mt-2 text-slate-500">
            Manage your workshops.
          </p>
        </div>

        <CreateWorkshopDialog />

      </div>

      <div className="rounded-xl border bg-white">

        <table className="w-full">

          <thead>

            <tr className="border-b bg-slate-50">

              <th className="p-4 text-left">
                Title
              </th>

              <th className="p-4 text-left">
                Venue
              </th>

              <th className="p-4 text-left">
                Start
              </th>

              <th className="p-4 text-left">
                End
              </th>

              <th className="p-4 text-left">
                Capacity
              </th>

            </tr>

          </thead>

          <tbody>

            {workshops.length === 0 && (
              <tr>
                <td
                  colSpan={5}
                  className="p-8 text-center text-slate-500"
                >
                  No workshops yet.
                </td>
              </tr>
            )}

            {workshops.map((workshop) => (
              <tr
                key={workshop.id}
                className="border-b"
              >
                <td className="p-4 font-medium">
                  {workshop.title}
                </td>

                <td className="p-4">
                  {workshop.venue}
                </td>

                <td className="p-4">
                  {new Date(workshop.start_date).toLocaleString()}
                </td>

                <td className="p-4">
                  {new Date(workshop.end_date).toLocaleString()}
                </td>

                <td className="p-4">
                  {workshop.capacity}
                </td>

              </tr>
            ))}

          </tbody>

        </table>

      </div>

    </main>
  );
}