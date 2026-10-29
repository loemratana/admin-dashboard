// Departments users belong to. Approval rules can name a department as the
// approver for a level (e.g. Finance signs off large write-offs).
export const departments = [
  { id: "dept-management", name: "Management" },
  { id: "dept-operations", name: "Operations" },
  { id: "dept-purchasing", name: "Purchasing" },
  { id: "dept-finance", name: "Finance" },
  { id: "dept-sales", name: "Sales" },
] as const;

export type DepartmentId = (typeof departments)[number]["id"];

export const departmentName = (id: string | null) => departments.find((department) => department.id === id)?.name ?? "—";
