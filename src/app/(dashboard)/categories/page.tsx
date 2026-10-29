import { PageHeader } from "@/components/shared/page-header";
import { RequirePermission } from "@/features/access-control/components/require-permission";
import { CategoriesManager } from "@/features/catalog/components/catalog-managers";

export default function CategoriesPage() {
  return (
    <RequirePermission permission="catalog.category.view">
      <PageHeader title="Categories" description="Group products so they're easier to find and report on." />
      <div className="max-w-3xl">
        <CategoriesManager />
      </div>
    </RequirePermission>
  );
}
